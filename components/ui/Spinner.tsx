type SpinnerSize = "xs" | "sm" | "md" | "lg";

const SIZES: Record<SpinnerSize, { box: number; border: number }> = {
  xs: { box: 14, border: 2 },
  sm: { box: 18, border: 2 },
  md: { box: 28, border: 3 },
  lg: { box: 44, border: 4 },
};

/**
 * Branded loading spinner — CBB blue ring on a faint track.
 * Use inline (buttons, small panels). For full-page loads use <BrandedLoader />.
 */
export default function Spinner({
  size = "md",
  className = "",
  label = "Loading",
}: {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}) {
  const { box, border } = SIZES[size];
  return (
    <span
      role="status"
      aria-label={label}
      className={`brand-spinner inline-block align-middle ${className}`}
      style={{ width: box, height: box, borderWidth: border }}
    />
  );
}
