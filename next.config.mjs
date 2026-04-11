/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: "/Users/preyam/repo/ai-vim-golf-arena",
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
