/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/client",
      "@prisma/adapter-neon",
      "@neondatabase/serverless",
      "ws",
    ],
  },
};

export default nextConfig;
