import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CBB_LOCATION_ID,
  CBB_LOCATION_NAME,
  contentPackHash,
  validateContentPack,
} from "../lib/ops/content-pack";
import {
  contentSchedulePreview,
  executeContentPost,
  verifyContentPostDelivery,
} from "../lib/ops/content-scheduling";

const now = new Date("2030-01-06T09:00:00Z");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l7sAAAAASUVORK5CYII=",
  "base64",
);
const sha256 = createHash("sha256").update(png).digest("hex");
const userId = "fixture-user-123";
function fixture() {
  return {
    schema_version: 1,
    pack_id: "content:2030-01-07",
    version: 1,
    timezone: "Europe/London",
    location_id: CBB_LOCATION_ID,
    source: { provider: "upload", id: "brief-1", revision: "version-1" },
    posts: [
      {
        post_id: "post-1",
        platform: "instagram",
        account_id: "account-1",
        caption: "A useful construction business tip.",
        schedule_at: "2030-01-07T10:00:00Z",
        media: [
          {
            asset_id: "image-1",
            sha256,
            url: `https://assets.example.com/content/${sha256}/image.png`,
            mime_type: "image/png",
          },
        ],
      },
    ],
  };
}
function provider(
  options: {
    wrongLocation?: boolean;
    wrongUser?: boolean;
    wrongAccount?: boolean;
    expired?: boolean;
    changedMedia?: boolean;
    postStatus?: number;
    postThrow?: boolean;
    noId?: boolean;
    badReadback?: boolean;
    readbackError?: boolean;
  } = {},
) {
  return vi.fn(
    async (
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      const url = String(input);
      if (url.startsWith("https://assets.example.com")) {
        expect(init?.headers).toBeUndefined();
        expect(init?.redirect).toBe("error");
        return new Response(
          options.changedMedia ? new Uint8Array([1, 2, 3]) : png,
          { headers: { "Content-Type": "image/png" } },
        );
      }
      expect((init?.headers as Record<string, string>).Version).toBe("v3");
      if (url.endsWith(`/locations/${CBB_LOCATION_ID}`))
        return Response.json({
          location: {
            id: options.wrongLocation ? "other" : CBB_LOCATION_ID,
            name: CBB_LOCATION_NAME,
          },
        });
      if (url.endsWith(`/users/${userId}`))
        return Response.json({
          id: userId,
          roles: {
            locationIds: [options.wrongUser ? "other" : CBB_LOCATION_ID],
          },
        });
      if (url.endsWith("/accounts"))
        return Response.json({
          results: {
            accounts: [
              {
                id: "account-1",
                platform: options.wrongAccount ? "facebook" : "instagram",
                locationId: CBB_LOCATION_ID,
                active: true,
                isExpired: !!options.expired,
              },
            ],
          },
        });
      if (init?.method === "POST") {
        if (options.postThrow) throw new Error("Timed out after dispatch");
        if (options.postStatus)
          return Response.json(
            { message: "rejected" },
            { status: options.postStatus },
          );
        const body = JSON.parse(String(init.body));
        expect(body.status).toBe("scheduled");
        expect(body.accountIds).toEqual(["account-1"]);
        expect(body.userId).toBe(userId);
        expect(body.scheduleDate).toBe("2030-01-07T10:00:00Z");
        return Response.json({
          results: {
            post: options.noId
              ? {}
              : { _id: "provider-post-1", status: "scheduled" },
          },
        });
      }
      if (url.endsWith("/provider-post-1")) {
        if (options.readbackError) return Response.json({}, { status: 503 });
        const p = fixture().posts[0];
        return Response.json({
          results: {
            post: {
              _id: "provider-post-1",
              locationId: CBB_LOCATION_ID,
              accountIds: [p.account_id],
              summary: options.badReadback ? "Changed copy" : p.caption,
              status: "scheduled",
              type: "post",
              displayDate: p.schedule_at,
              media: p.media.map((m) => ({ url: m.url, type: m.mime_type })),
            },
          },
        });
      }
      throw Error("Unexpected request: " + url);
    },
  );
}
function live(fetch: typeof globalThis.fetch) {
  return {
    dryRun: false,
    enabled: true,
    token: "test-only-token",
    userId,
    allowedMediaHosts: ["assets.example.com"],
    fetch,
    now,
  };
}
afterEach(() => vi.unstubAllEnvs());

