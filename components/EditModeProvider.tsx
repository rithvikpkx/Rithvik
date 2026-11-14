"use client";
import { createContext, useContext, useRef, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { ADMIN_SESSION_MS as SESSION_MS, TAB_AUTH_KEY } from "@/lib/admin-tab"; // a sign-in lasts 5 hours, then a fresh code is needed
/** Marks this tab signed in until 5 hours from now. */
const armTab = () => sessionStorage.setItem(TAB_AUTH_KEY, String(Date.now() + SESSION_MS));
/** Milliseconds left on this tab's sign-in (0 = none or expired). */
const tabLeft = () => Math.max(0, Number(sessionStorage.getItem(TAB_AUTH_KEY)) - Date.now() || 0);

interface EditModeCtx {
  isEditing: boolean; // signed in as the admin: the admin bar is available
  inlineOn: boolean; // inline text editing switched on (admin bar toggle)
  setInlineOn: (on: boolean) => void;
  barHidden: boolean; // the admin bar is tucked away (the "I am Rithvik" button brings it back)
  session: Session | null;
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  requestOtp: (email: string) => Promise<string | null>;
  verifyOtpCode: (email: string, code: string) => Promise<string | null>;
  logout: () => void;
}

export const EditModeContext = createContext<EditModeCtx | null>(null);

export function useEditMode() {
  const ctx = useContext(EditModeContext);
  if (!ctx) throw new Error("useEditMode must be used within EditModeProvider");
  return ctx;
}

export default function EditModeProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [inlineOn, setInlineOn] = useState(true); // on by default at sign-in, like the old site
  const [barHidden, setBarHidden] = useState(false);

  // Tracks whether the user authenticated during this specific tab session (and within 5 hours).
  // sessionStorage is wiped on tab close, so a new tab always requires login.
  const tabAuth = useRef(typeof window !== "undefined" && tabLeft() > 0);

  // Browser client is loaded on demand so ordinary visitors never download it.
  // The promise is cached; the first load also subscribes to auth changes once.
  const clientRef = useRef<Promise<typeof import("@/lib/supabase-browser").supabase> | null>(null);
  const getClient = () => {
    clientRef.current ??= import("@/lib/supabase-browser").then(({ supabase }) => {
      supabase.auth.onAuthStateChange(onAuthEvent.current);
      return supabase;
    });
    return clientRef.current;
  };

  // Latest auth handler, so the one-time subscription never goes stale.
  const onAuthEvent = useRef<(event: string, s: Session | null) => void>(() => {});
  useEffect(() => {
    onAuthEvent.current = (event, newSession) => {
      if (event === "SIGNED_IN") {
        // Fresh login — mark this tab as authenticated (an existing, unexpired mark keeps its clock)
        if (!tabLeft()) armTab();
        tabAuth.current = true;
        setSession(newSession);
      } else if (event === "SIGNED_OUT") {
        sessionStorage.removeItem(TAB_AUTH_KEY);
        tabAuth.current = false;
        setSession(null);
        setIsEditing(false);
        setPanelOpen(false);
        setBarHidden(false);
      } else if (newSession && tabAuth.current) {
        // TOKEN_REFRESHED or INITIAL_SESSION with an existing tab auth — keep session alive
        setSession(newSession);
      }
      // INITIAL_SESSION with no tab auth: leave session null so new tab requires login
    };
  });

  useEffect(() => {
    // Magic-link landing: /auth/callback redirected here with ?auth=ok after
    // exchanging the PKCE code for a session. The server-side cookie write
    // means the in-tab SDK will fire INITIAL_SESSION (not SIGNED_IN) on
    // mount; without this short-circuit we'd filter the session out because
    // the per-tab flag is empty in a brand-new tab. Pre-arm the flag so the
    // session is captured when it arrives.
    let raf = 0;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("auth") === "ok") {
        armTab();
        tabAuth.current = true;
        url.searchParams.delete("auth");
        window.history.replaceState({}, "", url.pathname + url.search);
        // Defer the setState off the effect's synchronous path (next frame).
        raf = requestAnimationFrame(() => setIsEditing(true));
      } else if (url.searchParams.has("edit")) {
        // Shortcut besides the header's "I am Rithvik" button: rithvik.ai/?edit opens the panel (or edit mode if this tab is signed in).
        url.searchParams.delete("edit");
        window.history.replaceState({}, "", url.pathname + url.search);
        raf = requestAnimationFrame(() => (tabAuth.current ? setIsEditing(true) : setPanelOpen(true)));
      }
    }

    // Only load the client when a session could already exist for this tab; an expired mark signs the cookie out too.
    if (tabAuth.current) void getClient();
    else if (sessionStorage.getItem(TAB_AUTH_KEY)) void getClient().then((supabase) => supabase.auth.signOut());
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, []);

  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase() ?? "";

  const requestOtp = async (email: string): Promise<string | null> => {
    const normalized = email.trim().toLowerCase();
    // Belt + suspenders on top of shouldCreateUser: false — fail instantly
    // without burning Supabase's 4-per-hour OTP rate limit.
    if (ADMIN_EMAIL && normalized !== ADMIN_EMAIL) {
      return "Nice try. That is not the Rithvik email.";
    }
    const supabase = await getClient();
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
    const supabase = await getClient();
    const { error } = await supabase.auth.verifyOtp({
      email: normalized,
      token,
      type: "email",
    });
    if (error) return error.message;
    // onAuthStateChange handles tab-auth + session capture; flip the UI here
    // so the panel closes immediately rather than waiting for the next render.
    setPanelOpen(false);
    setIsEditing(true);
    return null;
  };

  // The 5-hour limit: a real sign-out when it runs out. The SIGNED_OUT event clears state; the explicit clears
  // cover a not-yet-subscribed client.
  useEffect(() => {
    if (!session) return;
    const t = setTimeout(() => {
      setIsEditing(false);
      sessionStorage.removeItem(TAB_AUTH_KEY);
      tabAuth.current = false;
      void getClient().then((supabase) => supabase.auth.signOut());
    }, tabLeft());
    return () => clearTimeout(t);
  }, [session]);

  // Exit editing only leaves edit mode: the tab stays signed in (until it closes or the 5 hours run out), so
  // ?edit or the header button gets back in without a new code.
  const logout = () => { setIsEditing(false); setBarHidden(false); };

  // The header's "I am Rithvik" button: sign in if needed, otherwise show or tuck away the admin bar.
  const openPanel = () => {
    if (isEditing) setBarHidden((h) => !h);
    else if (session) { setIsEditing(true); setBarHidden(false); }
    else setPanelOpen(true);
  };

  return (
    <EditModeContext.Provider value={{
      isEditing, inlineOn, setInlineOn, barHidden, session, panelOpen,
      openPanel, closePanel: () => setPanelOpen(false),
      requestOtp, verifyOtpCode,
      logout,
    }}>
      {children}
    </EditModeContext.Provider>
  );
}
