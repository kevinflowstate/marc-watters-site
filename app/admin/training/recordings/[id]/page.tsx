import Link from "next/link";
import { getEnv } from "@/lib/env";
import LegacyRecordingReview from "./LegacyRecordingReview";
export default function RecordingPage() {
  if (getEnv("OPS_LEGACY_LESSON_PIPELINE_ENABLED") === "true")
    return <LegacyRecordingReview />;
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="v2-page-title my-4">Lesson review</h1>
      <p className="text-text-secondary mb-6">
        Open this lesson’s task to find the private preview and its latest
        approval status. Editing and trimming take place in Codex.
      </p>
      <Link href="/admin/work" className="v2-button-primary inline-flex">
        Open tasks & approvals
      </Link>
    </div>
  );
}
