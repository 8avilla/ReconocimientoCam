import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["onnxruntime-node", "sharp"],
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
