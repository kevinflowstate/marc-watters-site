import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getWorkspace } from "@/lib/ops/workspace-feed";

export const dynamic = "force-dynamic";

export default async function CoachingReplies() {
  if (!(await requireAdmin()).authorized) redirect("/login");
  const { coaching = [], checks } = await getWorkspace();
  const complete = checks.filter(c => ["clients", "messages", "checkins"].includes(c.key)).every(c => c.ok);
  return <main className="ws-page">
    <Link href="/admin" className="ws-link">Back to Dashboard</Link>
    <h1 className="ws-title my-4">Marc’s coaching replies</h1>
    {!complete && <p role="status" className="ws-note is-attn">Some client records could not be loaded. Refresh to check again.</p>}
    {complete && !coaching.length && <p>All caught up.</p>}
    <ul className="ws-panel divide-y">
      {coaching.map(card => <li key={card.id} className="p-4">
        <strong>{card.title.split(" · ")[0]}</strong>
        <div className="flex flex-wrap gap-4 mt-2">
          {card.signal_ids?.some(id => id.startsWith("message:")) && <Link className="ws-link" href={'/admin/inbox?client=' + card.url.split('/').at(-1)}>Open conversation</Link>}
          {card.signal_ids?.some(id => id.startsWith("checkin:")) && <Link className="ws-link" href={card.url}>Review check-ins</Link>}
        </div>
      </li>)}
    </ul>
  </main>;
}
