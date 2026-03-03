export default function AdminBackground() {
  return (
    <div className="admin-bg fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Grid */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="admin-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(34,114,222,0.025)" strokeWidth="0.5" />
          </pattern>
          <pattern id="admin-grid-minor" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(34,114,222,0.012)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#admin-grid-minor)" />
        <rect width="100%" height="100%" fill="url(#admin-grid)" />
      </svg>

      {/* Cog - top left */}
      <svg className="absolute top-[8%] left-[5%] w-[120px] h-[120px] opacity-[0.06]" viewBox="0 0 120 120" fill="none" stroke="rgba(34,114,222,1)" strokeWidth="1">
        <circle cx="60" cy="60" r="20" />
        <circle cx="60" cy="60" r="8" />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const inner = 20;
          const outer = i % 2 === 0 ? 35 : 28;
          return (
            <line
              key={i}
              x1={60 + Math.cos(a) * inner}
              y1={60 + Math.sin(a) * inner}
              x2={60 + Math.cos(a) * outer}
              y2={60 + Math.sin(a) * outer}
            />
          );
        })}
        {/* Gear teeth outline */}
        <path d={generateCogPath(60, 60, 35, 42, 12)} />
      </svg>

      {/* Cog - bottom right */}
      <svg className="absolute bottom-[15%] right-[8%] w-[160px] h-[160px] opacity-[0.05]" viewBox="0 0 160 160" fill="none" stroke="rgba(34,114,222,1)" strokeWidth="1">
        <circle cx="80" cy="80" r="28" />
        <circle cx="80" cy="80" r="12" />
        {Array.from({ length: 4 }).map((_, i) => {
          const a = (i / 4) * Math.PI * 2;
          return (
            <line key={i} x1={80 + Math.cos(a) * 12} y1={80 + Math.sin(a) * 12} x2={80 + Math.cos(a) * 28} y2={80 + Math.sin(a) * 28} />
          );
        })}
        <path d={generateCogPath(80, 80, 45, 55, 16)} />
      </svg>

      {/* Meshed small cog - near top left cog */}
      <svg className="absolute top-[17%] left-[11%] w-[70px] h-[70px] opacity-[0.05]" viewBox="0 0 70 70" fill="none" stroke="rgba(34,114,222,1)" strokeWidth="0.8">
        <circle cx="35" cy="35" r="12" />
        <circle cx="35" cy="35" r="5" />
        <path d={generateCogPath(35, 35, 18, 24, 8)} />
      </svg>

      {/* Pipe - horizontal mid-left */}
      <svg className="absolute top-[45%] left-0 w-[300px] h-[40px] opacity-[0.04]" viewBox="0 0 300 40" fill="none" stroke="rgba(34,114,222,1)" strokeWidth="1.5">
        <line x1="0" y1="15" x2="120" y2="15" />
        <line x1="0" y1="25" x2="120" y2="25" />
        <line x1="120" y1="15" x2="120" y2="5" />
        <line x1="120" y1="25" x2="120" y2="35" />
        <line x1="120" y1="5" x2="260" y2="5" />
        <line x1="120" y1="35" x2="260" y2="35" />
        {/* Joint */}
        <rect x="115" y="1" width="10" height="38" rx="1" />
        {/* End cap */}
        <rect x="255" y="1" width="10" height="38" rx="1" />
        {/* Flow dots */}
        <circle cx="40" cy="20" r="1.5" fill="rgba(34,114,222,0.4)" stroke="none" />
        <circle cx="80" cy="20" r="1.5" fill="rgba(34,114,222,0.3)" stroke="none" />
        <circle cx="170" cy="20" r="1.5" fill="rgba(34,114,222,0.3)" stroke="none" />
        <circle cx="220" cy="20" r="1.5" fill="rgba(34,114,222,0.2)" stroke="none" />
      </svg>

      {/* Pipe - vertical right */}
      <svg className="absolute top-[20%] right-[3%] w-[30px] h-[250px] opacity-[0.04]" viewBox="0 0 30 250" fill="none" stroke="rgba(34,114,222,1)" strokeWidth="1.5">
        <line x1="10" y1="0" x2="10" y2="100" />
        <line x1="20" y1="0" x2="20" y2="100" />
        <rect x="6" y="95" width="18" height="10" rx="1" />
        <line x1="5" y1="105" x2="5" y2="250" />
        <line x1="25" y1="105" x2="25" y2="250" />
        <circle cx="15" cy="50" r="1.5" fill="rgba(34,114,222,0.3)" stroke="none" />
        <circle cx="15" cy="160" r="1.5" fill="rgba(34,114,222,0.3)" stroke="none" />
      </svg>

      {/* I-beam - center-left */}
      <svg className="absolute top-[65%] left-[15%] w-[50px] h-[60px] opacity-[0.04] rotate-12" viewBox="0 0 50 60" fill="none" stroke="rgba(34,114,222,1)" strokeWidth="0.8">
        <path d="M5 5 L45 5 L45 12 L30 12 L30 48 L45 48 L45 55 L5 55 L5 48 L20 48 L20 12 L5 12 Z" />
      </svg>

      {/* Bolts scattered */}
      {[
        { x: "25%", y: "12%", s: 10 },
        { x: "70%", y: "8%", s: 8 },
        { x: "45%", y: "75%", s: 12 },
        { x: "85%", y: "45%", s: 9 },
        { x: "10%", y: "55%", s: 7 },
        { x: "60%", y: "90%", s: 10 },
        { x: "35%", y: "35%", s: 8 },
        { x: "90%", y: "75%", s: 11 },
      ].map((bolt, i) => (
        <svg
          key={i}
          className="absolute opacity-[0.05]"
          style={{ left: bolt.x, top: bolt.y, width: bolt.s * 2, height: bolt.s * 2 }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(34,114,222,1)"
          strokeWidth="1"
        >
          <polygon points="12,2 20.5,7 20.5,17 12,22 3.5,17 3.5,7" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      ))}

      {/* Dimension line - bottom */}
      <svg className="absolute bottom-[8%] left-[30%] w-[200px] h-[20px] opacity-[0.04]" viewBox="0 0 200 20" fill="none" stroke="rgba(34,114,222,1)" strokeWidth="0.5">
        <line x1="5" y1="10" x2="195" y2="10" />
        <line x1="5" y1="3" x2="5" y2="17" />
        <line x1="195" y1="3" x2="195" y2="17" />
        <polygon points="5,10 12,7 12,13" fill="rgba(34,114,222,0.3)" stroke="none" />
        <polygon points="195,10 188,7 188,13" fill="rgba(34,114,222,0.3)" stroke="none" />
      </svg>

      {/* Radial glow accents */}
      <div className="absolute top-[10%] right-[15%] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(34,114,222,0.03)_0%,transparent_70%)]" />
      <div className="absolute bottom-[20%] left-[10%] w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(34,114,222,0.025)_0%,transparent_70%)]" />
    </div>
  );
}

