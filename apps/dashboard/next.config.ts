import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export', // Removed: not compatible with dynamic authenticated routes
  transpilePackages: ["@workspace/ui"],
};

export default nextConfig;
