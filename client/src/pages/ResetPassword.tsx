import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const LOGO_CDN = "https://assets.cdn.filesafe.space/gl07I4JnbkGgW8zJprSz/media/69d1a1c384c045c2744d50f6.png";

function getPasswordStrength(p: string) {
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^a-zA-Z0-9]/.test(p)) score++;
  if (/[A-Z]/.test(p)) score++;
  if (score <= 1) return { label: "Weak", color: "#E53935", width: "25%" };
  if (score <= 2) return { label: "Fair", color: "#D4AF37", width: "50%" };
  if (score <= 3) return { label: "Good", color: "#1E88E5", width: "75%" };
  return { label: "Strong", color: "#43A047", width: "100%" };
}

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const strength = getPasswordStrength(password);

  // Supabase appends the token to the URL hash — getSession() picks it up automatically
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      } else {
        setError("This link is invalid or has expired. Please request a new one.");
      }
    });
  }, []);

  const handleSubmit = async () => {
    setError("");
    if (!password) { setError("Please enter a password."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!/[0-9]/.test(password)) { setError("Password must include at least one number."); return; }
    if (!/[^a-zA-Z0-9]/.test(password)) { setError("Password must include at least one special character."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => { window.location.href = "/portal"; }, 2500);
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
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <img src={LOGO_CDN} alt="DRU CLEAR™" style={{ height: 52, width: "auto", margin: "0 auto" }} />
      </div>

      <div style={{ width: "100%", maxWidth: 400 }}>

        {success ? (
          /* ── Success state ── */
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", border: "2px solid #43A047", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M5 14L11 20L23 8" stroke="#43A047" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.75rem" }}>
              Password Set!
            </h1>
            <p style={{ color: "rgba(230,230,230,0.7)", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", lineHeight: 1.7, marginBottom: "1rem" }}>
              Welcome to your DRU CLEAR™ portal. Taking you there now…
            </p>
            <p style={{ color: "rgba(212,175,55,0.5)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.08em" }}>
              Redirecting…
            </p>
          </div>
        ) : (
          /* ── Set password form ── */
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.75rem", fontWeight: 700, textAlign: "center", marginBottom: "0.5rem" }}>
              Set Your Password
            </h1>
            <p style={{ color: "rgba(230,230,230,0.5)", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", textAlign: "center", marginBottom: "2rem", lineHeight: 1.6 }}>
              Create a password to access your DRU CLEAR™ portal
            </p>

            {!sessionReady && !error && (
              <p style={{ color: "rgba(212,175,55,0.6)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.75rem", textAlign: "center", marginBottom: "1.5rem" }}>
                Verifying your link…
              </p>
            )}

            {sessionReady && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <input
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={inputStyle}
                  />
                  {password.length > 0 && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden", marginBottom: "0.35rem" }}>
                        <div style={{ height: "100%", width: strength.width, background: strength.color, borderRadius: 2, transition: "all 0.3s" }} />
                      </div>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.7rem", color: strength.color }}>
                        {strength.label} — min 8 chars, 1 number, 1 special character
                      </p>
                    </div>
                  )}
                </div>

                <input
                  type="password"
                  placeholder="Confirm your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  style={inputStyle}
                />

                {error && (
                  <p style={{ color: "#E53935", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem" }}>{error}</p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading || !sessionReady}
                  style={{
                    width: "100%",
                    background: "#D4AF37",
                    color: "#0A2342",
                    border: "none",
                    borderRadius: 6,
                    padding: "0.85rem",
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    letterSpacing: "0.06em",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? "Setting Password…" : "Set Password & Enter Portal →"}
                </button>
              </div>
            )}

            {error && !sessionReady && (
              <div style={{ textAlign: "center", marginTop: "1rem" }}>
                <p style={{ color: "#E53935", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", marginBottom: "1rem" }}>{error}</p>
                <a href="/login" style={{ color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.75rem", textDecoration: "underline" }}>
                  Back to Sign In
                </a>
              </div>
            )}
          </div>
        )}

      </div>

      <footer style={{ marginTop: "3rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em", textAlign: "center" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
