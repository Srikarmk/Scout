import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer ships its own font/stream internals that must not be
  // bundled by the server compiler.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
