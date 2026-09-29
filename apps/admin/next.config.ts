import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // The repo lives on an external SSD where writing Turbopack's dev cache
    // costs more than it saves. Re-enable on a fast local disk.
    turbopackFileSystemCacheForDev: false,
    serverActions: {
      // Image uploads (media-actions.ts) accept files up to 5 MB; the rest is
      // multipart overhead. The action re-checks the real size itself.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
