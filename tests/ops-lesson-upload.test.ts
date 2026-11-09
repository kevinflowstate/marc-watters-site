import { describe, expect, it, vi } from "vitest";
import { prepareLessonTransfer, type LessonUploadDeps } from "../lib/ops/lesson-upload";

function deps(): LessonUploadDeps {
  return {
    projectRef: () => "abcdefghijklmnopqrst",
    bucket: vi.fn(async () => ({ public: false, file_size_limit: null })),
    exists: vi.fn(async () => false),
    uploadToken: vi.fn(async () => "temporary-path-token"),
    readUrl: vi.fn(async () => "private-signed-url"),
  };
}
const input = { action: "upload", sha256: "a".repeat(64), bytes: 300 * 1024 ** 2 };
describe("private complete-lesson transfer grants", () => {
  it("supports private large-file transfer without claiming portal verification or approval", async () => {
    const d = deps();
    const result = await prepareLessonTransfer(input, d);
    expect(result).toMatchObject({ storage_path: `approved/${input.sha256}.mp4`, bytes: input.bytes,
      approval: null, publication_enabled: false, portal_size_supported: true });
    expect(result).not.toHaveProperty("verification_id");
    expect(d.uploadToken).toHaveBeenCalledWith(`approved/${input.sha256}.mp4`);
    expect(d.readUrl).not.toHaveBeenCalled();
  });
  it("refuses public storage and configured size limits before making a grant", async () => {
    const d = deps();
    d.bucket = async () => ({ public: true, file_size_limit: null });
    await expect(prepareLessonTransfer(input, d)).rejects.toThrow("remain private");
    d.bucket = async () => ({ public: false, file_size_limit: 256 * 1024 ** 2 });
    await expect(prepareLessonTransfer(input, d)).rejects.toThrow("configured file limit");
    expect(d.uploadToken).not.toHaveBeenCalled();
  });
  it("refuses overwrites and readback before a completed upload", async () => {
    const d = deps();
    d.exists = async () => true;
    await expect(prepareLessonTransfer(input, d)).rejects.toThrow("already exists");
    expect(d.uploadToken).not.toHaveBeenCalled();
    d.exists = async () => false;
    await expect(prepareLessonTransfer({ ...input, action: "readback" }, d)).rejects.toThrow("Complete the private upload");
    expect(d.readUrl).not.toHaveBeenCalled();
  });
  it("grants a readback only for the derived existing path", async () => {
    const d = deps(); d.exists = async () => true;
    const result = await prepareLessonTransfer({ ...input, action: "readback" }, d);
    expect(result).toHaveProperty("readback_url");
    expect(result).not.toHaveProperty("upload_token");
    expect(d.readUrl).toHaveBeenCalledWith(`approved/${input.sha256}.mp4`);
  });
  it("refuses arbitrary paths, invalid sizes and client approval fields", async () => {
    for (const supplied of [{ ...input, bytes: 0 }, { ...input, bytes: 4 * 1024 ** 3 + 1 },
      { ...input, bytes: 1.5 }, { ...input, storage_path: "source/secret.mp4" },
      { ...input, approval: true }, { ...input, sha256: "incorrect" }]) {
      const d = deps();
      await expect(prepareLessonTransfer(supplied, d)).rejects.toThrow();
      expect(d.bucket).not.toHaveBeenCalled();
    }
  });
});
