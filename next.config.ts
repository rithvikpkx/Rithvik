import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Serve modern formats; AVIF first (smaller), WebP fallback. The browser
    // negotiates via Accept headers — older browsers still get the original.
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    // Tree-shake motion's barrel import so unused exports don't ship. motion is
    // imported in ~13 client components; this trims the shared client bundle.
    optimizePackageImports: ["motion"],
  },
};

export default nextConfig;
