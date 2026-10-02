import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The end-to-end tests build in their own folder so they can run next to the `next dev` in use.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Keep the dev-only badge from covering the mobile bottom navigation.
  devIndicators: false,
  serverExternalPackages: ["onnxruntime-node", "sharp"],
  images: {
    // Every stored image has a name that is never reused, so what the optimizer made of it never goes out of date.
    minimumCacheTTL: 31 * 86400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async headers() {
    return [
      {
        // MediaPipe tasks-vision usa WASM con hilos (SharedArrayBuffer),
        // que requiere que la página esté "cross-origin isolated".
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

export default nextConfig;
