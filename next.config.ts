import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App Router is enabled by default in Next.js 13+
  // This config ensures optimal settings for Vercel deployment

  // Disable x-powered-by header for security
  poweredByHeader: false,

  // Enable strict mode for React 19
  reactStrictMode: true,

  // Image optimization settings
  images: {
    // Allow no remote patterns by default; add domains as needed
    remotePatterns: [],
  },

  // Ensure server-only code is not bundled for client
  serverExternalPackages: ["rss-parser", "openai"],
};

export default nextConfig;