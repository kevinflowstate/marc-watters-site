/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

function getAccentColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "#2272DE",
    "#10B981",
    "#8B5CF6",
    "#F59E0B",
    "#EF4444",
    "#06B6D4",
  ];
  return colors[Math.abs(hash) % colors.length];
}

// Generate deterministic pipe pattern elements as JSX
function PatternElements({ accent, width, height }: { accent: string; width: number; height: number }) {
  const elements: React.ReactNode[] = [];
  let key = 0;

  // Horizontal pipes with node dots
  for (let y = 40; y < height; y += 55) {
    const x1 = (y * 7 + 13) % (width * 0.4);
    const x2 = x1 + 100 + ((y * 3) % (width * 0.3));
    // Pipe line
    elements.push(
      <div key={key++} style={{ position: "absolute", left: x1, top: y, width: x2 - x1, height: 2, background: accent, opacity: 0.12, display: "flex" }} />
    );
    // Start node
    elements.push(
      <div key={key++} style={{ position: "absolute", left: x1 - 3, top: y - 3, width: 6, height: 6, borderRadius: "50%", background: accent, opacity: 0.18, display: "flex" }} />
    );
    // End node
    elements.push(
      <div key={key++} style={{ position: "absolute", left: x2 - 3, top: y - 3, width: 6, height: 6, borderRadius: "50%", background: accent, opacity: 0.18, display: "flex" }} />
    );
  }

  // Vertical connectors
  for (let x = 80; x < width; x += 95) {
    const y1 = (x * 5 + 7) % (height * 0.4) + 40;
    const y2 = y1 + 50 + ((x * 2) % 80);
    elements.push(
      <div key={key++} style={{ position: "absolute", left: x, top: y1, width: 2, height: y2 - y1, background: accent, opacity: 0.08, display: "flex" }} />
    );
  }

  // Corner brackets (L-shapes using two divs)
  for (let i = 0; i < 5; i++) {
    const cx = 120 + (i * 137) % (width - 200);
    const cy = 50 + (i * 83) % (height - 100);
    // Horizontal arm
    elements.push(
      <div key={key++} style={{ position: "absolute", left: cx, top: cy, width: 35, height: 2, background: accent, opacity: 0.1, display: "flex" }} />
    );
    // Vertical arm
    elements.push(
      <div key={key++} style={{ position: "absolute", left: cx + 33, top: cy, width: 2, height: 25, background: accent, opacity: 0.1, display: "flex" }} />
    );
    // Junction dot
    elements.push(
      <div key={key++} style={{ position: "absolute", left: cx - 2, top: cy - 2, width: 5, height: 5, borderRadius: "50%", background: accent, opacity: 0.14, display: "flex" }} />
    );
    // End square
    elements.push(
      <div key={key++} style={{ position: "absolute", left: cx + 30, top: cy + 21, width: 8, height: 8, borderRadius: 2, background: accent, opacity: 0.07, display: "flex" }} />
    );
  }

  return <>{elements}</>;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get("title") || "Module";
  const variant = searchParams.get("variant") || "card";

  const width = variant === "banner" ? 1200 : 800;
  const height = variant === "banner" ? 280 : 450;

  const accent = getAccentColor(title);
  const logoUrl = new URL("/images/cbb-logo.png", request.nextUrl.origin).toString();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#050507",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Construction pipe pattern */}
        <PatternElements accent={accent} width={width} height={height} />

        {/* Radial glow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `radial-gradient(ellipse at 30% 50%, ${accent}18 0%, transparent 65%)`,
            display: "flex",
          }}
        />

        {/* Top accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, transparent 0%, ${accent} 50%, transparent 100%)`,
            opacity: 0.5,
            display: "flex",
          }}
        />

        {/* Logo */}
        <img
          src={logoUrl}
          alt="CBB"
          width={variant === "banner" ? 110 : 90}
          height={variant === "banner" ? 33 : 27}
          style={{
            position: "absolute",
            top: variant === "banner" ? 20 : 30,
            objectFit: "contain",
            opacity: 0.65,
          }}
        />

        {/* Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 60px",
            marginTop: variant === "banner" ? 10 : 20,
          }}
        >
          <div
            style={{
              fontSize: variant === "banner" ? 40 : 46,
              fontWeight: 800,
              color: "#FFFFFF",
              textAlign: "center",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </div>
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position: "absolute",
            bottom: variant === "banner" ? 16 : 24,
            width: 50,
            height: 2,
            background: accent,
            opacity: 0.35,
            borderRadius: 1,
            display: "flex",
          }}
        />
      </div>
    ),
    { width, height }
  );
}
