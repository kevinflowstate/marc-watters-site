import Image from "next/image";

/**
 * Full-screen branded loader — animated CBB logo with a pulsing halo and a
 * sweeping progress bar. Drop into route-level loading.tsx files.
 *
 * `inline` keeps it inside the portal/admin content column (sidebar stays put);
 * the default fills the viewport (used before the chrome has mounted).
 */
export default function BrandedLoader({
  label = "Loading your portal",
  inline = false,
}: {
  label?: string;
  inline?: boolean;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={
        inline
          ? "flex flex-col items-center justify-center gap-7 py-24"
          : "fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-bg-primary"
      }
    >
      <div className="relative flex items-center justify-center">
        <span className="brand-loader-halo absolute h-28 w-28 rounded-full" aria-hidden />
        <Image
          src="/images/cbb-logo.png"
          alt="CBB"
          width={64}
          height={64}
          priority
          className="brand-loader-logo relative h-14 w-auto"
        />
      </div>

      <div className="h-[3px] w-40 overflow-hidden rounded-full bg-[rgba(34,114,222,0.12)]">
        <div className="brand-loader-bar h-full w-1/2 gradient-accent rounded-full" />
      </div>

      <p className="text-text-muted text-sm tracking-wide">{label}</p>
    </div>
  );
}
