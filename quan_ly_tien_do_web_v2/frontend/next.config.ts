import type { NextConfig } from "next";

const nextConfig: any = {
  eslint: {
    ignoreDuringBuilds: true, // TODO: tắt khi đã sửa hết lỗi ESLint
  },
  typescript: {
    ignoreBuildErrors: true,  // TODO: tắt khi đã sửa hết lỗi TypeScript
  },
  // Proxy qua API Route (app/api/v1/[...path]/route.ts) để xử lý lỗi kết nối Backend
};

export default nextConfig;
