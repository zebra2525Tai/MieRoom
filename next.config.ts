import type { NextConfig } from "next";

// Headers that do not change per request. The Content-Security-Policy is set
// in proxy.ts because it carries a nonce that is new for every request.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // This site is not for search engines. Hiding the address is not access control
  // (that is the allow list / tenant check), but it keeps the login page out of results.
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "X-Frame-Options", value: "DENY" },
  // The monitor URL contains its passphrase, so never send it to other sites.
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
