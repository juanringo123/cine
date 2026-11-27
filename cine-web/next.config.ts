import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/movie",
        destination: "/movies",
        permanent: true,
      },
      {
        source: "/movie/:slug",
        destination: "/movies/:slug",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "zwcfgmdrmktzgirtumfw.supabase.co" },
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
};

export default nextConfig;
