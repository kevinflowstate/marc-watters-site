import { createAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";
import { MARC_PAYMENT_LOCATION } from "./payment-policy";
import { OpsError } from "./tasks";

const tag = "manual-onboarding";
type Contact = {
  id: string;
  email: string;
  locationId: string;
  tags?: string[];
};
export async function manualIntake(
  input: { email: string; name: string; paymentMethod: string },
  actor: string,
) {
  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !name ||
    name.length > 160 ||
    !["cash", "bank_transfer"].includes(input.paymentMethod)
  )
    throw new OpsError("Enter a client name, email and payment method.");
  const db = createAdminClient();
  const existing = await db
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing.error) throw new OpsError("Portal lookup failed", 503);
  if (existing.data)
    throw new OpsError(
      "A portal account already exists for this email. Open the client profile to check their onboarding.",
      409,
    );
  const token = getEnv("CBB_GHL_PIT_TOKEN");
  if (!token) throw new OpsError("Marc’s CRM connection is unavailable.", 503);
  async function crm(path: string, body?: object) {
    const response = await fetch(
      "https://services.leadconnectorhq.com" + path,
      {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: "Bearer " + token,
          Version: "2021-07-28",
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new OpsError(
        "CRM request could not be confirmed. Check the contact before retrying.",
        502,
      );
    return response.json();
  }
  const matches = await crm("/contacts/search", {
    locationId: MARC_PAYMENT_LOCATION,
    page: 1,
    pageLimit: 5,
    filters: [{ field: "email", operator: "eq", value: email }],
  });
  if (!Array.isArray(matches.contacts) || matches.contacts.length > 1)
    throw new OpsError("The CRM contact could not be uniquely matched.", 409);
  let contactId: string;
  if (matches.contacts.length === 1) contactId = matches.contacts[0].id;
  else {
    // A concurrent creation can return a duplicate conflict. A retry re-runs the exact lookup.
    const created = await crm("/contacts/", {
      locationId: MARC_PAYMENT_LOCATION,
      email,
      name,
    });
    contactId = created.contact?.id;
  }
  if (!/^[a-zA-Z0-9]{8,100}$/.test(contactId || ""))
    throw new OpsError("CRM contact ID unavailable.", 502);
  const read = async (): Promise<Contact> => {
    const { contact } = await crm("/contacts/" + contactId);
    if (
      contact?.id !== contactId ||
      contact?.locationId !== MARC_PAYMENT_LOCATION ||
      contact?.email?.trim().toLowerCase() !== email ||
      !Array.isArray(contact.tags)
    ) {
      throw new OpsError("The CRM identity could not be confirmed.", 409);
    }
    return contact;
  };
  const contact = await read();
  const alreadyStarted =
    contact.tags?.includes("contract-signed") || contact.tags?.includes(tag);
  const reservation = await db
    .from("client_manual_intakes")
    .insert({
      email,
      contact_id: contactId,
      payment_method: input.paymentMethod,
      actor,
      state: alreadyStarted ? "started" : "reserved",
    });
  if (reservation.error) {
    if (reservation.error.code === "23505" && alreadyStarted)
      return { status: "already_started" };
    if (reservation.error.code === "23505")
      throw new OpsError(
        "An earlier request exists. Check the contact’s contract history before any further action.",
        409,
      );
    throw new OpsError("The portal could not record this request.", 503);
  }
  if (alreadyStarted) return { status: "already_started" };
  try {
    await crm("/contacts/" + contactId + "/tags", { tags: [tag] });
    if (!(await read()).tags?.includes(tag)) throw Error("tag not confirmed");
  } catch {
    await db
      .from("client_manual_intakes")
      .update({ state: "needs_review" })
      .eq("email", email);
    throw new OpsError(
      "The result is uncertain. Check the contact’s workflow history before retrying. The portal has held duplicate requests.",
      502,
    );
  }
  const saved = await db
    .from("client_manual_intakes")
    .update({ state: "started" })
    .eq("email", email);
  if (saved.error)
    throw new OpsError(
      "The CRM trigger was confirmed. Check the portal record before retrying.",
      503,
    );
  return { status: "started" };
}