function generateCogPath(cx: number, cy: number, innerR: number, outerR: number, teeth: number): string {
  const parts: string[] = [];
  const toothWidth = (Math.PI * 2) / (teeth * 2);

  for (let i = 0; i < teeth; i++) {
    const a1 = (i / teeth) * Math.PI * 2;
    const a2 = a1 + toothWidth * 0.3;
    const a3 = a1 + toothWidth * 1.3;
    const a4 = a1 + toothWidth * 2;

    if (i === 0) {
      parts.push(`M ${cx + Math.cos(a1) * innerR} ${cy + Math.sin(a1) * innerR}`);
    }
    parts.push(`L ${cx + Math.cos(a2) * innerR} ${cy + Math.sin(a2) * innerR}`);
    parts.push(`L ${cx + Math.cos(a2) * outerR} ${cy + Math.sin(a2) * outerR}`);
    parts.push(`L ${cx + Math.cos(a3) * outerR} ${cy + Math.sin(a3) * outerR}`);
    parts.push(`L ${cx + Math.cos(a3) * innerR} ${cy + Math.sin(a3) * innerR}`);
    parts.push(`L ${cx + Math.cos(a4) * innerR} ${cy + Math.sin(a4) * innerR}`);
  }
  parts.push("Z");
  return parts.join(" ");
}
