import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  profile: { id: "00000000-0000-4000-8000-000000000001", onboarding_stage: "none", archived_at: null as string | null, onboarding_due_at: null },
  tasks: new Map<string, Record<string, unknown>>(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: h.rpc }) }));
vi.mock("@/lib/ops/notify", () => ({ notifyOpsAdmins: vi.fn(() => { throw Error("No notification expected"); }) }));
vi.mock("../lib/ops/clients", () => ({ getClient: async () => ({ ...h.profile }) }));
import { preparePendingAdmission, prepareOnboardingChecklist } from "../lib/ops/onboarding";

describe("internal onboarding preparation with sending off", () => {
  beforeEach(() => {
    vi.clearAllMocks(); h.tasks.clear();
    h.profile.onboarding_stage = "none"; h.profile.archived_at = null;
    // Dedicated create-once contract. The generic task create RPC updates existing
    // title/detail/payload; it must not be used for onboarding intake retries.
    h.rpc.mockImplementation(async (name: string, args: { p_data: Record<string, unknown> }) => {
      if (name !== "ops_create_onboarding_task") throw Error("Only dedicated create-once preparation permitted");
      const data = args.p_data, ref = String(data.external_ref);
      if (!h.tasks.has(ref)) h.tasks.set(ref, { ...data, id: `task-${h.tasks.size}`, status: "open" });
      return { data: h.tasks.get(ref), error: null };
    });
  });
  it("persists one Eimear checklist, preserves human work on replay and never claims an invite", async () => {
    const first = await prepareOnboardingChecklist(h.profile.id);
    expect(first.onboarding_stage).toBe("none");
    expect(h.tasks.size).toBe(3);
    expect([...h.tasks.values()].every((t) => t.assignee === "eimear" && t.area === "onboarding")).toBe(true);
    const ref = `onboarding:${h.profile.id}:admission`;
    h.tasks.get(ref)!.status = "done";
    h.tasks.get(ref)!.detail = "Eimear checked the agreed offer";
    const originalIds = [...h.tasks.values()].map((t) => t.id);
    await prepareOnboardingChecklist(h.profile.id);
    expect(h.tasks.size).toBe(3);
    expect([...h.tasks.values()].map((t) => t.id)).toEqual(originalIds);
    expect(h.tasks.get(ref)).toMatchObject({ status: "done", detail: "Eimear checked the agreed offer" });
    expect(h.profile.onboarding_stage).toBe("none");
    expect(h.rpc.mock.calls.every(([name]) => name === "ops_create_onboarding_task")).toBe(true);
  });
  it("does not create more work for completed or archived clients", async () => {
    h.profile.onboarding_stage = "complete";
    await prepareOnboardingChecklist(h.profile.id);
    expect(h.rpc).not.toHaveBeenCalled();
    h.profile.archived_at = "2026-11-06T10:00:00Z";
    await expect(prepareOnboardingChecklist(h.profile.id)).rejects.toThrow("Archived");
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it("deduplicates pending admission without provisioning an account or granting modules", async () => {
    await preparePendingAdmission("Synthetic Client", "fixture@example.invalid");
    await preparePendingAdmission("Synthetic Client", " FIXTURE@example.invalid ");
    expect(h.tasks.size).toBe(1);
    expect([...h.tasks.values()][0]).toMatchObject({ client_id: null, assignee: "eimear", payload: { admission: "needs_human_review" } });
    expect(h.rpc.mock.calls.every(([name]) => name === "ops_create_onboarding_task")).toBe(true);
  });
  it("fails closed when create-once persistence is unavailable", async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: "Missing migration" } });
    await expect(preparePendingAdmission("Synthetic", "fixture@example.invalid")).rejects.toThrow("retry intake");
  });
});
