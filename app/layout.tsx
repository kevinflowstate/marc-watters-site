import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import { getSiteUrl } from "@/lib/site-url";
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

const siteUrl = getSiteUrl();

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
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','1878616869461878');fbq('track','PageView');`,
          }}
        />
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1878616869461878&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
      </head>
      <body className={`${inter.variable} ${montserrat.variable} antialiased`}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}window.__pwaInstallPrompt=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaInstallPrompt=e});`,
          }}
        />
      </body>
    </html>
  );
}
