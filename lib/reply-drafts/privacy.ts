// Keeps one client's details out of another client's draft.
// - Other clients' messages are never put in a prompt (the examples RPC does not even return them).
// - Marc's example replies are redacted before they reach the model.
// - Untrusted text sits in blocks whose tag names carry a per-request nonce, with every < and > escaped,
//   so nothing inside can reproduce or close a block.
// - A guard rejects any draft that names another client or copies a run of words from an example, and
//   flags drafts whose wording is close to an example for Marc to check.
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type KnownClient = { clientId: string; fullName: string | null; businessName: string | null };

export class PrivacyError extends Error {}

const PAGE = 1000;

async function allRows<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new PrivacyError(`privacy: client list unavailable (${error.message})`);
    const rows = (data || []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/**
 * Every client the portal knows about (names and businesses), for redaction and the leak guard.
 * Fails closed: any read error throws, and every page is read.
 */
export async function loadKnownClients(admin: SupabaseClient): Promise<KnownClient[]> {
  const [profiles, users] = await Promise.all([
    allRows<{ id: string; user_id: string; business_name: string | null }>((from, to) =>
      admin.from("client_profiles").select("id, user_id, business_name").order("id").range(from, to),
    ),
    allRows<{ id: string; full_name: string | null }>((from, to) =>
      admin.from("users").select("id, full_name").eq("role", "client").order("id").range(from, to),
    ),
  ]);
  const names = new Map(users.map((u) => [u.id, u.full_name]));
  return profiles.map((p) => ({ clientId: p.id, fullName: names.get(p.user_id) ?? null, businessName: p.business_name }));
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const clean = (s: string | null | undefined) => (s || "").replace(/\s+/g, " ").trim();
const letters = (s: string) => s.replace(/[^A-Za-z]/g, "").length;

/** Split a full name: first name, and the remaining parts (surnames), 3+ letters each. */
function nameParts(fullName: string | null) {
  const full = clean(fullName);
  const parts = full ? full.split(" ") : [];
  return {
    full: parts.length > 1 ? full : "",
    first: parts[0] && letters(parts[0]) >= 3 ? parts[0] : "",
    surnames: parts.slice(1).filter((p) => letters(p) >= 3),
  };
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
  // Contact details and money first, so a name inside an email address cannot break the email pattern.
  let out = text;
  for (const [re, token] of PATTERNS) out = out.replace(re, token);
  const byLength = (a: string, b: string) => b.length - a.length;
  // Case-insensitive: business names, full names and surnames.
  const insensitive = [
    ...clients.map((c) => clean(c.businessName)).filter((b) => b.length >= 3).map((v) => ({ v, t: "[business]" })),
    ...clients.flatMap((c) => {
      const n = nameParts(c.fullName);
      return [n.full, ...n.surnames].filter(Boolean).map((v) => ({ v, t: "[client]" }));
    }),
  ].sort((a, b) => byLength(a.v, b.v));
  for (const { v, t } of insensitive) out = out.replace(new RegExp(`\\b${escapeRe(v)}\\b`, "gi"), t);
  // Case-sensitive: first names, so "Will" the person goes but "will" the word stays.
  const firsts = clients.map((c) => nameParts(c.fullName).first).filter(Boolean).sort(byLength);
  for (const f of firsts) out = out.replace(new RegExp(`\\b${escapeRe(f)}\\b`, "g"), "[client]");
  out = out.replace(GREETING, (_m, g: string, sep: string) => `${g}${sep}[client]`);
  for (const p of PLACES) out = out.replace(new RegExp(`\\b${escapeRe(p)}\\b`, "g"), "[place]");
  return out;
}

/** Escape every angle bracket so untrusted text can never form a tag. */
export function escapeAngles(text: string) {
  return text.replace(/</g, "‹").replace(/>/g, "›");
}

/** Block tag names for one request. The nonce is never shown to the client and changes every call. */
export type Delimiters = { nonce: string; untrustedTag: string; exampleTag: string };

export function newDelimiters(nonce = randomBytes(4).toString("hex")): Delimiters {
  return { nonce, untrustedTag: `untrusted_${nonce}`, exampleTag: `example_reply_${nonce}` };
}

/** Wrap untrusted text (client-written) in a delimited data block. */
export function untrusted(d: Delimiters, source: string, text: string) {
  return `<${d.untrustedTag} source="${source}">\n${escapeAngles(text).trim()}\n</${d.untrustedTag}>`;
}

export function exampleBlock(d: Delimiters, n: number, text: string) {
  return `<${d.exampleTag} n="${n}">\n${escapeAngles(text).trim()}\n</${d.exampleTag}>`;
}

function words(text: string) {
  return text
    .toLowerCase()
    .replace(/\[[a-z]+\]/g, " ")
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** A run of this many consecutive words shared with an example rejects the draft. */
export const COPY_RUN = 6;
/** Jaccard similarity of word 4-grams with any single example at or above this flags the draft. */
export const CLOSE_WORDING_JACCARD = 0.15;
export const CLOSE_WORDING_REASON = "Check wording - close to another client's reply";

function shingles(text: string, n: number) {
  const w = words(text);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i += 1) out.add(w.slice(i, i + n).join(" "));
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const s of a) if (b.has(s)) shared += 1;
  return shared / (a.size + b.size - shared);
}

export type GuardResult = { reject: string | null; flag: string | null };

/**
 * - reject: the draft names another client (full name, business, surname, or a first name that appeared
 *   in the original text of this draft's examples), or copies 6+ consecutive words from an example.
 * - flag: the wording is close to an example (4-gram Jaccard); the draft is kept but marked needs_marc.
 * Names are always checked against the original, unredacted client list.
 */
export function guardDraft(
  draft: string,
  opts: { currentClientId: string; clients: KnownClient[]; exampleReplies: string[]; exampleOriginals?: string[] },
): GuardResult {
  const current = opts.clients.find((c) => c.clientId === opts.currentClientId);
  const mine = nameParts(current?.fullName ?? null);
  const own = new Set([mine.full, mine.first, ...mine.surnames, clean(current?.businessName)].map((s) => s.toLowerCase()).filter(Boolean));
  const originals = opts.exampleOriginals ?? [];

  for (const c of opts.clients) {
    if (c.clientId === opts.currentClientId) continue;
    const n = nameParts(c.fullName);
    const business = clean(c.businessName);
    const firstInExamples = n.first && originals.some((o) => new RegExp(`\\b${escapeRe(n.first)}\\b`).test(o));
    const candidates = [
      { value: n.full, label: "another client's name", flags: "i" },
      { value: business.length >= 4 ? business : "", label: "another client's business name", flags: "i" },
      // Surnames match with their capital letter only, so "Price" the person is caught but "price" is not.
      ...n.surnames.filter((s) => letters(s) >= 4).map((value) => ({ value, label: "another client's surname", flags: "" })),
      { value: firstInExamples ? n.first : "", label: "a first name from another client's conversation", flags: "" },
    ];
    for (const { value, label, flags } of candidates) {
      if (!value || own.has(value.toLowerCase())) continue;
      if (new RegExp(`\\b${escapeRe(value)}\\b`, flags).test(draft)) return { reject: `Draft mentioned ${label}`, flag: null };
    }
  }

  const examples = [...opts.exampleReplies, ...originals];
  const draftRuns = shingles(draft, COPY_RUN);
  for (const reply of examples) {
    for (const s of shingles(reply, COPY_RUN)) {
      if (draftRuns.has(s)) return { reject: `Draft copied ${COPY_RUN}+ words in a row from an example reply`, flag: null };
    }
  }
  const draftGrams = shingles(draft, 4);
  for (const reply of examples) {
    if (jaccard(draftGrams, shingles(reply, 4)) >= CLOSE_WORDING_JACCARD) return { reject: null, flag: CLOSE_WORDING_REASON };
  }
  return { reject: null, flag: null };
}
