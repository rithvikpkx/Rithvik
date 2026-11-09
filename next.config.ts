import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
// Vercel's live-comments toolbar is injected on preview deployments only.
const isProdDeploy = process.env.VERCEL_ENV === "production" || (!isDev && !process.env.VERCEL_ENV);
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseWs = supabase?.replace(/^https:/, "wss:");

/**
 * Static CSP (one policy for every route; no per-request nonce).
 *
 * A nonce would force every page dynamic and defeat the homepage's ISR
 * (`revalidate = 60`). Next's own inline hydration scripts (`self.__next_f.push`)
 * have no stable hash, so a hash allowlist can't cover them either — hence
 * `'unsafe-inline'` for script-src. The real XSS guards are elsewhere (no
 * dangerouslySetInnerHTML with user data, sanitized email HTML, safeUrl, escaped
 * theme tokens). The rest of the policy still blocks framing, plugins, base-tag
 * hijack, form exfil and third-party script/connect hosts.
 * Dev needs 'unsafe-eval' (React refresh) and ws: for HMR.
 */
function contentSecurityPolicy(): string {
  const vercelLive = isProdDeploy ? [] : ["https://vercel.live"];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : []), ...vercelLive],
    // motion/framer and next/font write inline styles. Google Fonts: each v7 design loads its own
    // families at runtime (DesignMeta.fonts), which next/font can't self-host.
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", ...vercelLive],
    // next/image serves from /_next/image (same origin); data:/blob: for canvas + cobe.
    "img-src": ["'self'", "data:", "blob:", ...(isProdDeploy ? [] : ["https://vercel.live", "https://vercel.com"])],
    // next/font/google self-hosts the files at build time.
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com", ...(isProdDeploy ? [] : ["https://vercel.live", "https://assets.vercel.com"])],
    "connect-src": [
      "'self'",
      // Supabase auth/PostgREST from the browser client (wss for realtime).
      ...(supabase ? [supabase, supabaseWs!] : ["https://*.supabase.co", "wss://*.supabase.co"]),
      ...(isDev ? ["ws:", "http://localhost:*"] : []),
      ...(isProdDeploy ? [] : ["https://vercel.live", "wss://ws-us3.pusher.com"]),
    ],
    "worker-src": ["'self'", "blob:"],
    "frame-src": isProdDeploy ? ["'none'"] : ["https://vercel.live"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  images: {
    // Serve modern formats; AVIF first (smaller), WebP fallback. The browser
    // negotiates via Accept headers — older browsers still get the original.
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    // Tree-shake motion's barrel import so unused exports don't ship. motion is
    // imported in ~13 client components; this trims the shared client bundle.
    optimizePackageImports: ["motion"],
  },
  /** Applies the security headers to every route (both root layouts). */
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
