import type { ReactNode } from "react";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";

/*
 * Workspace-style drop-ins for components/ui/PortalState (restyle batch 5b).
 * Same props and the same roles as InlineNotice, EmptyState, PageSkeleton and ProgressSummary,
 * so a page can swap the import without any change in behaviour. PortalState itself is left
 * alone because pages outside this batch still use it.
 */

type NoticeTone = "info" | "success" | "warning" | "error";

const noticeClass: Record<NoticeTone, string> = {
  info: "is-info",
  success: "is-ok",
  warning: "is-attn",
  error: "is-bad",
};

const noticeIcon: Record<NoticeTone, string> = {
  info: "info",
  success: "checkCircle",
  warning: "alert",
  error: "alert",
};

export function WsNotice({
  children,
  tone = "info",
  action,
  className = "",
}: {
  children: ReactNode;
  tone?: NoticeTone;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`ws-note ws-notice ${noticeClass[tone]} ${className}`}>
      <Icon name={noticeIcon[tone]} size={15} />
      <div className="ws-notice-body">{children}</div>
      {action && <div className="ws-notice-act">{action}</div>}
    </div>
  );
}

export function WsEmpty({
  icon,
  title,
  description,
  action,
  compact = false,
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`ws-empty ${compact ? "" : "ws-empty-lg"} ${className}`}>
      {icon && <span className="ws-empty-glyph ws-empty-ic">{icon}</span>}
      <h2 className="ws-empty-h">{title}</h2>
      <p>{description}</p>
      {action && <div className="ws-empty-act">{action}</div>}
    </div>
  );
}

export function WsPageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="ws ws-page" aria-label="Loading page" role="status">
      <div className="ws-ph">
        <div className="min-w-0" style={{ display: "grid", gap: 8 }}>
          <span className="ws-skel" style={{ width: 220, height: 22 }} />
          <span className="ws-skel" style={{ width: 320, maxWidth: "80vw", height: 12 }} />
        </div>
      </div>
      <div className="ws-panel">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="ws-skrow">
            <span className="ws-skel" style={{ width: 14, height: 14, borderRadius: "50%" }} />
            <span className="ws-skel" style={{ width: `${38 + ((index * 13) % 30)}%`, height: 10 }} />
            <span className="flex-1" />
            <span className="ws-skel" style={{ width: 54, height: 10 }} />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function WsProgress({
  value,
  label,
  detail,
}: {
  value: number;
  label: string;
  detail: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="ws-panel ws-progress">
      <div className="ws-progress-top">
        <div className="min-w-0">
          <div className="ws-h2">{label}</div>
          <div className="ws-caption">{detail}</div>
        </div>
        <div className="ws-progress-n">{safeValue}%</div>
      </div>
      <span className="ws-bar">
        <i style={{ width: `${safeValue}%` }} />
      </span>
    </div>
  );
}
