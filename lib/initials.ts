/**
 * Two-letter initials for an avatar. Ignores anything after "|" or "-" separators
 * ("Dan Ennis | DE Landscapes LTD" -> "DE") and anything that is not a letter or digit.
 */
export function initials(name: string | null | undefined): string {
  const person = String(name || "").split(/\s[|\-–—]\s|\|/)[0];
  const words = person.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : words[0][1] || "";
  return (first + last).toUpperCase();
}
