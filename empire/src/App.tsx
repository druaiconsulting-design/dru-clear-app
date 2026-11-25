import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import OrgChart from "./OrgChart";

// The admin account of the Intelligence Hub. Only this account sees the chart.
const ADMIN_ID = "4db9a4ac-e0a3-4b17-be1c-732d5731bd29";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem 0.9rem",
  fontSize: 16, // 16px keeps phones from zooming in on the field
  fontFamily: "'Inter', sans-serif",
  borderRadius: 8,
  border: "1px solid rgba(212,175,55,0.35)",
  background: "#FFFFFF",
  color: "#0A2342",
  outline: "none",
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const isAdmin = session?.user.id === ADMIN_ID;

  // Any signed-in account other than the admin account is signed straight back out.
  useEffect(() => {
    if (session && !isAdmin) {
      setMessage("This account does not have access.");
      supabase.auth.signOut();
    }
  }, [session, isAdmin]);

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setMessage("The email or password did not match.");
    setBusy(false);
  };

  const signOut = () => {
    setPassword("");
    supabase.auth.signOut();
  };

  if (checking) return null;

  if (session && isAdmin) return <OrgChart onSignOut={signOut} />;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", background: "#FAFAF8" }}>
      <form
        onSubmit={signIn}
        style={{ width: "100%", maxWidth: 380, background: "#0A2342", border: "1px solid rgba(212,175,55,0.5)", borderRadius: 12, padding: "2rem 1.75rem", display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "1.35rem", fontWeight: 700 }}>DRU AI Consulting</p>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.85)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>Sign in</p>
        </div>

        <label style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.85)", fontSize: "0.7rem", fontWeight: 600, display: "flex", flexDirection: "column", gap: 6 }}>
          Email
          <input type="email" name="email" autoComplete="username" inputMode="email" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
        </label>

        <label style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.85)", fontSize: "0.7rem", fontWeight: 600, display: "flex", flexDirection: "column", gap: 6 }}>
          Password
          <input type="password" name="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
        </label>

        {message && <p role="alert" style={{ fontFamily: "'Inter', sans-serif", color: "#FFB4C8", fontSize: "0.8rem", textAlign: "center" }}>{message}</p>}

        <button
          type="submit"
          disabled={busy}
          style={{ marginTop: 4, padding: "0.8rem", borderRadius: 8, background: "#D4AF37", color: "#0A2342", fontFamily: "'Montserrat', sans-serif", fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.06em", cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
