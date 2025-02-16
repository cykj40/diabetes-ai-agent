import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true, // Helps catch potential issues in React
  experimental: {
    turbo: {
      loaders: {}, // Add specific loaders if needed
    },
    serverActions: {
      bodySizeLimit: '2mb', // Optional: Set a size limit for server actions
    },
  },
  typescript: {
    ignoreBuildErrors: false, // Ensures TypeScript errors fail builds
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
