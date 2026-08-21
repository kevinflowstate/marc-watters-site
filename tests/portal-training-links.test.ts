import { describe, expect, it } from "vitest";
import {
  lessonIdFromTrainingHash,
  trainingLessonAnchorId,
  trainingLessonHref,
} from "../lib/portal-training-links";

describe("portal training lesson links", () => {
  it("preserves the module and exact lesson in the destination", () => {
    expect(trainingLessonHref("module-123", "lesson-456")).toBe(
      "/portal/training/module-123#lesson-lesson-456",
    );
  });

  it("encodes identifiers safely and recovers the lesson identifier", () => {
    const lessonId = "lesson/one # intro";
    const anchor = trainingLessonAnchorId(lessonId);

    expect(trainingLessonHref("module/one", lessonId)).toBe(
      "/portal/training/module%2Fone#lesson-lesson%2Fone%20%23%20intro",
    );
    expect(lessonIdFromTrainingHash(`#${anchor}`)).toBe(lessonId);
  });

  it("ignores unrelated, empty, and malformed hashes", () => {
    expect(lessonIdFromTrainingHash("#overview")).toBeNull();
    expect(lessonIdFromTrainingHash("#lesson-")).toBeNull();
    expect(lessonIdFromTrainingHash("#lesson-%E0%A4%A")).toBeNull();
  });
});
