import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Spotify serves album art from this CDN host regardless of account/region.
    remotePatterns: [{ protocol: "https", hostname: "i.scdn.co" }],
  },
};

export default nextConfig;
