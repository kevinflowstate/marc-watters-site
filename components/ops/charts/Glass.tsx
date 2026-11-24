"use client";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

/* Liquid glass chart kit. Pure SVG and CSS (app/admin/glass.css); no chart library. */

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(q.matches);
    sync();
    q.addEventListener("change", sync);
    return () => q.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/** Eases a number from its previous value to `value`. */
export function useCountUp(value: number | null | undefined, duration = 1100) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (value == null || !Number.isFinite(value)) return;
    const length = reduced ? 0 : duration;
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = length ? Math.min(1, (now - start) / length) : 1;
      const eased = 1 - Math.pow(1 - t, 4);
      setShown(origin + (value - origin) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);
  return shown;
}

export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString("en-GB"),
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const shown = useCountUp(value);
  return (
    <span aria-label={format(value)}>
      <span aria-hidden="true">{format(shown)}</span>
    </span>
  );
}

export function GlassCard({
  title,
  sub,
  action,
  children,
  className = "",
  index = 0,
  lift = false,
  as: Tag = "section",
  ...rest
}: {
  title?: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  index?: number;
  lift?: boolean;
  as?: "section" | "div" | "article";
  id?: string;
  "aria-label"?: string;
}) {
  return (
    <Tag
      {...rest}
      className={`lg-card lg-rise ${lift ? "is-lift" : ""} ${className}`}
      style={{ "--i": index } as CSSProperties}
    >
      {(title || action) && (
        <div className="lg-card-head">
          <div className="min-w-0">
            {title && <h2>{title}</h2>}
            {sub && <p className="lg-sub">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </Tag>
  );
}

/* ---------- Ring ---------- */
export function Ring({
  value,
  max = 100,
  size = 112,
  stroke = 10,
  color = "var(--ws-accent-ink)",
  label,
  caption,
}: {
  value: number | null;
  max?: number;
  size?: number;
  stroke?: number;
  color?: string;
  label: ReactNode;
  caption?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const f = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(f);
  }, []);
  const fraction = value == null || max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  const gid = useId().replace(/:/g, "");
  return (
    <div className="lg-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={"rg" + gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle className="lg-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="lg-ring-val"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke={`url(#rg${gid})`}
          strokeDasharray={c}
          strokeDashoffset={ready ? c * (1 - fraction) : c}
        />
      </svg>
      <div className="lg-ring-label">
        <div>
          <b>{label}</b>
          {caption && <span>{caption}</span>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Multi-segment donut ---------- */
export function Donut({
  segments,
  size = 120,
  stroke = 12,
  label,
  caption,
}: {
  segments: { key: string; value: number; color: string }[];
  size?: number;
  stroke?: number;
  label: ReactNode;
  caption?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((n, s) => n + s.value, 0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const f = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(f);
  }, []);
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <div className="lg-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="lg-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        {total > 0 &&
          segments.map((s) => {
            const len = (s.value / total) * c;
            const el = s.value > 0 && (
              <circle
                key={s.key}
                className="lg-ring-val"
                cx={size / 2}
                cy={size / 2}
                r={r}
                strokeWidth={stroke}
                stroke={s.color}
                strokeLinecap="butt"
                strokeDasharray={`${ready ? Math.max(0, len - gap) : 0} ${c}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="lg-ring-label">
        <div>
          <b>{label}</b>
          {caption && <span>{caption}</span>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Funnel ---------- */
export function Funnel({
  rows,
}: {
  rows: { label: string; value: number | null | undefined; color?: string; note?: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0));
  return (
    <dl className="lg-funnel">
      {rows.map((r, i) => (
        <div className="lg-funnel-row" key={r.label}>
          <dt title={r.note}>{r.label}</dt>
          <dd>{r.value == null ? <span className="lg-await">Awaiting source</span> : <CountUp value={r.value} />}</dd>
          <div className="lg-funnel-bar" aria-hidden="true">
            <i
              style={
                {
                  "--w": r.value == null ? "0%" : `${Math.max(r.value > 0 ? 3 : 0, (100 * r.value) / max)}%`,
                  "--c": r.color,
                  "--i": i,
                } as CSSProperties
              }
            />
          </div>
        </div>
      ))}
    </dl>
  );
}

/* ---------- Area chart ---------- */
type Point = { label: string; value: number; detail?: string };
export function AreaChart({
  points,
  height = 190,
  format,
  ariaLabel,
}: {
  points: Point[];
  height?: number;
  format: (n: number) => string;
  ariaLabel: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pad = { t: 14, r: 14, b: 26, l: 48 };
  const geo = useMemo(() => {
    const values = points.map((p) => p.value);
    const hi = Math.max(0, ...values);
    const lo = Math.min(0, ...values);
    const step = niceStep((hi - lo || 1) / 3);
    const top = Math.ceil(hi / step) * step || step;
    const bottom = Math.floor(lo / step) * step;
    const w = width - pad.l - pad.r;
    const h = height - pad.t - pad.b;
    const x = (i: number) => pad.l + (points.length <= 1 ? w / 2 : (i * w) / (points.length - 1));
    const y = (v: number) => pad.t + h - ((v - bottom) / (top - bottom || 1)) * h;
    const ticks: number[] = [];
    for (let v = bottom; v <= top + step / 2; v += step) ticks.push(v);
    const xy = points.map((p, i) => [x(i), y(p.value)] as const);
    const line = smooth(xy);
    const area = xy.length
      ? `${line} L ${xy.at(-1)![0]} ${y(Math.max(0, bottom))} L ${xy[0][0]} ${y(Math.max(0, bottom))} Z`
      : "";
    return { x, y, ticks, xy, line, area, w };
  }, [points, width, height, pad.l, pad.r, pad.t, pad.b]);
  if (!points.length) return null;
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(geo.w / 70))));
  function move(clientX: number) {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    const rel = clientX - box.left - pad.l;
    const i = Math.round((rel / geo.w) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }
  const last = geo.xy.at(-1)!;
  const h = hover == null ? null : geo.xy[hover];
  return (
    <div
      ref={wrap}
      className="lg-chart"
      onPointerMove={(e) => move(e.clientX)}
      onPointerLeave={() => setHover(null)}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={"af" + gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ws-accent-ink)" stopOpacity="0.34" />
            <stop offset="65%" stopColor="var(--ws-accent)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--ws-accent)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={"al" + gid} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--ws-accent)" />
            <stop offset="100%" stopColor="var(--ws-accent-ink)" />
          </linearGradient>
        </defs>
        {geo.ticks.map((t) => (
          <g key={t}>
            <line className="lg-gridline" x1={pad.l} x2={width - pad.r} y1={Math.round(geo.y(t)) + 0.5} y2={Math.round(geo.y(t)) + 0.5} />
            <text className="lg-axis" x={pad.l - 8} y={geo.y(t) + 4} textAnchor="end">
              {compact(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i === points.length - 1 || (i % every === 0 && points.length - 1 - i >= every * 0.75) ? (
            <text key={p.label + i} className="lg-axis" x={geo.x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}>
              {p.label}
            </text>
          ) : null,
        )}
        <path className="lg-area" d={geo.area} fill={`url(#af${gid})`} />
        <path className="lg-line" d={geo.line} pathLength={1} style={{ stroke: `url(#al${gid})` }} />
        <circle className="lg-end-halo" cx={last[0]} cy={last[1]} r={4} />
        <circle className="lg-end" cx={last[0]} cy={last[1]} r={3.5} />
        {h && (
          <g>
            <line className="lg-guide" x1={h[0]} x2={h[0]} y1={pad.t} y2={height - pad.b} />
            <circle className="lg-point" cx={h[0]} cy={h[1]} r={4.5} />
          </g>
        )}
      </svg>
      {h && hover != null && (
        <div className="lg-tip" style={{ left: Math.min(Math.max(h[0], 70), width - 70), top: h[1] - 6 }}>
          <b>{format(points[hover].value)}</b>
          <span>{points[hover].detail ?? points[hover].label}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Bars (daily) ---------- */
export function Bars({
  points,
  height = 120,
  format,
  ariaLabel,
  highlightFrom = 0,
}: {
  points: Point[];
  height?: number;
  format: (n: number) => string;
  ariaLabel: string;
  highlightFrom?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(160, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!points.length) return null;
  const b = 20;
  const hi = Math.max(1, ...points.map((p) => Math.abs(p.value)));
  const hasNeg = points.some((p) => p.value < 0);
  const base = hasNeg ? (height - b) / 2 : height - b;
  const span = hasNeg ? (height - b) / 2 - 4 : height - b - 6;
  const slot = width / points.length;
  const bw = Math.max(4, Math.min(26, slot * 0.58));
  return (
    <div ref={wrap} className="lg-chart" onPointerLeave={() => setHover(null)}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={"bf" + gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ws-accent-ink)" />
            <stop offset="100%" stopColor="var(--ws-accent)" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <line className="lg-gridline" x1={0} x2={width} y1={Math.round(base) + 0.5} y2={Math.round(base) + 0.5} />
        {points.map((p, i) => {
          const hgt = Math.max(p.value === 0 ? 0 : 2, (Math.abs(p.value) / hi) * span);
          const x = i * slot + (slot - bw) / 2;
          const neg = p.value < 0;
          const dim = i < highlightFrom;
          return (
            <g key={p.label + i} onPointerEnter={() => setHover(i)}>
              <rect x={i * slot} y={0} width={slot} height={height - b} fill="transparent" />
              {p.value === 0 ? (
                <rect x={x} y={base - 1} width={bw} height={2} rx={1} fill="var(--lg-track)" />
              ) : (
                <rect
                  className={`lg-bar ${neg ? "is-neg" : ""}`}
                  style={{ animationDelay: 200 + i * 45 + "ms" }}
                  x={x}
                  y={neg ? base : base - hgt}
                  width={bw}
                  height={hgt}
                  rx={Math.min(6, bw / 2)}
                  fill={neg ? "var(--ws-bad)" : `url(#bf${gid})`}
                  opacity={hover == null ? (dim ? 0.45 : 1) : hover === i ? 1 : 0.4}
                />
              )}
              <text className="lg-axis" x={i * slot + slot / 2} y={height - 5} textAnchor="middle">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="lg-tip" style={{ left: Math.min(Math.max(hover * slot + slot / 2, 64), width - 64), top: 18 }}>
          <b>{format(points[hover].value)}</b>
          <span>{points[hover].detail ?? points[hover].label}</span>
        </div>
      )}
    </div>
  );
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
function compact(n: number) {
  const a = Math.abs(n);
  if (a >= 1000) return (n / 1000).toFixed(a >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
}
/** Monotone cubic path so a cumulative line never overshoots between days. */
function smooth(pts: readonly (readonly [number, number])[]) {
  if (pts.length < 2) return pts.length ? `M ${pts[0][0]} ${pts[0][1]}` : "";
  const n = pts.length;
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i], b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C ${pts[i][0] + h} ${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h} ${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]} ${pts[i + 1][1]}`;
  }
  return d;
}
