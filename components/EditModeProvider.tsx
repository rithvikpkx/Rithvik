"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

interface EditModeCtx {
  isEditing: boolean;
  session: Session | null;
  panelOpen: boolean;
  /** Opens login panel, or enters edit mode directly if already authenticated. */
  openPanel: () => void;
  closePanel: () => void;
  login: (email: string, password: string) => Promise<string | null>;
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
      if (!session) {
        setIsEditing(false);
        setPanelOpen(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    setSession(data.session);
    setIsEditing(true);
    setPanelOpen(false);
    return null;
  };

  const logout = () => {
    supabase.auth.signOut();
    setSession(null);
    setIsEditing(false);
    setPanelOpen(false);
  };

  const openPanel = () => {
    if (session) {
      // Already authenticated — skip the login form and enter edit mode directly
      setIsEditing(true);
    } else {
      setPanelOpen(true);
    }
  };

  return (
    <EditModeContext.Provider value={{
      isEditing, session, panelOpen,
      openPanel, closePanel: () => setPanelOpen(false),
      login, logout,
    }}>
      {children}
    </EditModeContext.Provider>
  );
}
