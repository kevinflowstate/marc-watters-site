import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/portal/", "/admin/", "/login", "/auth/", "/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
