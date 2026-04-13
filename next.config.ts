import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Explicitly set workspace root to silence the multiple-lockfiles warning
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
