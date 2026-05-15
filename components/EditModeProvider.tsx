"use client";
import { createContext, useContext, useRef, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

const TAB_AUTH_KEY = "rithvik-tab-auth";

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

  // Tracks whether the user authenticated during this specific tab session.
  // sessionStorage is wiped on tab close, so a new tab always requires login.
  const tabAuth = useRef(
    typeof window !== "undefined" && sessionStorage.getItem(TAB_AUTH_KEY) === "1"
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "SIGNED_IN") {
        // Fresh login — mark this tab as authenticated
        sessionStorage.setItem(TAB_AUTH_KEY, "1");
        tabAuth.current = true;
        setSession(newSession);
      } else if (event === "SIGNED_OUT") {
        sessionStorage.removeItem(TAB_AUTH_KEY);
        tabAuth.current = false;
        setSession(null);
        setIsEditing(false);
        setPanelOpen(false);
      } else if (newSession && tabAuth.current) {
        // TOKEN_REFRESHED or INITIAL_SESSION with an existing tab auth — keep session alive
        setSession(newSession);
      }
      // INITIAL_SESSION with no tab auth: leave session null so new tab requires login
    });
    return () => subscription.unsubscribe();
  }, []);

  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase() ?? "";

  const requestOtp = async (email: string): Promise<string | null> => {
    const normalized = email.trim().toLowerCase();
    // Belt + suspenders on top of shouldCreateUser: false — fail instantly
    // without burning Supabase's 4-per-hour OTP rate limit.
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
    // onAuthStateChange handles tab-auth + session capture; flip the UI here
    // so the panel closes immediately rather than waiting for the next render.
    setPanelOpen(false);
    setIsEditing(true);
    return null;
  };

  const logout = () => {
    // Exit edit mode without signing out of Supabase — the session and tab auth flag stay.
    // Clicking "I am Rithvik" again re-enters edit mode immediately without re-auth.
    // Closing the tab wipes sessionStorage, so the next tab open always requires login.
    setIsEditing(false);
  };

  const openPanel = () => {
    if (session) {
      setIsEditing(true);
    } else {
      setPanelOpen(true);
    }
  };

  return (
    <EditModeContext.Provider value={{
      isEditing, session, panelOpen,
      openPanel, closePanel: () => setPanelOpen(false),
      requestOtp, verifyOtpCode,
      logout,
    }}>
      {children}
    </EditModeContext.Provider>
  );
}
