/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol:'https', hostname:'picsum.photos' }],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}
export default nextConfig
