import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  connectContentDrive,
  verifyContentDriveFile,
} from "../lib/ops/drive-connection";
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const credentials = JSON.stringify({
  type: "service_account",
  client_email: "cbb-reader@flowstate-test.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
  token_uri: "https://untrusted.example/token", // must never control the destination
});
const allowedFileIds = ["manifest-file-123"];
const connection = {
  accessToken: "test-access",
  allowedFileIds,
  serviceAccountEmail: "cbb-reader@flowstate-test.iam.gserviceaccount.com",
};

describe("durable, read-only Drive authentication", () => {
  it("requests a fresh token using a signed read-only JWT at Google's fixed endpoint", async () => {
    const request = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        expect(url).toBe("https://oauth2.googleapis.com/token");
        expect(init?.redirect).toBe("error");
        const assertion = new URLSearchParams(String(init?.body)).get(
          "assertion",
        )!;
        const [header, claims, signature] = assertion.split(".");
        expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual(
          { alg: "RS256", typ: "JWT" },
        );
        const payload = JSON.parse(Buffer.from(claims, "base64url").toString());
        expect(payload).toEqual({
          iss: connection.serviceAccountEmail,
          scope: "https://www.googleapis.com/auth/drive.readonly",
          aud: String(url),
          iat: 1925424000,
          exp: 1925427600,
        });
        expect(payload.sub).toBeUndefined();
        expect(
          verify(
            "RSA-SHA256",
            Buffer.from(header + "." + claims),
            publicKey,
            Buffer.from(signature, "base64url"),
          ),
        ).toBe(true);
        return Response.json({
          access_token: "test-access",
          token_type: "Bearer",
          expires_in: 3600,
        });
      },
    );
    expect(
      await connectContentDrive({
        credentials,
        allowedFileIds,
        fetch: request,
        now: new Date("2031-01-06T00:00:00Z"),
      }),
    ).toEqual(connection);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed credentials without contacting Google", async () => {
    const request = vi.fn();
    for (const bad of [
      "{}",
      "not-json",
      credentials.replace("service_account", "authorized_user"),
    ])
      await expect(
        connectContentDrive({
          credentials: bad,
          allowedFileIds,
          fetch: request,
        }),
      ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it("does not expose provider errors or credentials", async () => {
    const request = vi.fn(
      async () => new Response("private-provider-response", { status: 401 }),
    );
    await expect(
      connectContentDrive({ credentials, allowedFileIds, fetch: request }),
    ).rejects.toThrow("Google could not authenticate");
  });
  it("rejects incomplete or expired tokens", async () => {
    for (const token of [
      { access_token: "x", token_type: "Bearer", expires_in: 0 },
      { access_token: "x", token_type: "unexpected", expires_in: 3600 },
    ]) {
      await expect(
        connectContentDrive({
          credentials,
          allowedFileIds,
          fetch: vi.fn(async () => Response.json(token)),
        }),
      ).rejects.toThrow("incomplete");
    }
  });
});

function metadata(
  options: { wrongId?: boolean; shortcut?: boolean; canEdit?: boolean } = {},
) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    expect(init?.method ?? "GET").toBe("GET");
    expect(init?.redirect).toBe("error");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-access",
    );
    const id = new URL(String(url)).pathname.split("/").pop()!;
    return Response.json({
      id: options.wrongId ? "another-file" : id,
      name: "Content",
      version: "3",
      trashed: false,
      mimeType: options.shortcut
        ? "application/vnd.google-apps.shortcut"
        : "application/json",
      capabilities: { canDownload: true, canEdit: options.canEdit ?? false },
    });
  });
}
describe("Drive file confinement", () => {
  it("accepts an explicitly connected Viewer file without needing folder access", async () => {
    expect(
      await verifyContentDriveFile("manifest-file-123", connection, metadata()),
    ).toEqual({ id: "manifest-file-123", name: "Content", version: "3" });
  });
  it("refuses unconfigured files before making a request", async () => {
    const request = metadata();
    await expect(
      verifyContentDriveFile("other-manifest-123", connection, request),
    ).rejects.toThrow("has not been connected");
    expect(request).not.toHaveBeenCalled();
  });
  it.each([{ wrongId: true }, { shortcut: true }, { canEdit: true }])(
    "rejects wrong files and wider access %j",
    async (options) => {
      await expect(
        verifyContentDriveFile(
          "manifest-file-123",
          connection,
          metadata(options),
        ),
      ).rejects.toThrow("shared as Viewer");
    },
  );
});
