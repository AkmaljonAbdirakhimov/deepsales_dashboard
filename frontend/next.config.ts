import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // We'll run Next.js as a service, not static export
  // This allows dynamic routes to work properly
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
