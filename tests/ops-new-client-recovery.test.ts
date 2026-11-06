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
  "sendWelcomeEmail",
  "NextResponse",
  code + ";return POST;",
)(db, f.invite, f.onboarding, f.welcome, {
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
    vi.stubEnv("WEBHOOK_SECRET", "fixture-only");
    f.createUser.mockResolvedValue({
      data: { user: { id: "fixture-user" } },
      error: null,
    });
    f.invite.mockResolvedValue({
      activationUrl: "https://example.invalid/fixture",
    });
    f.welcome.mockResolvedValue(undefined);
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
});
