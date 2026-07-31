import { describe, expect, it } from "vitest";
import {
  automationAssetsFromMetadata,
  automationStagingPath,
  automationStoragePath,
  clientVisibleAutomationAssetIds,
  parseAutomationIntakeRequest,
  setAutomationAssetVisibility,
  upsertReportAssetMetadata,
  withAutomationAssets,
} from "../lib/growth-engine-automation";

function pdfBytes(label = "fixture") {
  return new TextEncoder().encode(`%PDF-1.7\n${label}\n%%EOF`).buffer;
}

describe("Growth Engine automated report intake", () => {
  it("accepts multipart reports and preserves chosen file visibility", async () => {
    const form = new FormData();
    form.set("payload", JSON.stringify({
      sourceKey: "claude:2026-08-03",
      title: "Weekly report",
      attachments: [{
        fileName: "weekly-report.pdf",
        title: "Client performance report",
        visibility: "client",
      }],
    }));
    form.append("files", new File([pdfBytes()], "weekly-report.pdf", { type: "application/pdf" }));

    const result = await parseAutomationIntakeRequest(new Request("https://portal.example/api/intake", {
      method: "POST",
      body: form,
    }));

    expect(result.attachmentsProvided).toBe(true);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]).toMatchObject({
      fileName: "weekly-report.pdf",
      title: "Client performance report",
      contentType: "application/pdf",
      visibility: "client",
    });
  });

  it("accepts base64 JSON files and rejects disguised uploads", async () => {
    const valid = await parseAutomationIntakeRequest(new Request("https://portal.example/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attachments: [{
          fileName: "evidence.pdf",
          visibility: "internal",
          base64: Buffer.from(pdfBytes()).toString("base64"),
        }],
      }),
    }));
    expect(valid.attachments[0].visibility).toBe("internal");

    await expect(parseAutomationIntakeRequest(new Request("https://portal.example/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attachments: [{
          fileName: "not-really.pdf",
          base64: Buffer.from("<html>unsafe</html>").toString("base64"),
        }],
      }),
    }))).rejects.toThrow("does not match its file extension");

    await expect(parseAutomationIntakeRequest(new Request("https://portal.example/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attachments: [{
          fileName: "binary.csv",
          base64: Buffer.from([0, 1, 2, 3]).toString("base64"),
        }],
      }),
    }))).rejects.toThrow("does not match its file extension");
  });

  it("creates deterministic retry-safe storage paths", async () => {
    const result = await parseAutomationIntakeRequest(new Request("https://portal.example/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attachments: [{
          fileName: "weekly-report.pdf",
          base64: Buffer.from(pdfBytes("same-content")).toString("base64"),
        }],
      }),
    }));
    const first = automationStoragePath("client-id", "source-key", result.attachments[0], 0);
    const retry = automationStoragePath("client-id", "source-key", result.attachments[0], 0);

    expect(first).toBe(retry);
    expect(first).toMatch(/^internal\/client-id\/automation\/[a-f0-9]{24}\/01-[a-f0-9]{32}\.pdf$/);
    expect(automationStagingPath("client-id", "source-key", "weekly-report.pdf"))
      .toMatch(/^internal\/client-id\/automation\/[a-f0-9]{24}\/staged\/[a-f0-9]{32}\.pdf$/);
  });

  it("accepts a signed-upload reference without trusting an arbitrary path", async () => {
    const result = await parseAutomationIntakeRequest(new Request("https://portal.example/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attachments: [{
          uploadedPath: "internal/client/automation/source/staged/file.pdf",
          fileName: "weekly-report.pdf",
          title: "Weekly performance report",
          visibility: "client",
        }],
      }),
    }));

    expect(result.attachments).toEqual([]);
    expect(result.stagedAttachments).toEqual([{
      uploadedPath: "internal/client/automation/source/staged/file.pdf",
      fileName: "weekly-report.pdf",
      title: "Weekly performance report",
      visibility: "client",
    }]);
  });

  it("tracks client-on-publish visibility in report metadata", () => {
    const metadata = withAutomationAssets({}, [{
      id: "asset-1",
      storagePath: "internal/client/automation/source/file.pdf",
      title: "Weekly report",
      visibility: "client",
    }, {
      id: "asset-2",
      storagePath: "internal/client/automation/source/evidence.csv",
      title: "Internal evidence",
      visibility: "internal",
    }], "claude", "week-1");

    expect(clientVisibleAutomationAssetIds(metadata)).toEqual(["asset-1"]);
    const withManualAsset = upsertReportAssetMetadata(metadata, {
      id: "asset-3",
      storagePath: "internal/client/manual/file.pdf",
      title: "Manually added report file",
      visibility: "client",
    });
    expect(clientVisibleAutomationAssetIds(withManualAsset)).toEqual(["asset-1", "asset-3"]);
    const privateMetadata = setAutomationAssetVisibility(metadata, "asset-1", "internal");
    expect(clientVisibleAutomationAssetIds(privateMetadata)).toEqual([]);
    expect(automationAssetsFromMetadata(privateMetadata)).toHaveLength(2);
  });
});
