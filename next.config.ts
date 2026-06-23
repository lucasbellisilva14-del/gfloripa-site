import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's01.jetimgs.com',
      },
      {
        protocol: 'https',
        hostname: '*.jetimgs.com',
      },
    ],
  },
};

export default nextConfig;
