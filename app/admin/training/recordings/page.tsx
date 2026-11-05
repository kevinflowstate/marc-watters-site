import Link from "next/link";
export default function LessonUpdates() {
  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/admin/training" className="text-accent-bright">
        ← Training
      </Link>
      <h1 className="v2-page-title my-4">Lesson preparation</h1>
      <p className="text-text-secondary mb-6">
        Codex prepares the edited lesson and saves a private preview in Drive.
        Eimear can review it there or in Codex. Your workspace shows the lesson,
        its review link and what needs to happen next.
      </p>
      <div className="v2-surface p-6">
        <h2 className="font-heading font-bold text-xl mb-3">
          Review once. Track it here.
        </h2>
        <p className="text-text-secondary mb-5">
          An approved lesson stays on the work list until it has been added to
          Training. Approval and publication are shown as separate steps.
        </p>
        <Link href="/admin/work" className="v2-button-primary inline-flex">
          Open tasks & approvals
        </Link>
      </div>
    </div>
  );
}
