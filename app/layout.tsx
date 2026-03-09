import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const siteUrl = "https://marc-watters-site.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Marc Watters - Construction Business Blueprint | Private Mentorship for Trade Owners",
    template: "%s | Marc Watters",
  },
  description: "Private mentorship for trade and construction business owners who want profit, structure, and a business that doesn't depend on them doing everything.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CBB Portal",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: siteUrl,
    siteName: "Marc Watters - Construction Business Blueprint",
    title: "Marc Watters - Construction Business Blueprint | Private Mentorship for Trade Owners",
    description: "Private mentorship for trade and construction business owners who want profit, structure, and a business that doesn't depend on them doing everything.",
    images: [
      {
        url: "/images/marc-hero.png",
        width: 800,
        height: 900,
        alt: "Marc Watters - Construction Business Mentor",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Marc Watters - Construction Business Blueprint",
    description: "Private mentorship for trade and construction business owners who want profit, structure, and a business that doesn't depend on them doing everything.",
    images: ["/images/marc-hero.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#050507" />
      </head>
      <body className={`${inter.variable} ${montserrat.variable} antialiased`}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}`,
          }}
        />
      </body>
    </html>
  );
}
