import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  push: vi.fn(),
  email: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/push", () => ({ sendPushToUser: mocks.push }));
vi.mock("@/lib/email-templates", () => ({
  sendCheckinReminderEmail: mocks.email,
}));
import { GET } from "@/app/api/cron/checkin-reminder/route";

function fixture() {
  const claimed = new Set<string>();
  const results: string[] = [];
  const rpc = vi.fn(async (_fn, args) => {
    const key = [args.p_client, args.p_week, args.p_channel].join("/");
    if (claimed.has(key)) return { data: "already_attempted" };
    claimed.add(key);
    return { data: "claimed" };
  });
  const profile = {
    id: "profile",
    user_id: "user",
    start_date: "2026-10-01",
    users: { full_name: "Example Client" },
  };
  mocks.admin.mockReturnValue({
    rpc,
    from: (table: string) => {
      if (table === "form_config")
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { config: { checkin_day: "thursday" } },
              }),
            }),
          }),
        };
      if (table === "client_profiles") {
        const query = {
          select: () => query,
          eq: () => query,
          is: () => query,
          order: () => query,
          limit: async () => ({ data: [profile] }),
        };
        return query;
      }
      return {
        update: (value: { status: string }) => {
          results.push(value.status);
          const q = { eq: () => q };
          return q;
        },
      };
    },
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { email: "example@example.invalid" } },
        }),
      },
    },
  });
  mocks.push.mockResolvedValue({ sent: 1, failed: 0 });
  mocks.email.mockResolvedValue({ data: { id: "test" }, error: null });
  return { rpc, results };
}
function run() {
  return GET(
    new Request("https://example.invalid/api/cron/checkin-reminder", {
      headers: { authorization: "Bearer fixture" },
    }),
  );
}
describe("weekly check-in reminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-26T09:00:00Z"));
    vi.stubEnv("CRON_SECRET", "fixture");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });
  it("overlapping runs send at most once on each channel", async () => {
    const { results } = fixture();
    const responses = await Promise.all([run(), run()]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(mocks.email).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledTimes(1);
    expect(results).toEqual(["accepted", "accepted"]);
  });
  it("holds email if the client submits after the push claim", async () => {
    const { rpc } = fixture();
    rpc
      .mockResolvedValueOnce({ data: "claimed" })
      .mockResolvedValueOnce({ data: "checked_in" });
    await run();
    expect(mocks.push).toHaveBeenCalledTimes(1);
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it("sends nothing if eligibility cannot be verified", async () => {
    const { rpc } = fixture();
    rpc.mockResolvedValue({ error: { message: "read failed" } } as never);
    expect((await run()).status).toBe(503);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it("retains reservations after uncertain delivery and records provider rejection", async () => {
    const { results } = fixture();
    mocks.push.mockRejectedValue(new Error("timeout"));
    mocks.email.mockResolvedValue({ error: { name: "rejected" } });
    await run();
    await run();
    expect(results).toEqual(["unconfirmed", "rejected"]);
    expect(mocks.email).toHaveBeenCalledTimes(1);
  });
});
