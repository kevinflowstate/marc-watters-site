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

  // Grid of dots
  for (let x = 25; x < width; x += 35) {
    for (let y = 25; y < height; y += 35) {
      elements.push(
        <div key={key++} style={{ position: "absolute", left: x, top: y, width: 2, height: 2, borderRadius: "50%", background: blue, opacity: 0.12, display: "flex" }} />
      );
    }
  }

  // Horizontal pipes
  for (let y = 40; y < height; y += 44) {
    const x1 = (y * 7 + 13) % (width * 0.25);
    const x2 = x1 + 150 + ((y * 3) % (width * 0.3));
    elements.push(
      <div key={key++} style={{ position: "absolute", left: x1, top: y, width: x2 - x1, height: 2, background: blue, opacity: 0.3, display: "flex" }} />
    );
    elements.push(
      <div key={key++} style={{ position: "absolute", left: x1 - 5, top: y - 5, width: 10, height: 10, borderRadius: "50%", background: blue, opacity: 0.35, display: "flex" }} />
    );
    elements.push(
      <div key={key++} style={{ position: "absolute", left: x2 - 5, top: y - 5, width: 10, height: 10, borderRadius: "50%", background: blue, opacity: 0.35, display: "flex" }} />
    );
  }

  // Vertical connectors
  for (let x = 80; x < width; x += 75) {
    const y1 = (x * 5 + 7) % (height * 0.3) + 25;
    const y2 = y1 + 55 + ((x * 2) % 90);
    elements.push(
      <div key={key++} style={{ position: "absolute", left: x, top: y1, width: 2, height: y2 - y1, background: blue, opacity: 0.25, display: "flex" }} />
    );
  }

  // L-shaped brackets
  for (let i = 0; i < 7; i++) {
    const cx = 60 + (i * 131) % (width - 120);
    const cy = 30 + (i * 59) % (height - 60);
    elements.push(
      <div key={key++} style={{ position: "absolute", left: cx, top: cy, width: 45, height: 2, background: blue, opacity: 0.28, display: "flex" }} />
    );
    elements.push(
      <div key={key++} style={{ position: "absolute", left: cx + 43, top: cy, width: 2, height: 32, background: blue, opacity: 0.28, display: "flex" }} />
    );
    elements.push(
      <div key={key++} style={{ position: "absolute", left: cx - 4, top: cy - 4, width: 8, height: 8, borderRadius: "50%", background: blue, opacity: 0.3, display: "flex" }} />
    );
    elements.push(
      <div key={key++} style={{ position: "absolute", left: cx + 37, top: cy + 26, width: 12, height: 12, borderRadius: 2, border: `2px solid ${blue}`, opacity: 0.22, display: "flex" }} />
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

        {/* Blue glow left */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "radial-gradient(ellipse at 20% 40%, rgba(34,114,222,0.18) 0%, transparent 55%)",
            display: "flex",
          }}
        />

        {/* Blue glow bottom right */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "radial-gradient(ellipse at 80% 75%, rgba(34,114,222,0.12) 0%, transparent 45%)",
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
            background: "linear-gradient(90deg, transparent 5%, #2272DE 50%, transparent 95%)",
            opacity: 0.7,
            display: "flex",
          }}
        />

        {/* CBB text logo */}
        <div
          style={{
            position: "absolute",
            top: variant === "banner" ? 18 : 28,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#2272DE",
              letterSpacing: "0.15em",
              fontFamily: "Montserrat",
              display: "flex",
            }}
          >
            CBB
          </div>
          <div
            style={{
              width: 1,
              height: 14,
              background: "rgba(255,255,255,0.2)",
              display: "flex",
            }}
          />
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.4)",
              fontWeight: 600,
              letterSpacing: "0.05em",
              fontFamily: "Montserrat",
              display: "flex",
            }}
          >
            CONSTRUCTION BUSINESS BLUEPRINT
          </div>
        </div>

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
            opacity: 0.6,
            borderRadius: 2,
            display: "flex",
          }}
        />
      </div>
    ),
    { width, height, fonts: [{ name: "Montserrat", data: fontData, weight: 800, style: "normal" as const }] }
  );
}
