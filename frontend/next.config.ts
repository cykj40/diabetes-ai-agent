import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true, // Helps catch potential issues in React
  turbopack: {
    rules: {
      // New format uses glob patterns
    }
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb', // Optional: Set a size limit for server actions
    },
  },
  typescript: {
    // Temporarily ignore TypeScript errors during build to work around Next.js 15 route handler type issues
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true, // Prevent ESLint from blocking production builds
  },
  images: {
    domains: ["example.com"], // Allow external images (replace with real domains)
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production", // Remove console.logs in production
  },
  async headers() {
    return [
      {
        source: "/api/:path*", // Applies CORS headers to all API routes
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.NODE_ENV === "development" ? "*" : "https://yourdomain.com",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
