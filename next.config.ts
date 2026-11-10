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
    // next/image serves from /_next/image (same origin); data:/blob: for canvas + cobe; DuckDuckGo's favicon service
    // for referrer and company logos on the admin dashboard.
    "img-src": ["'self'", "data:", "blob:", "https://icons.duckduckgo.com", ...(isProdDeploy ? [] : ["https://vercel.live", "https://vercel.com"])],
    // next/font/google self-hosts the files at build time.
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com", ...(isProdDeploy ? [] : ["https://vercel.live", "https://assets.vercel.com"])],
    "connect-src": [
      "'self'",
      // Supabase auth/PostgREST from the browser client (wss for realtime).
      ...(supabase ? [supabase, supabaseWs!] : ["https://*.supabase.co", "wss://*.supabase.co"]),
      ...(isDev ? ["ws:", "http://localhost:*"] : []),
      ...(isProdDeploy ? [] : ["https://vercel.live", "wss://ws-us3.pusher.com"]),
    ],
    // Spoken replies play from a blob: URL built from /api/speak's mp3.
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    // 'self' lets the resume window frame /resume.pdf.
    "frame-src": ["'self'", ...vercelLive],
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
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

// The PDF response is inert, so its own policy is minimal: Chrome's built-in viewer renders blank under
// the site-wide `object-src 'none'`. Only same-origin framing is allowed (the resume window).
const resumePdfHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const noIndex = [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }];

const nextConfig: NextConfig = {
  // The agent header shows the answer model this deployment actually uses (set via CHAT_MODEL).
  env: { NEXT_PUBLIC_CHAT_MODEL: process.env.CHAT_MODEL ?? "gpt-6-luna" },
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
  /** /preview hosted the v7 site before the switch-over; keep old links working. */
  async redirects() {
    return [{ source: "/preview", destination: "/", permanent: false }];
  },
  async headers() {
    // The later entry overrides the earlier one for the same header key on /resume.pdf.
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/resume.pdf", headers: resumePdfHeaders },
      // Private logs and shared transcripts must never be indexed (the pages also set a robots meta).
      { source: "/admin/:path*", headers: noIndex },
      { source: "/c/:path*", headers: noIndex },
    ];
  },
};

export default nextConfig;
