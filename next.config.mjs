/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Enable modularized imports for better tree-shaking
  modularizeImports: {
    "lucide-react": {
      transform: "lucide-react/dist/esm/icons/{{kebabCase member}}",
    },
  },
  // Experimental performance optimizations
  experimental: {
    optimizePackageImports: ["recharts", "@radix-ui/react-*"],
  },
  /**
   * Headers
   * --------
   * `same-origin-allow-popups` keeps the strong cross-origin-opener-policy
   * isolation for the main app while explicitly allowing OAuth popups to
   * retain `window.opener` so the connector OAuth flows (Google Drive,
   * QuickBooks, Zoho, Snowflake) can complete their postMessage handshake.
   *
   * Without this header, Chrome 90+ may set the page to `same-origin` for
   * cross-origin-isolated subdocuments, severing the opener reference and
   * causing the popup polling loop to never observe `window.closed=true`.
   * The connector "Connect" button then hangs.
   *
   * The Referrer-Policy + X-Content-Type-Options defaults are tightened
   * at the same time so this change doesn't widen any other surface.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ]
  },
}

export default nextConfig
