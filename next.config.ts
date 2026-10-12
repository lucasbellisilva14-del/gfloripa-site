import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Fotos servidas direto do CDN da Jetimob, sem o otimizador da Vercel:
    // a cota gratuita de otimização estoura com o volume de fotos do
    // portfólio (HTTP 402) e derruba todas as imagens do site.
    unoptimized: true,
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
