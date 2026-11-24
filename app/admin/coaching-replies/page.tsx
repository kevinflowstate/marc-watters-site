import Link from "next/link";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getWorkspace } from "@/lib/ops/workspace-feed";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";
import { initials } from "@/lib/initials";

export const dynamic = "force-dynamic";

export default async function CoachingReplies() {
  if (!(await requireAdmin()).authorized) redirect("/login");
  const { coaching = [], checks } = await getWorkspace();
  const complete = checks.filter((c) => ["clients", "messages", "checkins"].includes(c.key)).every((c) => c.ok);
  return (
    <main className="ws ws-page lg-stage">
      <Link href="/admin" className="ws-back ws-focus">
        <Icon name="chevron" size={14} className="ws-back-ic" />
        Dashboard
      </Link>
      <header className="lg-hello lg-rise">
        <div>
          <h1>Marc’s coaching replies</h1>
          <p className="ws-meta mt-1.5">
            {coaching.length
              ? `${coaching.length} ${coaching.length === 1 ? "client is" : "clients are"} waiting on a message reply or check-in review.`
              : "Clients waiting on a message reply or check-in review."}
          </p>
        </div>
      </header>
      {!complete && (
        <div role="status" className="ws-note is-attn">
          <Icon name="alert" size={15} />
          <span>Some client records could not be loaded. Refresh to check again.</span>
        </div>
      )}
      {complete && !coaching.length ? (
        <div className="lg-card lg-rise lg-clear" style={{ "--i": 1 } as CSSProperties}>
          <span className="lg-q-ic" aria-hidden="true" style={{ "--c": "var(--ws-ok)" } as CSSProperties}>
            <Icon name="check" size={16} />
          </span>
          <span>All caught up.</span>
        </div>
      ) : coaching.length ? (
        <section className="lg-card lg-rise" style={{ "--i": 1 } as CSSProperties} aria-label="Clients awaiting a reply">
          <ul className="lg-queue">
            {coaching.map((card, i) => {
              const name = card.title.split(" · ")[0];
              const message = card.signal_ids?.some((id) => id.startsWith("message:"));
              const checkin = card.signal_ids?.some((id) => id.startsWith("checkin:"));
              return (
                <li key={card.id} className="lg-q" style={{ "--i": i } as CSSProperties}>
                  <span className="ws-avatar" style={{ width: 32, height: 32, fontSize: 12 }} aria-hidden="true">
                    {initials(name)}
                  </span>
                  <span className="min-w-0">
                    <span className="lg-q-t block">{name}</span>
                    <span className="lg-q-r block">
                      {[message && "Message waiting", checkin && "Check-in to review"].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="flex flex-wrap justify-end gap-2">
                    {message && (
                      <Link className="lg-link ws-focus" href={"/admin/inbox?client=" + card.url.split("/").at(-1)}>
                        <Icon name="chat" size={12} />
                        Open conversation
                      </Link>
                    )}
                    {checkin && (
                      <Link className="lg-link ws-focus" href={card.url}>
                        <Icon name="checkCircle" size={12} />
                        Review check-ins
                      </Link>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
