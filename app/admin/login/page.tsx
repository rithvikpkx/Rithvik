"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Invalid credentials.");
      setLoading(false);
      return;
    }

    router.push("/admin");
  }

  return (
    <div className="admin-login-wrap">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <p className="admin-eyebrow">Admin</p>
        <h1 className="admin-login-title">I am Rithvik.</h1>

        <div className="admin-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>

        <div className="admin-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="admin-error">{error}</p>}

        <button type="submit" className="admin-submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
