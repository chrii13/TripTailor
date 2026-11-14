import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Header di sicurezza su ogni risposta. Manca di proposito una Content-Security-Policy:
  // va tarata su font, script in linea di Next e immagine Open Graph, ed è un lavoro suo.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
