import type { MetadataRoute } from "next";

const SITE_URL = "https://trip-tailor-ten.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, priority: 1 },
    { url: `${SITE_URL}/crea`, priority: 0.8 },
    { url: `${SITE_URL}/scopri`, priority: 0.8 },
  ];
}
