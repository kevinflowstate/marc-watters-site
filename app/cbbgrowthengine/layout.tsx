import type { Metadata } from "next";
import "./growth-engine-booking.css";

// Private link shared with Marc's clients only: kept out of search and the sitemap.
export const metadata: Metadata = {
  title: "Book your Growth Engine call | Construction Business Blueprint",
  description: "A private 30-minute Growth Engine consultation for Construction Business Blueprint clients.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function GrowthEngineBookingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
