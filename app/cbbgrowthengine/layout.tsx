import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, Big_Shoulders } from "next/font/google";
import "./growth-engine-booking.css";

const display = Big_Shoulders({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--ge-display", display: "swap" });
const label = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--ge-label", display: "swap" });
const text = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--ge-text", display: "swap" });

// Private link shared with Marc's clients only: kept out of search and the sitemap.
export const metadata: Metadata = {
  title: { absolute: "CBB Growth Engine | Construction Business Blueprint" },
  description: "AI lead generation and AI integration built around trade and construction businesses.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function GrowthEngineLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${label.variable} ${text.variable}`}>{children}</div>;
}
