/**
 * Shimmer skeleton primitive — branded CBB-blue sweep on a card-toned base.
 * Replaces the repeated `animate-pulse bg-[rgba(255,255,255,0.06)]` blocks.
 *
 * <Skeleton className="h-4 w-32" />            // single bar
 * <SkeletonText lines={3} />                    // stacked text lines
 * <SkeletonCard />                              // generic card placeholder
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-lg ${className}`} />;
}

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? "w-1/2" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-5 space-y-3 ${className}`}
    >
      <Skeleton className="h-5 w-3/4" />
      <SkeletonText lines={2} />
    </div>
  );
}
