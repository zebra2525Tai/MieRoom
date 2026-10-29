import type { MetadataRoute } from "next";

// Ask every crawler to stay away. The pages also send X-Robots-Tag: noindex.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
