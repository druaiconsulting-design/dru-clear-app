import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function AdminLogin() {
  const { loginAdmin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(""); setLoading(true);
    const result = await loginAdmin(email, password);
    setLoading(false);
    if (!result.success) setError(result.error || "Login failed.");
    else window.location.href = "/admin";
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
        <p style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "1.8rem", fontWeight: 700, letterSpacing: "0.04em", marginBottom: "0.25rem" }}>DRU</p>
        <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.3)", fontSize: "0.65rem", letterSpacing: "0.18em", textTransform: "uppercase" }}>Command Center</p>
      </div>

      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ background: "rgba(194,24,91,0.06)", border: "1px solid rgba(194,24,91,0.2)", borderRadius: 12, padding: "2rem 1.75rem" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.4rem", textAlign: "center" }}>Authorized Access Only</h1>
          <p style={{ color: "rgba(230,230,230,0.35)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", textAlign: "center", marginBottom: "2rem" }}>This area is restricted.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", marginBottom: "1.25rem" }}>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} style={inputStyle} />
          </div>

          {error && <p style={{ color: "#E53935", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", marginBottom: "0.875rem", textAlign: "center" }}>{error}</p>}

          <button onClick={handleLogin} disabled={loading} style={{ width: "100%", background: "#C2185B", color: "#FFFFFF", border: "none", borderRadius: 6, padding: "0.85rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.06em", cursor: "pointer" }}>
            {loading ? "Verifying..." : "Enter →"}
          </button>
        </div>
      </div>

      <footer style={{ marginTop: "3rem", color: "rgba(255,255,255,0.15)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", letterSpacing: "0.04em", textAlign: "center" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved
      </footer>
    </div>
  );
}
