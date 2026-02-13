import type { NextConfig } from "next";

const arenaBackend =
  process.env.ARENA_BACKEND_URL || "http://localhost:3002";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/arena/:path*",
        destination: `${arenaBackend}/api/arena/:path*`,
      },
    ];
  },
};

export default nextConfig;
