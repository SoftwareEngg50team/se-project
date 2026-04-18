import "@se-project/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  serverExternalPackages: ["@react-pdf/renderer", "exceljs"],
};

export default nextConfig;
