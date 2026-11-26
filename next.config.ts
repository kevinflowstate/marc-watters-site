import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workbook PDFs embed these fonts and the logo at request time.
  outputFileTracingIncludes: {
    "/api/cron/ops-lesson-render": ["./scripts/lesson-render/*.py", "./assets/fonts/**", "./public/icon-192x192.png"],
    "/api/admin/ops/**": ["./assets/fonts/**", "./public/icon-192x192.png"],
  },
};

export default nextConfig;
