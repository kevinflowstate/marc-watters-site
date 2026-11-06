import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({
  existing: false,
  onboarding: vi.fn(),
  invite: vi.fn(),
  welcome: vi.fn(),
  createUser: vi.fn(),
  profileReady: true,
  lookupError: false,
  prepare: vi.fn(),
  pending: vi.fn(),
}));
// Follow this repository's source-loading test pattern without adding a global alias config.
const source = readFileSync(
  new URL("../app/api/webhooks/new-client/route.ts", import.meta.url),
  "utf8",
);
const code = transformSync(
  source.replace(/^import .*;$/gm, "").replaceAll("export ", ""),
  { loader: "ts", target: "es2022" },
).code;
const db = () => ({
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        limit: async () => ({
          data: f.existing ? [{ id: "fixture-user" }] : [],
          error: f.lookupError ? { message: "Synthetic outage" } : null,
        }),
        single: async () => ({ data: f.profileReady ? { id: "fixture-profile" } : null }),
      }),
    }),
    insert: async () => ({ error: null, table }),
  }),
  auth: { admin: { createUser: f.createUser } },
});
const POST = new Function(
  "createAdminClient",
  "createOrReplaceClientInvite",
  "startOnboarding",
  "prepareOnboardingChecklist",
  "preparePendingAdmission",
  "sendWelcomeEmail",
  "NextResponse",
  code + ";return POST;",
)(db, f.invite, f.onboarding, f.prepare, f.pending, f.welcome, {
  json: (data: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(data), init),
}) as (request: Request) => Promise<Response>;
const request = () =>
  new Request("http://localhost/api/webhooks/new-client", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-secret": "fixture-only",
    },
    body: JSON.stringify({
      name: "Synthetic Client",
      email: "fixture@example.invalid",
    }),
  });
describe("Ops onboarding does not strand account activation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    f.existing = false;
    f.profileReady = true;
    f.lookupError = false;
    vi.stubEnv("WEBHOOK_SECRET", "fixture-only");
    vi.stubEnv("FLOWSTATE_PORTAL_SEND_ENABLED", "true");
    f.createUser.mockResolvedValue({
      data: { user: { id: "fixture-user" } },
      error: null,
    });
    f.invite.mockResolvedValue({
      activationUrl: "https://example.invalid/fixture",
    });
    f.welcome.mockResolvedValue(undefined);
    f.pending.mockResolvedValue({ id: "fixture-admission-task" });
  });
  it("finishes activation before a failed Ops dependency and retries only onboarding", async () => {
    f.onboarding.mockRejectedValueOnce(new Error("Synthetic Ops outage"));
    await expect(POST(request())).rejects.toThrow("Synthetic Ops outage");
    expect(f.invite).toHaveBeenCalledOnce();
    expect(f.welcome).toHaveBeenCalledOnce(); // mocked: no external send
    f.existing = true;
    f.onboarding.mockResolvedValueOnce({});
    const result = await POST(request());
    expect(result.status).toBe(200);
    expect(f.onboarding).toHaveBeenCalledTimes(2);
    expect(f.invite).toHaveBeenCalledOnce();
    expect(f.welcome).toHaveBeenCalledOnce();
    expect(f.createUser).toHaveBeenCalledOnce();
  });
  it("replays successful intake without creating another invitation, welcome or account", async () => {
    f.onboarding.mockResolvedValue({});
    expect((await POST(request())).status).toBe(200);
    f.existing = true;
    for (let retry = 0; retry < 3; retry++) expect((await POST(request())).status).toBe(200);
    expect(f.onboarding).toHaveBeenCalledTimes(4);
    expect(f.invite).toHaveBeenCalledOnce();
    expect(f.welcome).toHaveBeenCalledOnce();
    expect(f.createUser).toHaveBeenCalledOnce();
  });
  it("asks for a retry when an existing account has no profile instead of duplicating the welcome", async () => {
    f.existing = true;
    f.profileReady = false;
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(f.onboarding).not.toHaveBeenCalled();
    expect(f.invite).not.toHaveBeenCalled();
    expect(f.welcome).not.toHaveBeenCalled();
    expect(f.createUser).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated intake before any invitation or onboarding action", async () => {
    const unauthorised = request();
    unauthorised.headers.delete("x-webhook-secret");
    expect((await POST(unauthorised)).status).toBe(401);
    expect(f.invite).not.toHaveBeenCalled();
    expect(f.welcome).not.toHaveBeenCalled();
    expect(f.onboarding).not.toHaveBeenCalled();
  });
  it("prepares an internal checklist with sending off and never creates an invite or welcome", async () => {
    vi.stubEnv("FLOWSTATE_PORTAL_SEND_ENABLED", "false");
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ emailSent: false, delivery_status: "paused" });
    expect(f.pending).toHaveBeenCalledWith("Synthetic Client", "fixture@example.invalid");
    expect(f.createUser).not.toHaveBeenCalled(); // No Auth/profile trigger or module grant.
    expect(f.invite).not.toHaveBeenCalled();
    expect(f.welcome).not.toHaveBeenCalled();
    expect(f.onboarding).not.toHaveBeenCalled();
    f.existing = true;
    expect((await POST(request())).status).toBe(200);
    expect(f.prepare).toHaveBeenCalledOnce();
    expect(f.createUser).not.toHaveBeenCalled();
  });
  it("fails closed on an unavailable account lookup instead of creating another client", async () => {
    f.lookupError = true;
    expect((await POST(request())).status).toBe(503);
    expect(f.createUser).not.toHaveBeenCalled();
    expect(f.prepare).not.toHaveBeenCalled();
    expect(f.invite).not.toHaveBeenCalled();
  });
  it("rejects malformed or wrongly typed intake without attempting a database write", async () => {
    for (const payload of ["{", "[]", "null", '{"name":123,"email":456}']) {
      const req = new Request(request(), { body: payload });
      expect((await POST(req)).status).toBe(400);
    }
    expect(f.createUser).not.toHaveBeenCalled();
  });
});
