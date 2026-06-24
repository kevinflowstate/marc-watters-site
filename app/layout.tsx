import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import AppUpdateManager from "@/components/AppUpdateManager";
import SplashController from "@/components/SplashController";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

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
        <script
          dangerouslySetInnerHTML={{
            __html: `setTimeout(function(){var e=document.getElementById('cbb-splash');if(e)e.classList.add('is-hidden')},4000);`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${montserrat.variable} antialiased`}>
        <div id="cbb-splash" aria-hidden="true">
          <div className="splash-logo relative flex items-center justify-center">
            <span className="brand-loader-halo absolute h-32 w-32 rounded-full" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/cbb-logo.png"
              alt=""
              width={72}
              height={72}
              className="relative h-16 w-auto"
            />
          </div>
          <div
            className="h-[3px] w-44 overflow-hidden rounded-full"
            style={{ background: "rgba(34,114,222,0.12)" }}
          >
            <div className="brand-loader-bar h-full w-1/2 gradient-accent rounded-full" />
          </div>
        </div>
        <SplashController />
        <AppUpdateManager />
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__pwaInstallPrompt=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaInstallPrompt=e});`,
          }}
        />
      </body>
    </html>
  );
}
