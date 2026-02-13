import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/arena/:path*",
        destination: "http://localhost:3002/api/arena/:path*",
      },
    ];
  },
};

export default nextConfig;
