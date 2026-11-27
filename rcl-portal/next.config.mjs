/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',            // small production image (Dockerfile copies .next/standalone)
  poweredByHeader: false,
  // The e-arena landing page is hidden for the 2026-27 season; its sub-pages (schedule, leaderboard) stay live.
  async redirects() {
    return [{ source: '/e-arena', destination: '/', permanent: false }]
  },
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },   // camera: QR scanner on check-in
      ] },
      // Static brand files (not live data): cache in the browser for 7 days and refresh quietly in the background,
      // so repeat visits skip a 150 ms round trip per file. Filenames are not hashed, so a replaced file shows within a week.
      { source: '/landing/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] },
      { source: '/fonts/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] },
      { source: '/images/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] },
      { source: '/rcl-white.png', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] },
      { source: '/LogoWhite.png', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] },
      { source: '/load.svg', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] },
      { source: '/load-blue.svg', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] },
      // live data is never cached by the browser or a proxy
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ]
  },
}

export default nextConfig
