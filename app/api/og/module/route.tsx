/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

async function loadFont() {
  const res = await fetch(
    "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-Y3tcoqK5.ttf"
  );
  return res.arrayBuffer();
}

function PatternElements({ width, height }: { width: number; height: number }) {
  const elements: React.ReactNode[] = [];
  let key = 0;
  const blue = "#2272DE";
  const white = "rgba(255,255,255,0.06)";

  // Grid of faint white dots
  for (let x = 30; x < width; x += 40) {
    for (let y = 30; y < height; y += 40) {
      elements.push(
        <div key={key++} style={{ position: "absolute", left: x, top: y, width: 1.5, height: 1.5, borderRadius: "50%", background: "white", opacity: 0.04, display: "flex" }} />
      );
    }
  }

  // Horizontal blue pipes - bolder
  for (let y = 45; y < height; y += 48) {
    const x1 = (y * 7 + 13) % (width * 0.3);
    const x2 = x1 + 140 + ((y * 3) % (width * 0.3));
    elements.push(
      <div key={key++} style={{ position: "absolute", left: x1, top: y, width: x2 - x1, height: 2, background: blue, opacity: 0.2, display: "flex" }} />
    );
    // Start node
    elements.push(
      <div key={key++} style={{ position: "absolute", left: x1 - 4, top: y - 4, width: 8, height: 8, borderRadius: "50%", background: blue, opacity: 0.25, display: "flex" }} />
    );
    // End node
    elements.push(
      <div key={key++} style={{ position: "absolute", left: x2 - 4, top: y - 4, width: 8, height: 8, borderRadius: "50%", background: blue, opacity: 0.25, display: "flex" }} />
    );
  }

  // Vertical connectors
  for (let x = 100; x < width; x += 85) {
    const y1 = (x * 5 + 7) % (height * 0.35) + 30;
    const y2 = y1 + 50 + ((x * 2) % 80);
    elements.push(
      <div key={key++} style={{ position: "absolute", left: x, top: y1, width: 2, height: y2 - y1, background: blue, opacity: 0.15, display: "flex" }} />
    );
  }

  // L-shaped brackets - larger
  for (let i = 0; i < 6; i++) {
    const cx = 80 + (i * 143) % (width - 160);
    const cy = 35 + (i * 67) % (height - 70);
    // Horizontal arm
    elements.push(
      <div key={key++} style={{ position: "absolute", left: cx, top: cy, width: 40, height: 2, background: blue, opacity: 0.18, display: "flex" }} />
    );
    // Vertical arm
    elements.push(
      <div key={key++} style={{ position: "absolute", left: cx + 38, top: cy, width: 2, height: 28, background: blue, opacity: 0.18, display: "flex" }} />
    );
    // Junction dot
    elements.push(
      <div key={key++} style={{ position: "absolute", left: cx - 3, top: cy - 3, width: 6, height: 6, borderRadius: "50%", background: blue, opacity: 0.22, display: "flex" }} />
    );
    // End square
    elements.push(
      <div key={key++} style={{ position: "absolute", left: cx + 34, top: cy + 24, width: 10, height: 10, borderRadius: 2, border: `1.5px solid ${blue}`, opacity: 0.15, display: "flex" }} />
    );
  }

  // White subtle horizontal rules
  for (let y = 80; y < height - 40; y += 120) {
    elements.push(
      <div key={key++} style={{ position: "absolute", left: 0, top: y, width, height: 1, background: white, display: "flex" }} />
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

  const logoUrl = new URL("/images/cbb-logo.png", request.nextUrl.origin).toString();
  const fontData = await loadFont();

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
          backgroundColor: "#070A10",
          position: "relative",
          overflow: "hidden",
          fontFamily: "Montserrat",
        }}
      >
        {/* Blueprint pattern */}
        <PatternElements width={width} height={height} />

        {/* Radial glow - stronger */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "radial-gradient(ellipse at 25% 45%, rgba(34,114,222,0.14) 0%, transparent 60%)",
            display: "flex",
          }}
        />

        {/* Second glow bottom right */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "radial-gradient(ellipse at 80% 80%, rgba(34,114,222,0.08) 0%, transparent 50%)",
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
            background: "linear-gradient(90deg, transparent 10%, #2272DE 50%, transparent 90%)",
            opacity: 0.6,
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
            opacity: 0.7,
          }}
        />

        {/* Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 50px",
            marginTop: variant === "banner" ? 10 : 20,
          }}
        >
          <div
            style={{
              fontSize: variant === "banner" ? 42 : 48,
              fontWeight: 800,
              color: "#FFFFFF",
              textAlign: "center",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              fontFamily: "Montserrat",
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
            width: 60,
            height: 3,
            background: "#2272DE",
            opacity: 0.5,
            borderRadius: 2,
            display: "flex",
          }}
        />
      </div>
    ),
    { width, height, fonts: [{ name: "Montserrat", data: fontData, weight: 800, style: "normal" as const }] }
  );
}
