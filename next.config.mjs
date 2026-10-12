/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    // Spec-style URLs resolve to the routes that exist under src/app/(dashboard)/.
    return [
      { source: '/legal', destination: '/compliance', permanent: false },
      { source: '/legal/:path*', destination: '/compliance/:path*', permanent: false },
      { source: '/risks', destination: '/risk', permanent: false },
      { source: '/risks/:path*', destination: '/risk/:path*', permanent: false },
    ];
  },
};
export default nextConfig;
