import { describe, expect, it } from "vitest";
import { defaultCheckinConfig } from "../lib/checkins";
import { acquireDraftLock, checkinErrors, draftKey, draftRetentionMs, questionError, readDraft, sameResponses, validReceipt, validResponses, writeDraft, type CheckinDraft } from "../lib/checkin-submission";

const id = "a6b7c8d9-0000-4000-8000-000000000001";
const draft: CheckinDraft = { version: 1, submissionId: id, responses: { wins: "Saved answers" }, mood: "good", configVersion: "v1", updatedAt: Date.now(), pending: false };
const receipt = { id, week_number: 2, created_at: "2026-10-15T09:00:00Z" };

describe("shared check-in validation", () => {
  it("does not count Other as complete without its explanation", () => {
    const question = defaultCheckinConfig.questions.find((q) => q.id === "what_went_well")!;
    expect(questionError(question, { what_went_well: "other", what_went_well__other: "  " })).toContain("Add your answer");
    expect(questionError(question, { what_went_well: "other", what_went_well__other: "Planning" })).toBeNull();
  });
  it.each(["", " ", "0", "11", "2.5", "NaN"])("rejects missing or invalid required score %s", (value) => {
    expect(questionError(defaultCheckinConfig.questions[0], { overall_week_rating: value })).toBeTruthy();
  });
  it("rejects invented choices and empty required text", () => {
    expect(questionError(defaultCheckinConfig.questions[1], { business_feeling: "invented" })).toBeTruthy();
    expect(questionError(defaultCheckinConfig.questions[3], { what_went_well_detail: "  " })).toBeTruthy();
  });
  it("requires a valid configured mood, including custom options", () => {
    const config = { ...defaultCheckinConfig, questions: [], mood_enabled: true, mood_options: [{ value: "custom", label: "Custom", color: "blue" }] };
    expect(checkinErrors(config, {}, "good").mood).toBeTruthy();
    expect(checkinErrors(config, {}, "custom")).toEqual({});
  });
  it("rejects arrays and non-string answers before validation", () => {
    expect(validResponses([])).toBe(false);
    expect(validResponses({ rating: 4 })).toBe(false);
    expect(validResponses({ rating: "4" })).toBe(true);
  });
});

describe("saved acknowledgement and account-scoped drafts", () => {
  it("requires a matching persisted receipt instead of generic success", () => {
    expect(validReceipt({ success: true }, id)).toBe(false);
    expect(validReceipt({ ...receipt, id: "other" }, id)).toBe(false);
    expect(validReceipt({ ...receipt, created_at: "invalid" }, id)).toBe(false);
    expect(validReceipt(receipt, id)).toBe(true);
  });
  it("compares every submitted answer independently of JSON key order", () => {
    expect(sameResponses({ a: "one", b: "two" }, { b: "two", a: "one" })).toBe(true);
    expect(sameResponses({ a: "new" }, { a: "old" })).toBe(false);
  });
  it("restores exact pending content and submission ID across reload/login", () => {
    const pending = { ...draft, pending: true };
    expect(readDraft(JSON.stringify(pending))).toEqual(pending);
    expect(draftKey("account-a")).not.toBe(draftKey("account-b"));
  });
  it("expires ordinary drafts after 30 days but retains unresolved attempts", () => {
    const now = draft.updatedAt + draftRetentionMs + 1;
    expect(readDraft(JSON.stringify(draft), now)).toBeNull();
    expect(readDraft(JSON.stringify({ ...draft, pending: true }), now)?.submissionId).toBe(id);
  });
  it("retains a receipt marker without answers after successful save", () => {
    const saved = { ...draft, responses: {}, mood: null, receipt };
    expect(readDraft(JSON.stringify(saved))?.receipt).toEqual(receipt);
    expect(readDraft(JSON.stringify({ ...saved, receipt: { ...receipt, id: "wrong" } }))).toBeNull();
  });
  it("never overwrites another tab or clears its newer draft on receipt", () => {
    let raw: string | null = JSON.stringify(draft);
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    const original = raw;
    const newer = { ...draft, responses: { wins: "Other tab's new answer" } };
    expect(writeDraft(storage, "key", original, newer).status).toBe("saved");
    const afterOtherTab = raw;
    expect(writeDraft(storage, "key", original, { ...draft, receipt, responses: {} }).status).toBe("conflict");
    expect(raw).toBe(afterOtherTab);
  });
  it("reports blocked/quota-limited storage without claiming a draft was saved", () => {
    expect(writeDraft({ getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); } }, "key", null, draft).status).toBe("unavailable");
  });
});

describe("draft lock acquisition", () => {
  it("rejects denied browser lock access instead of leaving form loading unresolved", async () => {
    const manager = { request: () => Promise.reject(new Error("SecurityError")) } as unknown as LockManager;
    await expect(acquireDraftLock(manager, "draft", () => {})).rejects.toThrow("Saved answers have not been changed");
  });
  it("reports an already-owned draft without waiting or taking it over", async () => {
    const manager = { request: async (_name: string, _options: unknown, callback: (lock: null) => Promise<void>) => callback(null) } as unknown as LockManager;
    await expect(acquireDraftLock(manager, "draft", () => { throw new Error("should not acquire"); })).resolves.toBe(false);
  });
  it("holds an acquired lock until release", async () => {
    let released = false;
    let release: () => void = () => {};
    const manager = { request: async (_name: string, _options: unknown, callback: (lock: object) => Promise<void>) => {
      await callback({}); released = true;
    } } as unknown as LockManager;
    await expect(acquireDraftLock(manager, "draft", (done) => { release = done; })).resolves.toBe(true);
    expect(released).toBe(false);
    release();
    await Promise.resolve();
    await Promise.resolve();
    expect(released).toBe(true);
  });
});
