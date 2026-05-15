# Passwordless OTP Auth Plan

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement task-by-task. Steps use `- [ ]` checkboxes.

**Goal:** Replace the existing email + password login on the "I am Rithvik" inline panel with a passwordless OTP flow powered by Supabase Auth. After a successful flow, the existing `EditModeProvider` per-tab session policy and the `requireAuth()` server-side guard keep working unchanged — only the credential-collection step changes.

**Architecture:** Use `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo } })`. Supabase emails a message containing **both** a 6-digit code AND a clickable magic link, generated from the same token. Two completion paths off one email:

- **Same-tab code path (primary):** user pastes the 6-digit code into the panel → `verifyOtp({ email, token, type: "email" })` → session set → onAuthStateChange fires `SIGNED_IN` → tab is authenticated. Works cross-device (read code on phone, type on desktop).
- **Magic-link new-tab path (secondary):** user clicks link in email → browser opens `/auth/callback?code=...` → server route exchanges code for session via `exchangeCodeForSession` → redirect to `/`. Requires same browser as the email request (PKCE code_verifier cookie). New tab becomes the editing tab.

Both paths land in the same authenticated state. No password is stored or asked for. Supabase's account row keeps its password hash for fallback, but our UI never touches it.

**Tech Stack:** Supabase Auth (existing), `@supabase/ssr` (existing), `@supabase/supabase-js` (existing), Next.js 16 App Router (existing), React 19, TypeScript. No new dependencies.

**Conventions:**
- This repo has no test framework. Per-task gate: `node_modules/.bin/tsc --noEmit` + `node_modules/.bin/eslint <touched files>`. Behavioral gate: push `dev`, exercise the flow on the Vercel preview using Rithvik's real inbox.
- Per CLAUDE.md: all work on `dev`. Do NOT merge to `main` from inside this plan — explicit user approval is required at the end.
- Commit per task using existing `feat:` / `fix:` / `chore:` prefixes.

---

## Decisions locked in (no need to revisit during implementation)

1. **Passwordless, not 2FA on top of password.** Cleaner UX, fewer moving parts. The user explicitly accepted either; passwordless won.
2. **`shouldCreateUser: false`** on every OTP request. Only the existing admin account can ever sign in. Random emails get a 422 from Supabase, which we surface as "this email isn't allowed."
3. **Client-side allow-list via `NEXT_PUBLIC_ADMIN_EMAIL`.** Belt + suspenders on top of Supabase's `shouldCreateUser: false`. Lets us reject foreign emails instantly without burning Supabase's hourly OTP rate limit (default: 4/hour/email). Public env var because the email isn't a secret (it's already in the contact section of the public site).
4. **Both code and magic-link paths shipped.** One email, two ways to finish. Code is the primary affordance (works cross-device); link is "or just click here in your email" guidance.
5. **PKCE flow** for the magic link (Supabase default in `@supabase/ssr`). Callback route uses `exchangeCodeForSession(code)`.
6. **`EditModeProvider` per-tab session policy is preserved.** `onAuthStateChange` already promotes `sessionStorage[rithvik-tab-auth] = "1"` on `SIGNED_IN`. Same wiring works for OTP-verified sessions because they emit the same event.
7. **`requireAuth()` server-side guard is unchanged.** It reads the Supabase auth cookie — Supabase sets that cookie identically for OTP-verified and password-verified sessions. No server-action changes needed.

---

## File structure

**New files:**
- `app/auth/callback/route.ts` — GET handler that exchanges the magic-link `code` for a session and redirects home. ~40 lines.

**Modified:**
- `components/InlineLoginPanel.tsx` — two-step UI: email → code. ~150 lines (up from 95).
- `components/EditModeProvider.tsx` — replace `login(email, password)` with `requestOtp(email)` + `verifyOtpCode(email, code)`. Existing onAuthStateChange logic stays. ~115 lines (up from 92).
- `app/globals.css` — styles for the second step (code input + back button + success state).
- `.env.local.example` — add `NEXT_PUBLIC_ADMIN_EMAIL`.
- `CLAUDE.md` — replace the "Inline editing" session-policy note with the OTP flow; add Pitfalls entries for PKCE same-browser requirement + Supabase redirect allow-list.

