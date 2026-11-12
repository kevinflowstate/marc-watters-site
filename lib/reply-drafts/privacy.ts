// Keeps one client's details out of another client's draft.
// - Other clients' messages are never put in a prompt (the examples RPC does not even return them).
// - Marc's example replies are redacted before they reach the model.
// - Untrusted text is wrapped in delimited blocks the model is told to treat as data.
// - A guard rejects any draft that names another client or copies a long run from an example.
import type { SupabaseClient } from "@supabase/supabase-js";

export type KnownClient = { clientId: string; fullName: string | null; businessName: string | null };

/** Every client the portal knows about (names and businesses), for redaction and the leak guard. */
export async function loadKnownClients(admin: SupabaseClient): Promise<KnownClient[]> {
  const [{ data: profiles }, { data: users }] = await Promise.all([
    admin.from("client_profiles").select("id, user_id, business_name"),
    admin.from("users").select("id, full_name").eq("role", "client"),
  ]);
  const names = new Map(((users || []) as Array<{ id: string; full_name: string | null }>).map((u) => [u.id, u.full_name]));
  return ((profiles || []) as Array<{ id: string; user_id: string; business_name: string | null }>).map((p) => ({
    clientId: p.id,
    fullName: names.get(p.user_id) ?? null,
    businessName: p.business_name,
  }));
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const clean = (s: string | null | undefined) => (s || "").replace(/\s+/g, " ").trim();

/** Name variants worth redacting: full name, first name, surname (3+ letters each). */
function nameVariants(fullName: string | null) {
  const full = clean(fullName);
  if (!full) return [];
  const parts = full.split(" ").filter((p) => p.replace(/[^A-Za-z]/g, "").length >= 3);
  return Array.from(new Set([full, ...parts]));
}

// Larger towns and counties in the UK and Ireland that come up in client messages.
const PLACES = [
  "Derry", "Londonderry", "Belfast", "Dublin", "Cork", "Galway", "Limerick", "Waterford", "Kilkenny", "Sligo", "Letterkenny",
  "Donegal", "Tyrone", "Fermanagh", "Armagh", "Antrim", "Newry", "Lisburn", "Bangor", "Coleraine", "Omagh",
  "Enniskillen", "Strabane", "Ballymena", "Portadown", "Craigavon", "Dungannon", "Limavady", "Magherafelt", "Cookstown",
  "London", "Manchester", "Birmingham", "Liverpool", "Leeds", "Glasgow", "Edinburgh", "Cardiff", "Bristol", "Newcastle",
  "Sheffield", "Nottingham", "Leicester", "Aberdeen", "Dundee", "Swansea", "Kerry", "Meath", "Kildare", "Wicklow", "Louth",
  "Mayo", "Clare", "Tipperary", "Wexford", "Carlow", "Laois", "Offaly", "Westmeath", "Longford", "Roscommon", "Leitrim",
  "Cavan", "Monaghan",
];

const PATTERNS: Array<[RegExp, string]> = [
  [/\b[\w.+-]+@[\w-]+(\.[\w-]+)+\b/g, "[email]"],
  [/\b(?:https?:\/\/|www\.)\S+/gi, "[link]"],
  [/(?:\+44\s?7\d{3}|\+353\s?8\d|\(?0\d{2,4}\)?)[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g, "[phone]"],
  [/\b07\d{3}\s?\d{6}\b/g, "[phone]"],
  [/[£€$]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|m|grand)\b)?/gi, "[amount]"],
  [/\b\d[\d,]*(?:\.\d+)?\s?(?:k|grand|quid|euro|euros|pounds|gbp|eur)\b/gi, "[amount]"],
  [/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g, "[amount]"],
  [/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g, "[postcode]"],
  [/\b(?:BT|D|H|V|F|T|R|P|N|K|Y|X|W|E|C|A)\d{1,2}\s?[A-Z\d]{4}\b/g, "[postcode]"],
  [/\b\d{1,4}\s+[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\s(?:Road|Rd|Street|St|Avenue|Ave|Lane|Drive|Close|Park|Way|Crescent|Gardens|Terrace|Place)\b/g, "[address]"],
];

/** Greeting followed by a name ("Hi Sam,", "Morning Jo") - redact the name whoever it is. */
const GREETING = /\b(hi|hey|hello|morning|afternoon|evening|alright|well|cheers|thanks|good man|good woman|nice one|dear)(,?\s+)([A-Z][a-z'-]{1,20})\b/g;

export function redactText(text: string, clients: KnownClient[]): string {
  let out = text;
  // Business names first (longest first), then people.
  const businesses = clients.map((c) => clean(c.businessName)).filter((b) => b.length >= 3).sort((a, b) => b.length - a.length);
  for (const b of businesses) out = out.replace(new RegExp(`\\b${escapeRe(b)}\\b`, "gi"), "[business]");
  const people = clients.flatMap((c) => nameVariants(c.fullName)).sort((a, b) => b.length - a.length);
  for (const n of people) out = out.replace(new RegExp(`\\b${escapeRe(n)}\\b`, "g"), "[client]");
  for (const [re, token] of PATTERNS) out = out.replace(re, token);
  out = out.replace(GREETING, (_m, g: string, sep: string) => `${g}${sep}[client]`);
  for (const p of PLACES) out = out.replace(new RegExp(`\\b${escapeRe(p)}\\b`, "g"), "[place]");
  return out;
}

/** Strip anything inside untrusted text that tries to open or close one of our blocks. */
export function neutralise(text: string) {
  return text.replace(/<\/?\s*(untrusted|example_reply|client_text)\b[^>]*>/gi, "[removed tag]");
}

/** Wrap untrusted text (client-written, or example replies) in a delimited data block. */
export function untrusted(source: string, text: string) {
  return `<untrusted source="${source}">\n${neutralise(text).trim()}\n</untrusted>`;
}

export function exampleBlock(n: number, text: string) {
  return `<example_reply n="${n}">\n${neutralise(text).trim()}\n</example_reply>`;
}

function words(text: string) {
  return text
    .toLowerCase()
    .replace(/\[[a-z]+\]/g, " ")
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const RUN = 8;

function shingles(text: string, n = RUN) {
  const w = words(text);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i += 1) out.add(w.slice(i, i + n).join(" "));
  return out;
}

/**
 * Reject a draft that mentions another client by name or business, or that copies 8+ consecutive
 * words from an example reply. Returns the reason, or null when the draft is safe to show.
 */
export function guardDraft(
  draft: string,
  opts: { currentClientId: string; clients: KnownClient[]; exampleReplies: string[] },
): string | null {
  const current = opts.clients.find((c) => c.clientId === opts.currentClientId);
  const own = new Set([...nameVariants(current?.fullName ?? null), clean(current?.businessName)].map((s) => s.toLowerCase()).filter(Boolean));
  for (const c of opts.clients) {
    if (c.clientId === opts.currentClientId) continue;
    const full = clean(c.fullName);
    const parts = full.split(" ");
    const surname = parts.length > 1 ? parts[parts.length - 1] : "";
    const business = clean(c.businessName);
    const candidates = [
      { value: full.includes(" ") ? full : "", label: "another client's name", flags: "i" },
      { value: business.length >= 4 ? business : "", label: "another client's business name", flags: "i" },
      // Surnames are matched with their capital letter only, so "Price" the person is caught but "price" is not.
      { value: surname.replace(/[^A-Za-z'-]/g, "").length >= 4 ? surname : "", label: "another client's surname", flags: "" },
    ];
    for (const { value, label, flags } of candidates) {
      if (!value || own.has(value.toLowerCase())) continue;
      if (new RegExp(`\\b${escapeRe(value)}\\b`, flags).test(draft)) return `Draft mentioned ${label}`;
    }
  }
  const draftShingles = shingles(draft);
  for (const reply of opts.exampleReplies) {
    for (const s of shingles(reply)) {
      if (draftShingles.has(s)) return `Draft copied ${RUN}+ words in a row from an example reply`;
    }
  }
  return null;
}
