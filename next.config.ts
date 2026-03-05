import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
    proxyClientMaxBodySize: 100 * 1024 * 1024, // 100MB
  },
};

export default nextConfig;
