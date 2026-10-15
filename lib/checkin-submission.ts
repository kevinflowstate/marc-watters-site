import type { CheckinFormConfig, FormQuestion } from "./types";

export type CheckinReceipt = { id: string; week_number: number; created_at: string };
export const submissionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function questionError(question: FormQuestion, responses: Record<string, string>): string | null {
  const answer = responses[question.id]?.trim();
  if (!answer) return question.required ? `Please complete "${question.label}"` : null;
  if (question.type === "single_choice") {
    if (!question.options?.some((option) => option.value === answer)) return `Choose an option for "${question.label}"`;
    if (question.allow_other && answer === "other" && !responses[`${question.id}__other`]?.trim()) {
      return `Add your answer for "${question.label}"`;
    }
  }
  if (question.type === "scale") {
    const number = Number(answer);
    if (!Number.isInteger(number) || number < (question.min ?? 1) || number > (question.max ?? 10)) {
      return `Choose a score for "${question.label}"`;
    }
  }
  return null;
}

export function checkinErrors(config: CheckinFormConfig, responses: Record<string, string>, mood: string | null) {
  const errors: Record<string, string> = {};
  for (const question of config.questions) {
    const error = questionError(question, responses);
    if (error) errors[question.id] = error;
  }
  if (config.mood_enabled && config.mood_options.length && !config.mood_options.some((option) => option.value === mood)) {
    errors.mood = "Choose how you are feeling this week";
  }
  return errors;
}

export function validResponses(value: unknown): value is Record<string, string> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) &&
    Object.values(value).every((answer) => typeof answer === "string"));
}

export function sameResponses(a: Record<string, string>, b: Record<string, string>) {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

export function validReceipt(value: unknown, submissionId: string): value is CheckinReceipt {
  if (!value || typeof value !== "object") return false;
  const receipt = value as CheckinReceipt;
  return receipt.id === submissionId && Number.isInteger(receipt.week_number) && receipt.week_number > 0 &&
    typeof receipt.created_at === "string" && Number.isFinite(Date.parse(receipt.created_at));
}

export type CheckinDraft = {
  version: 1;
  submissionId: string;
  responses: Record<string, string>;
  mood: string | null;
  configVersion: string;
  updatedAt: number;
  pending: boolean;
  receipt?: CheckinReceipt;
};
export const draftKey = (userId: string) => `cbb:checkin-draft:${userId}`;
export const draftRetentionMs = 30 * 24 * 60 * 60 * 1000;

export function readDraft(raw: string | null, now = Date.now()): CheckinDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as CheckinDraft;
    if (value.version !== 1 || !submissionIdPattern.test(value.submissionId) || !validResponses(value.responses) ||
      (value.mood !== null && typeof value.mood !== "string") || typeof value.pending !== "boolean" ||
      typeof value.configVersion !== "string" || !Number.isFinite(value.updatedAt) ||
      (value.receipt !== undefined && !validReceipt(value.receipt, value.submissionId))) return null;
    // Pending attempts keep their ID until reconciled, even after the normal draft retention period.
    if (!value.pending && now - value.updatedAt > draftRetentionMs) return null;
    return value;
  } catch { return null; }
}

// Compare the last value this tab read before writing. A stale tab must never erase another tab's work.
export function writeDraft(storage: Pick<Storage, "getItem" | "setItem">, key: string, expected: string | null, draft: CheckinDraft) {
  try {
    if (storage.getItem(key) !== expected) return { status: "conflict" as const };
    const raw = JSON.stringify(draft);
    storage.setItem(key, raw);
    return { status: "saved" as const, raw };
  } catch { return { status: "unavailable" as const }; }
}

export function acquireDraftLock(manager: Pick<LockManager, "request">, key: string, onAcquired: (release: () => void) => void): Promise<boolean> {
  return new Promise((resolve, reject) => {
    void manager.request(key, { ifAvailable: true }, async (lock) => {
      if (!lock) { resolve(false); return; }
      await new Promise<void>((release) => { onAcquired(release); resolve(true); });
    }).catch(() => reject(new Error("This browser could not open draft protection. Please reload or use another browser. Saved answers have not been changed.")));
  });
}
