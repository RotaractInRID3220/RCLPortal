/** @type {import('next').NextConfig} */
const nextConfig = {
  // The e-arena landing page is hidden for the 2026-27 season; its sub-pages (schedule, leaderboard) stay live.
  async redirects() {
    return [{ source: '/e-arena', destination: '/', permanent: false }]
  },
};

export default nextConfig;
