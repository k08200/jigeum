import path from "node:path";
import type { NextConfig } from "next";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production" ? "https://jigeum.onrender.com" : undefined);

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  allowedDevOrigins: [
    "127.0.0.1",
    "127.0.0.1:8001",
    "127.0.2.2",
    "127.0.2.2:8001",
    "127.0.2.3",
    "127.0.2.3:8001",
  ],
  env: apiUrl ? { NEXT_PUBLIC_API_URL: apiUrl } : {},
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
