import { readFileSync } from "node:fs";
import { transform } from "esbuild";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkinErrors, validReceipt, type CheckinDraft } from "../lib/checkin-submission";
import { defaultCheckinConfig, deriveCheckinMood } from "../lib/checkins";

const id = "a6b7c8d9-0000-4000-8000-000000000001";
const receipt = { id, week_number: 1, created_at: "2026-10-15T09:00:00Z" };
const responses = Object.fromEntries(defaultCheckinConfig.questions.map((q) => [q.id, q.type === "scale" ? "7" : q.options?.[0]?.value || "Synthetic answer"]));
let snapshot: CheckinDraft;
let draftRef: { current: CheckinDraft };
let persist: ReturnType<typeof vi.fn>;
let submitted: ReturnType<typeof vi.fn>;
let error: ReturnType<typeof vi.fn>;
let signIn: ReturnType<typeof vi.fn>;
let fetcher: ReturnType<typeof vi.fn>;
let submit: (event: { preventDefault(): void }) => Promise<void>;
const event = { preventDefault: () => {} };

beforeEach(async () => {
  snapshot = { version: 1, submissionId: id, responses, mood: "great", configVersion: "v1", updatedAt: Date.now(), pending: false };
  draftRef = { current: snapshot };
  persist = vi.fn((next: CheckinDraft) => { draftRef.current = next; return true; });
  submitted = vi.fn(); error = vi.fn(); signIn = vi.fn();
  fetcher = vi.fn(async () => new Response(JSON.stringify({ success: true, receipt }), { status: 200 }));
  const source = readFileSync(new URL("../app/portal/checkin/page.tsx", import.meta.url), "utf8");
  const handler = source.slice(source.indexOf("  async function handleSubmit("), source.indexOf("  function resetForm("));
  const code = (await transform(handler, { loader: "ts", target: "es2022" })).code;
  const names = ["inFlightRef", "draftConflict", "draftRef", "config", "checkinErrors", "responses", "mood", "setFieldErrors", "setError", "document", "setSubmitting", "setSignInRequired", "moodRequired", "deriveCheckinMood", "persistDraft", "window", "fetch", "userIdRef", "validReceipt", "setReceipt", "setSubmitted", "toast", "setConfig", "crypto"];
  submit = new Function(...names, code + "; return handleSubmit;")(
    { current: false }, false, draftRef, defaultCheckinConfig, checkinErrors, responses, "great", vi.fn(), error,
    { getElementById: () => ({ focus: () => {} }) }, vi.fn(), signIn, false, deriveCheckinMood, persist,
    { setTimeout, clearTimeout }, fetcher, { current: "account-a" }, validReceipt, vi.fn(), submitted, vi.fn(), vi.fn(), { randomUUID: () => "new-submission-id" },
  );
});

describe("actual check-in submit handler", () => {
  it("shows success only after a matching receipt and stores a receipt marker", async () => {
    await submit(event);
    expect(submitted).toHaveBeenCalledWith(true);
    expect(draftRef.current).toMatchObject({ pending: false, receipt, responses: {} });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ submissionId: id, userId: "account-a", responses });
  });
  it("rejects generic HTTP 200 success without discarding answers", async () => {
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ success: true })));
    await submit(event);
    expect(submitted).not.toHaveBeenCalled();
    expect(draftRef.current).toMatchObject({ pending: true, submissionId: id, responses });
    expect(error).toHaveBeenLastCalledWith(expect.stringContaining("could not confirm"));
  });
  it("freezes an uncertain request and retries its original ID/content", async () => {
    fetcher.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await submit(event);
    expect(draftRef.current.pending).toBe(true);
    await submit(event);
    const bodies = fetcher.mock.calls.map((call) => JSON.parse(call[1].body));
    expect(bodies[1]).toEqual(bodies[0]);
    expect(submitted).toHaveBeenCalledWith(true);
  });
  it("prevents overlapping same-turn submits before React can disable the button", async () => {
    let resolve: (value: Response) => void = () => {};
    fetcher.mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; }));
    const first = submit(event);
    await submit(event);
    expect(fetcher).toHaveBeenCalledOnce();
    resolve(new Response(JSON.stringify({ success: true, receipt })));
    await first;
  });
  it("keeps the frozen draft and a persistent sign-in action after session expiry", async () => {
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Please sign in", requestId: "safe-ref" }), { status: 401 }));
    await submit(event);
    expect(signIn).toHaveBeenLastCalledWith(true);
    expect(error).toHaveBeenLastCalledWith("Please sign in Reference: safe-ref");
    expect(draftRef.current).toMatchObject({ pending: true, responses });
    expect(submitted).not.toHaveBeenCalled();
  });
  it("unlocks a previously uncertain attempt only after atomic cancellation, preserving answers", async () => {
    draftRef.current = { ...snapshot, pending: true };
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Question changed", cancelled: true, config: defaultCheckinConfig }), { status: 400 }));
    await submit(event);
    expect(draftRef.current).toMatchObject({ pending: false, submissionId: "new-submission-id", responses });
  });
  it("does not unlock on an unconfirmed rejection", async () => {
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Question changed" }), { status: 400 }));
    await submit(event);
    expect(draftRef.current.pending).toBe(true);
  });
});
