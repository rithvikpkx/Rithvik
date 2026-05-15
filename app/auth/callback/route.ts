import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

/** Handles the magic-link click from Supabase's OTP email. Exchanges the PKCE
 *  code for a session, writes the auth cookies, then bounces back to /. The
 *  home-mounted EditModeProvider's onAuthStateChange listener picks up the
 *  SIGNED_IN event and flips the tab into edit mode. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const errorDescription = url.searchParams.get("error_description");

  // Supabase passes auth errors here (expired link, invalid code, etc).
  if (errorDescription) {
    return NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(errorDescription)}`, url.origin));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/?auth_error=missing_code", url.origin));
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(error.message)}`, url.origin));
  }

  return NextResponse.redirect(new URL("/", url.origin));
}
