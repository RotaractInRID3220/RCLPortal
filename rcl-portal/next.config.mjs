/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',            // small production image (Dockerfile copies .next/standalone)
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },   // camera: QR scanner on check-in
      ] },
      // live data is never cached by the browser or a proxy
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ]
  },
}

export default nextConfig
