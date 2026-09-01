/** @type {import('next').NextConfig} */

/**
 * Demo-permissive CSP: allows Next.js inline/eval, Google Fonts, Vercel Analytics,
 * same-origin SW/scripts, and HTTPS API hosts (Railway / custom domain).
 * Tighten connect-src once demo hosts are fixed permanently.
 */
const ContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: http://127.0.0.1:* http://localhost:* http://*.up.railway.app https://*.up.railway.app ws: wss:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Cache-Control', value: 'no-store, must-revalidate' },
]

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: './',
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
