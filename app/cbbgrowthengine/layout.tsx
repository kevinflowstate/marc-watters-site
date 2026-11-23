import type { Metadata } from "next";
import "./growth-engine-booking.css";

// Fonts load in the browser (not next/font) so the build never depends on a Google Fonts fetch.
const FONTS =
  "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap";

// Private link shared with Marc's clients only: kept out of search and the sitemap.
export const metadata: Metadata = {
  title: { absolute: "CBB Growth Engine | Construction Business Blueprint" },
  description: "AI lead generation and AI integration built around trade and construction businesses.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function GrowthEngineLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={FONTS} precedence="default" />
      {children}
    </>
  );
}
