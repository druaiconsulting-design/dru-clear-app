import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { authenticatePasskey } from "../lib/passkey";

export default function AdminLogin() {
  const { loginAdmin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const handleLogin = async () => {
    setError(""); setLoading(true);
    const result = await loginAdmin(email, password);
    setLoading(false);
    if (!result.success) setError(result.error || "Login failed.");
    else window.location.href = "/admin";
  };

  const handlePasskeyLogin = async () => {
    setError(""); setPasskeyLoading(true);
    const result = await authenticatePasskey();
    setPasskeyLoading(false);
    if (result.success) {
      window.location.href = "/admin";
    } else {
      setError(result.error || "Passkey authentication failed.");
    }
  };

  const inputStyle = {
    width: "100%",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(212,175,55,0.3)",
    borderRadius: 6,
    padding: "0.75rem 1rem",
    color: "#FFFFFF",
    fontFamily: "'Inter', sans-serif",
    fontSize: "0.85rem",
    outline: "none",
    boxSizing: "border-box" as const,
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#071a30", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>

      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663512997684/PPrwKSVlySJjkhTX.png" alt="DRU CLEAR" style={{ height: 120, width: "auto", margin: "0 auto" }} />
      </div>

      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ background: "rgba(194,24,91,0.06)", border: "1px solid rgba(194,24,91,0.2)", borderRadius: 12, padding: "2rem 1.75rem" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.4rem", textAlign: "center" }}>Authorized Access Only</h1>
          <p style={{ color: "rgba(230,230,230,0.35)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", textAlign: "center", marginBottom: "2rem" }}>This area is restricted.</p>

          {/* ── Passkey Sign-In Button ──────────────────────────────────── */}
          <button
            onClick={handlePasskeyLogin}
            disabled={passkeyLoading}
            style={{
              width: "100%",
              background: "rgba(212,175,55,0.08)",
              color: "#D4AF37",
              border: "1px solid rgba(212,175,55,0.35)",
              borderRadius: 6,
              padding: "0.85rem",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: "0.82rem",
              letterSpacing: "0.06em",
              cursor: passkeyLoading ? "default" : "pointer",
              opacity: passkeyLoading ? 0.7 : 1,
              marginBottom: "1.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: "1rem" }}>&#x1F511;</span>
            {passkeyLoading ? "Verifying..." : "Sign in with Passkey"}
          </button>

          {/* ── Divider ────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.1)" }} />
            <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.25)", fontSize: "0.68rem" }}>or</span>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.1)" }} />
          </div>

          {/* ── Email + Password ────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", marginBottom: "1.25rem" }}>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} style={inputStyle} />
          </div>

          {error && <p style={{ color: "#E53935", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", marginBottom: "0.875rem", textAlign: "center" }}>{error}</p>}

          <button onClick={handleLogin} disabled={loading} style={{ width: "100%", background: "#C2185B", color: "#FFFFFF", border: "none", borderRadius: 6, padding: "0.85rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.06em", cursor: "pointer" }}>
            {loading ? "Verifying..." : "Enter"}
          </button>
        </div>
      </div>

      <footer style={{ marginTop: "3rem", color: "rgba(255,255,255,0.15)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", letterSpacing: "0.04em", textAlign: "center" }}>
        &copy; 2026 DRU CLEAR - All Rights Reserved
      </footer>
    </div>
  );
}