describe("content pack validation and exact preparation", () => {
  it("validates without changing approved caption/media order and previews without network", () => {
    const p = fixture(),
      before = JSON.stringify(p);
    expect(validateContentPack(p, { now }).posts[0].caption).toBe(
      p.posts[0].caption,
    );
    expect(JSON.stringify(p)).toBe(before);
    expect(contentSchedulePreview(p, { now }).dry_run).toBe(true);
  });
  it("rejects duplicate IDs, unknown state/fields and inconsistent asset versions", () => {
    const p = fixture();
    p.posts.push({ ...p.posts[0] });
    expect(() => validateContentPack(p, { now })).toThrow("Duplicate post_id");
    expect(() =>
      validateContentPack({ ...fixture(), status: "approved" }, { now }),
    ).toThrow("Invalid content pack");
    const q = fixture();
    q.posts.push({
      ...q.posts[0],
      post_id: "post-2",
      media: [{ ...q.posts[0].media[0], sha256: "b".repeat(64) }],
    });
    expect(() => validateContentPack(q, { now })).toThrow("different bytes");
  });
  it.each([
    "2030-01-07T10:00:00",
    "2030-02-30T10:00:00Z",
    "2030-01-07T10:00:00+01:00",
    "2030-01-06T09:04:00Z",
  ])("rejects invalid, mismatched or too-soon schedule %s", (date) => {
    const p = fixture();
    p.posts[0].schedule_at = date;
    expect(() => validateContentPack(p, { now })).toThrow();
  });
  it.each([
    "https://127.0.0.1/a.png",
    "https://[::1]/a.png",
    "https://localhost/a.png",
    "http://assets.example.com/a.png",
    "https://drive.google.com/file/d/example/view",
    "https://assets.example.com/a.png?token=private",
    "https://user:secret@assets.example.com/a.png",
  ])("rejects unsafe/private media %s", (url) => {
    const p = fixture();
    p.posts[0].media[0].url = url;
    expect(() => validateContentPack(p, { now })).toThrow();
  });
  it("hashes caption, dates and media order without depending on object key order", () => {
    const p = validateContentPack(fixture(), { now }),
      original = contentPackHash(p);
    expect(
      contentPackHash({
        ...p,
        posts: p.posts.map((post) => ({
          ...post,
          caption: post.caption + " Changed",
        })),
      }),
    ).not.toBe(original);
    const second = { ...p.posts[0].media[0], asset_id: "image-2" };
    p.posts[0].media.push(second);
    const ordered = contentPackHash(p);
    p.posts[0].media.reverse();
    expect(contentPackHash(p)).not.toBe(ordered);
    expect(
      contentPackHash({
        ...p,
        source: {
          revision: p.source.revision,
          id: p.source.id,
          provider: p.source.provider,
        },
      }),
    ).toBe(contentPackHash(p));
  });
});

