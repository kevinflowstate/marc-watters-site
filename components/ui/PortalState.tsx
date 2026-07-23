import type { ReactNode } from "react";

type NoticeTone = "info" | "success" | "warning" | "error";

const noticeTone: Record<NoticeTone, string> = {
  info: "border-accent/25 bg-accent/8 text-blue-100",
  success: "border-emerald-500/25 bg-emerald-500/8 text-emerald-100",
  warning: "border-amber-500/25 bg-amber-500/8 text-amber-100",
  error: "border-red-500/25 bg-red-500/8 text-red-100",
};

const noticeDot: Record<NoticeTone, string> = {
  info: "bg-accent-bright",
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  error: "bg-red-400",
};

export function InlineNotice({
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
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start justify-between gap-4 rounded-[var(--cbb-radius-md)] border px-4 py-3 text-sm ${noticeTone[tone]} ${className}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${noticeDot[tone]}`} />
        <div className="min-w-0 leading-relaxed">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function EmptyState({
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
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "px-5 py-8" : "min-h-64 px-6 py-12"} ${className}`}>
      {icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-accent/20 bg-accent/8 text-accent-bright">
          {icon}
        </div>
      )}
      <h2 className="v2-section-title">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-6" aria-label="Loading page" role="status">
      <div className="space-y-3">
        <div className="h-3 w-24 rounded bg-white/8" />
        <div className="h-9 w-56 max-w-[70%] rounded-lg bg-white/8" />
        <div className="h-4 w-80 max-w-full rounded bg-white/6" />
      </div>
      <div className="v2-surface overflow-hidden">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-white/[0.05] p-5 last:border-0">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-white/7" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="h-4 w-40 max-w-[55%] rounded bg-white/8" />
              <div className="h-3 w-72 max-w-[85%] rounded bg-white/5" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function ProgressSummary({
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
    <div className="v2-surface px-4 py-4 sm:px-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-text-primary">{label}</div>
          <div className="mt-1 text-xs text-text-muted">{detail}</div>
        </div>
        <div className="font-heading text-xl font-bold tabular-nums text-text-primary">{safeValue}%</div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
