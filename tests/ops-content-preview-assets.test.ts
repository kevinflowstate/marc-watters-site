import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  bundledContentPreview,
  contentPreviewHashes,
} from "../lib/ops/content-preview-assets";
const origin =
  "https://marc-watters-site-16pby9lsy-kevinflowstate-7682s-projects.vercel.app";
describe("immutable content preview mirrors", () => {
  it("serves only byte-identical bundled assets for the known proposal URLs", () => {
    for (const sha256 of contentPreviewHashes) {
      const path = `/ops-drafts/cbb-busy-profitable-v2/${sha256}.png`;
      expect(
        createHash("sha256")
          .update(readFileSync(`public${path}`))
          .digest("hex"),
      ).toBe(sha256);
      expect(bundledContentPreview({ sha256, url: origin + path })).toBe(path);
      expect(
        bundledContentPreview({
          sha256,
          url: "https://elsewhere.example" + path,
        }),
      ).toBeNull();
      expect(
        bundledContentPreview({ sha256, url: origin + path + "?v=2" }),
      ).toBeNull();
    }
    expect(
      bundledContentPreview({
        sha256: "a".repeat(64),
        url: origin + "/other.png",
      }),
    ).toBeNull();
  });
});