describe("single-post GHL scheduling", () => {
  it("checks delivery while disabled using only GET requests, retaining the ordered plan", async () => {
    const fetch = provider();
    const result = await verifyContentPostDelivery(fixture(), "post-1", {
      ...live(fetch),
      enabled: false,
    });
    expect(result.media).toEqual([
      { asset_id: "image-1", sha256, byte_size: png.length },
    ]);
    expect(result.planned.body.accountIds).toEqual(["account-1"]);
    expect(result.planned.body.media).toEqual(
      fixture().posts[0].media.map((image) => ({
        url: image.url,
        type: image.mime_type,
      })),
    );
    expect(
      fetch.mock.calls.every(
        (call) => !call[1]?.method || call[1]?.method === "GET",
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain("test-only-token");
  });
  it("rejects LinkedIn media that would exceed the regular feed limit", () => {
    const input = fixture();
    input.posts[0].platform = "linkedin";
    input.posts[0].media = Array.from({ length: 10 }, (_, index) => ({
      ...input.posts[0].media[0],
      asset_id: `image-${index}`,
    }));
    expect(() => validateContentPack(input, { now })).toThrow(
      "at most nine images",
    );
    input.posts[0].media.pop();
    expect(validateContentPack(input, { now }).posts[0].media).toHaveLength(9);
  });
  it("defaults to dry run with zero network calls even if enabled", async () => {
    const fetch = provider();
    const result = await executeContentPost(fixture(), "post-1", {
      ...live(fetch),
      dryRun: undefined,
    });
    expect(result.outcome).toBe("dry_run");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not call providers when disabled, missing credentials or lacking allowed hosts", async () => {
    vi.stubEnv("OPS_CONTENT_MEDIA_HOSTS", "");
    for (const override of [
      { enabled: false },
      { token: "" },
      { userId: "" },
      { allowedMediaHosts: [] },
    ]) {
      const fetch = provider();
      const r = await executeContentPost(fixture(), "post-1", {
        ...live(fetch),
        ...override,
      });
      expect(r.outcome).toBe("failed");
      expect(fetch).not.toHaveBeenCalled();
    }
  });
  it.each([
    { wrongLocation: true },
    { wrongUser: true },
    { wrongAccount: true },
    { expired: true },
    { changedMedia: true },
  ])(
    "refuses changed identity/account/media before creation: %j",
    async (option) => {
      const fetch = provider(option);
      const r = await executeContentPost(fixture(), "post-1", live(fetch));
      expect(r.outcome).toBe("failed");
      expect(
        fetch.mock.calls.filter((c) => c[1]?.method === "POST"),
      ).toHaveLength(0);
    },
  );
  it("refuses unapproved hosts and non-content-addressed delivery URLs before network", async () => {
    const p = fixture();
    p.posts[0].media[0].url = "https://assets.example.com/mutable.png";
    const fetch = provider();
    expect((await executeContentPost(p, "post-1", live(fetch))).outcome).toBe(
      "failed",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reports scheduled only after exact saved-state readback", async () => {
    const fetch = provider();
    const r = await executeContentPost(fixture(), "post-1", live(fetch));
    expect(r.outcome).toBe("scheduled");
    expect(r.provider_id).toBe("provider-post-1");
    expect(
      fetch.mock.calls.filter((c) => c[1]?.method === "POST"),
    ).toHaveLength(1);
  });
  it.each([
    { postThrow: true },
    { postStatus: 503 },
    { postStatus: 429 },
    { noId: true },
    { badReadback: true },
    { readbackError: true },
  ])(
    "holds uncertain outcomes for reconciliation and never retries: %j",
    async (option) => {
      const fetch = provider(option);
      const r = await executeContentPost(fixture(), "post-1", live(fetch));
      expect(r.outcome).toBe("uncertain");
      expect(
        fetch.mock.calls.filter((c) => c[1]?.method === "POST"),
      ).toHaveLength(1);
    },
  );
  it("reports definite validation rejection separately from uncertain network outcome", async () => {
    const fetch = provider({ postStatus: 422 });
    expect(
      (await executeContentPost(fixture(), "post-1", live(fetch))).outcome,
    ).toBe("failed");
    expect(
      fetch.mock.calls.filter((c) => c[1]?.method === "POST"),
    ).toHaveLength(1);
  });
});

describe("signed private transport scheduling adapter", () => {
  it("uses checked temporary URLs only in create/readback while preserving the approved pack", async () => {
    const pack = fixture(), unchanged = structuredClone(pack);
    const signedUrl = "https://project.supabase.co/storage/v1/object/sign/ops-content-media/fixture.png?token=private";
    let sent: Record<string, unknown> | undefined;
    const base = provider();
    const request: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url === signedUrl) return new Response(png, { headers: {"content-type":"image/png"} });
      if (init?.method === "POST") {
        sent = JSON.parse(String(init.body));
        return Response.json({results:{post:{_id:"created-1"}}});
      }
      if (url.endsWith("/posts/created-1")) return Response.json({results:{post:{...sent,_id:"created-1",locationId:CBB_LOCATION_ID}}});
      return base(input, init);
    };
    const signedDelivery = vi.fn(async () => ({media:[{...pack.posts[0].media[0],mime_type:"image/png" as const,url:signedUrl}],expires_at:"2030-01-13T09:00:00Z",policy:"Operator policy"}));
    const r=await executeContentPost(pack,"post-1",{now,dryRun:false,enabled:true,token:"fixture-token",userId,approvedDelivery:{artifact_id:"11111111-1111-4111-8111-111111111111"},signedDelivery,fetch:request});
    expect(r.outcome).toBe("scheduled");
    expect((sent?.media as {url:string}[])[0].url).toBe(signedUrl);
    expect(r.receipt).not.toHaveProperty("url");
    expect(JSON.stringify(r.receipt)).not.toContain("token=private");
    expect(pack).toEqual(unchanged);
  });
  it("does not fall back to protected source URLs when approved delivery fails",async()=>{
    const request=provider();
    const r=await executeContentPost(fixture(),"post-1",{now,dryRun:false,enabled:true,token:"fixture-token",userId,approvedDelivery:{artifact_id:"11111111-1111-4111-8111-111111111111"},signedDelivery:async()=>{throw new Error("missing approval")},fetch:request});
    expect(r.outcome).toBe("failed");
    expect(request.mock.calls.some(([,init])=>init?.method==="POST")).toBe(false);
    expect(request.mock.calls.some(([url])=>String(url).startsWith("https://assets.example.com"))).toBe(false);
  });
});

it("keeps a signed-transport create timeout uncertain and never retries the create", async()=>{
 const pack=fixture(),signedUrl="https://project.supabase.co/storage/v1/object/sign/ops-content-media/fixture.png?token=private";
 const base=provider({postThrow:true});
 const request=vi.fn(async(input: string | URL | Request,init?: RequestInit)=>String(input)===signedUrl?new Response(png,{headers:{"content-type":"image/png"}}):base(input,init));
 const r=await executeContentPost(pack,"post-1",{now,dryRun:false,enabled:true,token:"fixture-token",userId,approvedDelivery:{artifact_id:"11111111-1111-4111-8111-111111111111"},signedDelivery:async()=>({media:[{...pack.posts[0].media[0],mime_type:"image/png" as const,url:signedUrl}],expires_at:"2030-01-13T09:00:00Z",policy:"Operator policy"}),fetch:request});
 expect(r.outcome).toBe("uncertain");expect(request.mock.calls.filter(([,init])=>init?.method==="POST")).toHaveLength(1);
 expect(JSON.stringify(r)).not.toContain("token=private");
});
