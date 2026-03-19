/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// Load Montserrat Bold for title text
async function loadFont() {
  const res = await fetch(
    "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-Y3tcoqK5.ttf"
  );
  return res.arrayBuffer();
}

function PatternElements({ width, height }: { width: number; height: number }) {
  const elements: React.ReactNode[] = [];
  let key = 0;
  const color = "#2272DE";

  // Horizontal pipes
  for (let y = 35; y < height; y += 50) {
    const x1 = (y * 7 + 13) % (width * 0.35);
    const x2 = x1 + 120 + ((y * 3) % (width * 0.25));
    elements.push(
      <div key={key++} style={{ position: "absolute", left: x1, top: y, width: x2 - x1, height: 1.5, background: color, opacity: 0.1, display: "flex" }} />
    );
    elements.push(
      <div key={key++} style={{ position: "absolute", left: x1 - 2.5, top: y - 2.5, width: 5, height: 5, borderRadius: "50%", background: color, opacity: 0.15, display: "flex" }} />
    );
    elements.push(
      <div key={key++} style={{ position: "absolute", left: x2 - 2.5, top: y - 2.5, width: 5, height: 5, borderRadius: "50%", background: color, opacity: 0.15, display: "flex" }} />
    );
  }

  // Vertical connectors
  for (let x = 90; x < width; x += 100) {
    const y1 = (x * 5 + 7) % (height * 0.35) + 30;
    const y2 = y1 + 45 + ((x * 2) % 70);
    elements.push(
      <div key={key++} style={{ position: "absolute", left: x, top: y1, width: 1.5, height: y2 - y1, background: color, opacity: 0.07, display: "flex" }} />
    );
  }

  // L-shaped brackets
  for (let i = 0; i < 5; i++) {
    const cx = 100 + (i * 151) % (width - 180);
    const cy = 40 + (i * 79) % (height - 80);
    elements.push(
      <div key={key++} style={{ position: "absolute", left: cx, top: cy, width: 30, height: 1.5, background: color, opacity: 0.08, display: "flex" }} />
    );
    elements.push(
      <div key={key++} style={{ position: "absolute", left: cx + 28.5, top: cy, width: 1.5, height: 22, background: color, opacity: 0.08, display: "flex" }} />
    );
    elements.push(
      <div key={key++} style={{ position: "absolute", left: cx - 2, top: cy - 2, width: 4, height: 4, borderRadius: "50%", background: color, opacity: 0.12, display: "flex" }} />
    );
    elements.push(
      <div key={key++} style={{ position: "absolute", left: cx + 26, top: cy + 18, width: 6, height: 6, borderRadius: 1, background: color, opacity: 0.06, display: "flex" }} />
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
          backgroundColor: "#050507",
          position: "relative",
          overflow: "hidden",
          fontFamily: "Montserrat",
        }}
      >
        {/* Blue pipe pattern */}
        <PatternElements width={width} height={height} />

        {/* Subtle radial glow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "radial-gradient(ellipse at 30% 50%, rgba(34,114,222,0.08) 0%, transparent 65%)",
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
            background: "linear-gradient(90deg, transparent 0%, #2272DE 50%, transparent 100%)",
            opacity: 0.45,
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
            opacity: 0.6,
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
            width: 50,
            height: 2,
            background: "#2272DE",
            opacity: 0.3,
            borderRadius: 1,
            display: "flex",
          }}
        />
      </div>
    ),
    {
      width,
      height,
      fonts: [
        {
          name: "Montserrat",
          data: fontData,
          weight: 800,
          style: "normal",
        },
      ],
    }
  );
}
