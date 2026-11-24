export const intakeFields = {
  full_name: "Full name",
  phone: "Mobile number",
  business_name: "Business name",
  home_address: "Home delivery address, including postcode",
  business_address: "Business address, including postcode",
  goals: "Business goal",
} as const;

export const installWelcome =
  "Welcome to the Blueprint. On iPhone, open the portal in Safari, tap Share, then Add to Home Screen. On Android, open the Chrome menu and choose Install app or Add to Home screen. Open the installed app, go to Settings, turn on notifications and tap Allow.";

export function parseClientIntake(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Complete your profile before continuing.");
  const body = input as Record<string, unknown>;
  const fields: Record<string, string> = {};
  for (const [key, label] of Object.entries(intakeFields)) {
    const value = body[key];
    if (typeof value !== "string" || !value.trim())
      throw Error(label + " is required.");
    fields[key] = value.trim();
    if (fields[key].length > (key === "goals" ? 4000 : 500))
      throw Error(label + " is too long.");
  }
  if (
    !/^[+\d ()-]+$/.test(fields.phone) ||
    !/^\d{7,15}$/.test(fields.phone.replace(/\D/g, ""))
  )
    throw Error("Enter a valid mobile number with its area or country code.");
  for (const key of [
    "business_type",
    "staff_count",
    "annual_turnover",
    "biggest_challenge",
  ]) {
    const value = body[key];
    if (typeof value === "string") fields[key] = value.trim().slice(0, 4000);
  }
  return fields;
}