**No changes:**
- `lib/supabase.ts` — `createBrowserClient` already cookie-backed; no changes needed.
- `app/admin/auth-helper.ts` — `requireAuth()` already cookie-based; auto-works post-OTP.
- `app/admin/actions.ts` / `app/admin/rag-actions.ts` — server actions are auth-agnostic.

---

## Task 1: Supabase dashboard configuration (one-time, manual)

**Why first:** Subsequent tasks fail at runtime if the redirect URL isn't on the allow-list or `shouldCreateUser: false` is overridden by a global "Disable signups" setting that conflicts. Get the config right before writing code.

This task has no commit — it's dashboard clicks. Document each setting checked.

- [ ] **Step 1: Verify the admin user exists in `auth.users`.**

```bash
supabase db query --linked "SELECT id, email, created_at, last_sign_in_at FROM auth.users WHERE email = 'rithvikpkx@gmail.com';"
```

Expected: exactly one row. If empty, create the user in Supabase Dashboard → Authentication → Users → "Add user" with the correct email (any password — it won't be used).

- [ ] **Step 2: Configure redirect URLs.**

Supabase Dashboard → Authentication → URL Configuration:

- **Site URL:** `https://rithvik.ai`
- **Redirect URLs (add all three):**
  - `https://rithvik.ai/auth/callback`
  - `https://rithvik-*.vercel.app/auth/callback`  *(wildcard for preview deploys)*
  - `http://localhost:3000/auth/callback`  *(local dev)*

Supabase rejects redirects to URLs not on this list. Missing entries silently break the magic-link path with a "Redirect URL not allowed" error.

- [ ] **Step 3: Verify email template includes both `{{ .Token }}` and `{{ .ConfirmationURL }}`.**

Supabase Dashboard → Authentication → Email Templates → "Magic Link" template.

The default template is fine — it contains both. If somebody customized it to one or the other, fix it. Required for the dual-path UX to work from a single email.

Default magic link body looks roughly like:
```
<h2>Magic Link</h2>
<p>Follow this link to login:</p>
<p><a href="{{ .ConfirmationURL }}">Log In</a></p>
<p>Or enter this code: {{ .Token }}</p>
```

- [ ] **Step 4: Confirm rate limits.**

Supabase Dashboard → Authentication → Rate Limits. Defaults:
- OTP requests: 4 per hour per email
- OTP verifications: 30 per hour

These are fine for a single-admin use case. Don't change.

- [ ] **Step 5: (Optional) Disable "Confirm email" requirement at signup.**

Not strictly relevant since we set `shouldCreateUser: false`, but if a future agent tries to enable signups, ensure email confirmation stays on so any errant account creation can't bypass the OTP step.

---

## Task 2: Add `NEXT_PUBLIC_ADMIN_EMAIL` env var

**Files:**
- Modify: `.env.local.example`
- Modify: `.env.local` (locally — NOT committed)
- Add via Vercel dashboard → Project → Settings → Environment Variables: `NEXT_PUBLIC_ADMIN_EMAIL=rithvikpkx@gmail.com` for both Preview and Production.

- [ ] **Step 1: Update `.env.local.example`**

Append:
```bash
# Email allowed to receive admin OTPs. Client-side check on top of Supabase's
# shouldCreateUser=false guard. Public — exposed to the browser bundle.
NEXT_PUBLIC_ADMIN_EMAIL=rithvikpkx@gmail.com
```

- [ ] **Step 2: Add to local `.env.local`**

Same line, real value. Verify with `grep NEXT_PUBLIC_ADMIN_EMAIL .env.local`.

- [ ] **Step 3: Add to Vercel for Preview + Production environments.**

Vercel Dashboard → rithvik → Settings → Environment Variables → Add → Name `NEXT_PUBLIC_ADMIN_EMAIL`, Value `rithvikpkx@gmail.com`, Environments: Preview, Production.

(Tasks 3+ can be implemented before this step lands in Vercel, but the live preview won't enforce the allow-list until it's there.)

- [ ] **Step 4: No commit yet.** `.env.local.example` change can be bundled into Task 5's commit to keep the diff coherent.

---

## Task 3: Add auth callback route

**Files:**
- Create: `app/auth/callback/route.ts`

This route handles the magic-link click. Supabase redirects to it with `?code=<pkce-code>`; we exchange that code for a session cookie, then redirect home.

- [ ] **Step 1: Create the route**

```ts
// app/auth/callback/route.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

/** Handles the magic-link click from Supabase's OTP email. Exchanges the PKCE
 *  code for a session, sets the auth cookies, and bounces back to the home
 *  page where EditModeProvider's onAuthStateChange listener picks up SIGNED_IN. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const errorDescription = url.searchParams.get("error_description");

  // Supabase passes errors here (expired link, invalid code, etc).
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
```

Notes:
- The `cookies()` adapter is the @supabase/ssr standard pattern. `setAll` is required (read-only adapter from `auth-helper.ts` wouldn't work here because we need to write the session cookie).
- The `auth_error` query param round-trips back to the home page so the panel can surface a useful message. Picking it up is part of Task 4.
- No fancy redirect-target logic (`?next=`). The home page is always the destination since the panel is mounted there.

- [ ] **Step 2: Type-check**

```bash
node_modules/.bin/tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/auth/callback/route.ts
git commit -m "feat(auth): add OTP magic-link callback route"
```

---

## Task 4: Update EditModeProvider with OTP request + verify

**Files:**
- Modify: `components/EditModeProvider.tsx`

Replace the password-based `login` function with two OTP functions. Keep `logout()`, `openPanel()`, `closePanel()`, and the existing onAuthStateChange wiring exactly as-is — they're already OTP-compatible.

- [ ] **Step 1: Update the context type**

In `components/EditModeProvider.tsx`, change the `EditModeCtx` interface:

```ts
interface EditModeCtx {
  isEditing: boolean;
  session: Session | null;
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  requestOtp: (email: string) => Promise<string | null>;
  verifyOtpCode: (email: string, code: string) => Promise<string | null>;
  logout: () => void;
}
```

Both `requestOtp` and `verifyOtpCode` return `null` on success or an error message string on failure (matches the existing `login` signature convention).

- [ ] **Step 2: Replace `login()` with the two new functions**

Delete the existing `login` const. Insert these two:

```ts
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase() ?? "";

const requestOtp = async (email: string): Promise<string | null> => {
  const normalized = email.trim().toLowerCase();
  // Client-side allow-list. Belt + suspenders on top of shouldCreateUser: false.
  if (ADMIN_EMAIL && normalized !== ADMIN_EMAIL) {
    return "This email isn't allowed.";
  }
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  return error?.message ?? null;
};

const verifyOtpCode = async (email: string, code: string): Promise<string | null> => {
  const normalized = email.trim().toLowerCase();
  const token = code.replace(/\s+/g, "").trim();
  const { error } = await supabase.auth.verifyOtp({
    email: normalized,
    token,
    type: "email",
  });
  if (error) return error.message;
  // onAuthStateChange handles the rest: SIGNED_IN fires → tab auth set →
  // session captured → panel closes when InlineLoginPanel sees isEditing flip.
  setPanelOpen(false);
  setIsEditing(true);
  return null;
};
```

- [ ] **Step 3: Update the context provider value**

Change the `<EditModeContext.Provider value={{...}}>` block to export the new functions:

```tsx
<EditModeContext.Provider value={{
  isEditing, session, panelOpen,
  openPanel, closePanel: () => setPanelOpen(false),
  requestOtp, verifyOtpCode,
  logout,
}}>
```

- [ ] **Step 4: Type-check + lint**

```bash
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint components/EditModeProvider.tsx
```
Expected: PASS. Lint may flag the pre-existing react-hooks/set-state-in-effect issue from elsewhere in the codebase — that's acceptable since it predates this work.

- [ ] **Step 5: Commit**

```bash
git add components/EditModeProvider.tsx
git commit -m "feat(auth): replace password login with OTP request/verify in EditModeProvider"
```

(At this point the app won't build a working flow yet — InlineLoginPanel still calls the deleted `login`. Task 5 ships the matching UI.)

---

## Task 5: Rewrite InlineLoginPanel as two-step OTP flow

**Files:**
- Modify: `components/InlineLoginPanel.tsx`
- Modify: `app/globals.css`
- Modify: `.env.local.example` (the Task 2 line)

Two steps:
1. **Email step:** email input + "Send me a code" button. On submit, calls `requestOtp(email)`.
2. **Code step:** "Check your inbox for a code" message + 6-digit code input + "Verify" button + "Back" link. Also shows "Or click the link in your email." On submit, calls `verifyOtpCode(email, code)`. Success → panel closes (`isEditing` flips via context, `<AnimatePresence>` unmounts).

Also handle the `?auth_error=...` query param from Task 3 — on mount, if present, surface it as a panel error (and strip the param via `router.replace`).

- [ ] **Step 1: Rewrite the panel**

Replace the entire body of `InlineLoginPanel.tsx` with:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useEditMode } from "./EditModeProvider";

type Step = "email" | "code";

export default function InlineLoginPanel() {
  const { panelOpen, closePanel, requestOtp, verifyOtpCode } = useEditMode();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Surface callback errors handed off by /auth/callback?auth_error=...
  useEffect(() => {
    const authError = searchParams.get("auth_error");
    if (authError) {
      setError(authError);
      // Strip the param so refreshes don't re-show the toast.
      const url = new URL(window.location.href);
      url.searchParams.delete("auth_error");
      router.replace(url.pathname + url.search);
    }
  }, [searchParams, router]);

  // Reset state when the panel closes so the next open starts fresh.
  useEffect(() => {
    if (!panelOpen) {
      setStep("email");
      setCode("");
      setError("");
      setLoading(false);
    }
  }, [panelOpen]);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const err = await requestOtp(email);
    setLoading(false);
    if (err) { setError(err); return; }
    setStep("code");
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const err = await verifyOtpCode(email, code);
    setLoading(false);
    if (err) { setError(err); return; }
    // success — onAuthStateChange + provider close the panel
  };

  return (
    <AnimatePresence>
      {panelOpen && (
        <>
          <motion.div
            className="login-panel-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={closePanel}
          />
          <motion.div
            className="login-panel"
            initial={{ opacity: 0, scale: 0.93, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: -8 }}
            transition={{ type: "spring", stiffness: 440, damping: 32 }}
          >
            <button className="login-panel-close" onClick={closePanel} aria-label="Close">×</button>

            <p className="login-panel-eyebrow">Admin</p>
            <h2 className="login-panel-title">I am Rithvik.</h2>
            <p className="login-panel-warning">
              🚨 Rithvik-only zone. If you&apos;re not Rithvik, there&apos;s nothing to see here. Probably.
            </p>

            {step === "email" && (
              <form onSubmit={submitEmail} className="login-panel-form">
                <div className="admin-field">
                  <label htmlFor="il-email">Email</label>
                  <input
                    id="il-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    autoFocus
                  />
                </div>
                {error && <p className="admin-error">{error}</p>}
                <button type="submit" className="admin-submit" disabled={loading}>
                  {loading ? "Sending…" : "Send me a code →"}
                </button>
              </form>
            )}

            {step === "code" && (
              <form onSubmit={submitCode} className="login-panel-form">
                <p className="otp-instructions">
                  Check <strong>{email}</strong> for a 6-digit code, or click the link in the email.
                </p>
                <div className="admin-field">
                  <label htmlFor="il-code">Code</label>
                  <input
                    id="il-code"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    required
                    autoComplete="one-time-code"
                    placeholder="123456"
                    autoFocus
                    className="otp-input"
                  />
                </div>
                {error && <p className="admin-error">{error}</p>}
                <button type="submit" className="admin-submit" disabled={loading || code.length !== 6}>
                  {loading ? "Verifying…" : "Verify →"}
                </button>
                <button
                  type="button"
                  className="otp-back-btn"
                  onClick={() => { setStep("email"); setCode(""); setError(""); }}
                  disabled={loading}
                >
                  ← Use a different email
                </button>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Add CSS for the new states**

In `app/globals.css`, find the existing `.login-panel-form` block (search for `.login-panel-eyebrow` or `.admin-error` for the right neighborhood). Append:

```css
.otp-instructions {
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.55;
  margin: 0 0 4px;
}
.otp-instructions strong {
  color: var(--text);
  font-weight: 600;
}
.otp-input {
  font-family: var(--mono);
  font-size: 1.4rem;
  letter-spacing: 0.4em;
  text-align: center;
  padding: 10px 12px !important;
}
.otp-back-btn {
  background: transparent;
  border: 0;
  color: var(--muted);
  font-family: var(--mono);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 4px 0;
  text-align: left;
  transition: color 160ms ease;
}
.otp-back-btn:hover:not(:disabled) { color: var(--text); }
.otp-back-btn:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 3: Update `.env.local.example`**

Append:
```bash
# Email allowed to receive admin OTPs. Client-side check on top of Supabase's
# shouldCreateUser=false guard. Public — exposed to the browser bundle.
NEXT_PUBLIC_ADMIN_EMAIL=rithvikpkx@gmail.com
```

- [ ] **Step 4: Type-check + lint**

```bash
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint components/InlineLoginPanel.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/InlineLoginPanel.tsx app/globals.css .env.local.example
git commit -m "feat(auth): two-step OTP login panel (email → 6-digit code)"
```

---

## Task 6: Push, smoke-test on Vercel preview

**No file changes** — this is the behavioral gate.

- [ ] **Step 1: Push dev**

```bash
git push origin dev
```

Wait ~60s for Vercel preview build.

- [ ] **Step 2: Verify the email allow-list configuration landed.**

Open the preview URL. In DevTools console:
```js
window.location.origin  // copy this
```
Confirm `${origin}/auth/callback` matches one of the wildcards added to Supabase in Task 1.

- [ ] **Step 3: Walk the code-entry flow.**

1. Click "I am Rithvik" — panel opens with the email step.
2. Enter `rithvikpkx@gmail.com`. Submit.
3. Expect panel transitions to code step with "Check rithvikpkx@gmail.com for a 6-digit code…"
4. Open Gmail. Find the Supabase email (subject usually "Your Magic Link" or similar).
5. Copy the 6-digit code. Paste it into the panel. Submit.
6. Expect: panel closes, edit mode flips on, EditBar appears at the bottom.
7. Confirm an inline edit (e.g., on the Currently Building title) saves without redirecting.

- [ ] **Step 4: Walk the magic-link flow in the same browser.**

1. Refresh the preview tab to reset state (or open in a fresh tab — closes the existing tabAuth).
2. Click "I am Rithvik" → enter email → submit.
3. Open the email. Click the magic link (NOT the code).
4. Expect: a new tab opens at the preview URL with edit mode already active. Inline edits save.
5. Original tab is unchanged (no tabAuth set there).

- [ ] **Step 5: Walk the wrong-email rejection.**

1. Refresh. Click "I am Rithvik". Enter a different email (e.g. `imposter@example.com`).
2. Expect: instant client-side error "This email isn't allowed." No Supabase request fired.

- [ ] **Step 6: Walk the wrong-code rejection.**

1. Refresh. Click "I am Rithvik" → enter `rithvikpkx@gmail.com` → submit.
2. On code step, enter `000000`. Submit.
3. Expect: panel stays on code step, error "Token has expired or is invalid."

- [ ] **Step 7: Walk the expired-link case.**

1. Trigger a fresh OTP email. Wait ~5 minutes (or longer if email TTL is 60+ minutes).
2. Click the (now-stale) magic link.
3. Expect: redirect to `/?auth_error=...`. Panel can be reopened; the error appears at the top of the email step. Submitting again works fine.

- [ ] **Step 8: No commit (verification only).**

If any step fails, fix and re-push. Once all 7 paths pass, move to Task 7.

---

## Task 7: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the "Inline editing" session-policy paragraph.**

Find the bullet that begins "Session policy: stays alive **per tab**…" under the `### Inline editing` section. Replace the whole `### Inline editing` block with:

```markdown
### Inline editing (passwordless OTP, completed)

- `EditModeProvider` (client) owns `isEditing`, `panelOpen`, Supabase session, and the OTP flow
- Login is **passwordless**: enter email → Supabase sends a 6-digit code + magic link → enter the code OR click the link. Password column on `auth.users` is unused by our UI.
- Session policy: stays alive **per tab** (`sessionStorage` flag `rithvik-tab-auth`); closing the tab clears it so the next tab requires fresh auth. The Supabase session itself is not signed out on "exit edit mode" — so re-entering the dial doesn't reopen the login panel.
- Client-side allow-list: `NEXT_PUBLIC_ADMIN_EMAIL` is matched against the form input before the Supabase call. Defends against accidental OTP-rate-limit consumption and gives instant "not allowed" feedback. Belt + suspenders on top of `shouldCreateUser: false`.
- `InlineLoginPanel` — top-right glass card, two-step (email → code) with an `← Use a different email` back button on step 2
- `EditBar` — bottom floating indicator with "Exit editing"
- `EditableText` — `contentEditable` wrapper, saves on blur, Escape reverts, Enter blurs unless `multiline`
- `EditableTagList` — chip editor (× on each, input adds on Enter/comma/blur)
- Server actions in `app/admin/actions.ts` — `createProject/updateProject/deleteProject`, same for Experience, `updateEducation`, `upsertSiteContent`. Every action calls `requireAuth()` (reads cookie session, unchanged from password days) and `revalidatePath("/")`
- Magic-link callback at `app/auth/callback/route.ts`: exchanges PKCE code for session, redirects to `/` with optional `?auth_error=…` for the panel to surface
```

- [ ] **Step 2: Add new pitfalls.**

In the `### Theme / UI` Pitfalls subsection — actually, add a new subsection `### Auth (passwordless OTP)` between `### RAG` and `## Where to look first when something breaks`. Body:

```markdown
### Auth (passwordless OTP)

- **PKCE magic links require the same browser session.** `signInWithOtp` stores a `code_verifier` cookie when the OTP is requested. `exchangeCodeForSession` in the callback route needs that same cookie to succeed. So a magic link clicked in a different browser or device than the one that requested it will fail with "invalid request: both auth code and code verifier should be non-empty". The 6-digit code path is the cross-device fallback — it uses `verifyOtp({ email, token, type })` which doesn't depend on the code_verifier cookie.
- **Supabase rejects redirects not on the allow-list.** Preview URLs change per deploy. Use a wildcard like `https://rithvik-*.vercel.app/auth/callback` in Authentication → URL Configuration → Redirect URLs. Without it, the magic link bounces to a Supabase error page instead of `/auth/callback`.
- **`shouldCreateUser: false` is mandatory.** Without it, anyone who types an arbitrary email gets a Supabase account created (no password — but the row exists). With it, Supabase returns a 422 for unknown emails, which our panel surfaces. The client-side `NEXT_PUBLIC_ADMIN_EMAIL` allow-list catches it before the network call so we don't burn the 4/hour/email rate limit.
- **OTP rate limit is per email, not per tab.** Multiple "Send me a code" clicks within the hour all hit the same 4-request bucket. The 5th throws "Email rate limit exceeded." Wait 15 minutes or use the code from an earlier email.
```

- [ ] **Step 3: Add an entry to "Where to look first when something breaks".**

Append:

```markdown
- **OTP email never arrives** → check Supabase Dashboard → Authentication → Logs for the OTP send event. If the send is logged but the email isn't received, check spam, then the SMTP configuration in Supabase Project Settings → Auth → SMTP Settings. If the send isn't logged, the request didn't reach Supabase — check the browser network tab for a 422 (means `shouldCreateUser: false` rejected the email, i.e. the address isn't in `auth.users`).
- **Magic link redirects to a Supabase error page instead of `/auth/callback`** → the redirect URL isn't on the allow-list in Supabase Dashboard → Authentication → URL Configuration. Add the exact URL or a matching wildcard, then re-request the OTP (old emails embed the old redirect).
- **OTP works but `requireAuth()` in server actions redirects to `/` afterward** → cookie scope mismatch. Confirm the browser client in `lib/supabase.ts` is `createBrowserClient` from `@supabase/ssr` (cookie storage), not `createClient` from `@supabase/supabase-js` (localStorage). Same trap as the pre-OTP setup; reconfirm if anyone touches that module.
```

- [ ] **Step 4: Update the "Env vars" sentence in the RAG section.**

Find the line starting `Env vars in .env.local (see .env.local.example): OPENAI_API_KEY...` and append `, NEXT_PUBLIC_ADMIN_EMAIL` to the list.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document passwordless OTP auth flow + pitfalls"
```

---

## Task 8: Push and hand off for review

- [ ] **Step 1: Push**

```bash
git push origin dev
```

- [ ] **Step 2: Final check on preview**

Walk Task 6's seven flows one more time on the freshly-deployed preview. Confirm no regressions from the CLAUDE.md commit (shouldn't be any — docs only).

- [ ] **Step 3: Hand off**

Tell the user:

> "Passwordless OTP is shipped on `dev` and verified on the Vercel preview. The 'I am Rithvik' panel is now email → 6-digit code (or click the magic link in your inbox). Old password path is gone. When you're ready, say 'merge to main' and I'll do the `--no-ff` merge per CLAUDE.md."

Do NOT merge from inside this plan.

---

## Pitfalls already accounted for (no separate task needed)

- **No DB migration needed.** Supabase Auth already provisions the `auth.users` table. Rithvik's row already exists.
- **No new packages.** `@supabase/ssr` and `@supabase/supabase-js` already power the password flow; the OTP API is on the same clients.
- **No edge-runtime concerns.** The `/auth/callback` route uses the Node runtime (default for App Router routes) which is what `createServerClient` expects.
- **`logout()` stays as-is.** It exits edit mode without signing out of Supabase, so re-opening the panel skips OTP if `tabAuth` is still set. Closing the tab clears `tabAuth`, forcing a fresh OTP on the next tab. Same semantics as before.

---

## Rollback plan

If the OTP flow breaks in production, the fastest reversible path:

1. Revert the merge commit on `main` (`git revert -m 1 <merge-sha>`, push). Vercel redeploys the password version.
2. Or, if `dev` is the breaking branch: the user keeps their Supabase password in the dashboard's user row, so they can manually flip the panel back by restoring the pre-OTP `InlineLoginPanel.tsx` from `git log`.

Either path is < 5 minutes. The user retains password access through Supabase Dashboard at all times since we never delete the password column.

---

## Self-Review

**Spec coverage:**
- Passwordless: ✓ Task 4/5 — `signInWithOtp` + `verifyOtp`, no password input.
- Email link path: ✓ Task 3 — `/auth/callback` exchanges code, sets cookies.
- Email code path: ✓ Task 5 — second step input + `verifyOtpCode`.
- "Easier flow wins": both paths shipped because they're the same email; no extra work to surface both.
- Security: ✓ `shouldCreateUser: false` + `NEXT_PUBLIC_ADMIN_EMAIL` allow-list + Supabase rate limits + cookie-based session (unchanged from existing).

**Placeholder scan:** None. Every step has exact code, exact paths, exact commands.

**Dependency order:**
- Task 1 (Supabase config) blocks Task 6 (preview test) — won't work without redirect URL allow-list.
- Task 2 (env var) blocks the allow-list check in Task 4 from doing anything useful — but the app still works without it (Supabase rejects unknown emails server-side).
- Task 3 (callback route) blocks Task 6's magic-link path.
- Task 4 (EditModeProvider) blocks Task 5 (InlineLoginPanel imports the new functions).
- Tasks 3, 4, 5 can be reviewed in parallel — no inter-file coupling beyond imports.
