import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const LOGO_CDN = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512997684/NJTJspnSktvZQJaw.png";
const MEMBERS_PORTAL = "https://members.druaiconsulting.com";

// Detect whether this is a new member creating their password for the first time
// vs an existing member/admin performing a password reset.
//
// New member paths:
//   — token_hash flow:  /reset-password?flow=signup   (set by App.tsx after verifyOtp)
//   — hash flow:        /reset-password#...type=signup (hash passed through from App.tsx)
function detectIsNewMember(): boolean {
  const flowParam = new URLSearchParams(window.location.search).get("flow");
  if (flowParam === "signup") return true;
  if (window.location.hash.includes("type=signup")) return true;
  return false;
}

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

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(212,175,55,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(212,175,55,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  // Determined once on mount — does not change during the session.
  const [isNewMember] = useState(() => detectIsNewMember());

  const strength = getPasswordStrength(password);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
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
      setTimeout(() => {
        // New members go to the members portal.
        // Password recovery (existing accounts) returns to the app portal.
        window.location.href = isNewMember ? MEMBERS_PORTAL : "/portal";
      }, 2500);
    }
  };

  const inputWrapStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(212,175,55,0.3)",
    borderRadius: 6,
    padding: "0.75rem 2.75rem 0.75rem 1rem",
    color: "#FFFFFF",
    fontFamily: "'Inter', sans-serif",
    fontSize: "0.85rem",
    outline: "none",
    boxSizing: "border-box",
  };

  const eyeButtonStyle: React.CSSProperties = {
    position: "absolute",
    right: "0.75rem",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <img src={LOGO_CDN} alt="DRU CLEAR™" style={{ height: 120, width: "auto", margin: "0 auto" }} />
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
              {isNewMember ? "Welcome to the Ecosystem!" : "You're All Set!"}
            </h1>
            <p style={{ color: "rgba(230,230,230,0.7)", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", lineHeight: 1.7 }}>
              {isNewMember
                ? "Your password is saved. Taking you to your membership portal now…"
                : "Your password is saved. Taking you to your portal now…"}
            </p>
          </div>

        ) : !ready ? (
          /* ── Verifying link ── */
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "rgba(212,175,55,0.6)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.75rem", letterSpacing: "0.06em" }}>
              Verifying your link…
            </p>
          </div>

        ) : isNewMember ? (
          /* ── New member — create password for the first time ── */
          <div>
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid #D4AF37", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem", background: "rgba(212,175,55,0.08)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#D4AF37"/>
                </svg>
              </div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                One Last Step
              </h1>
              <p style={{ color: "rgba(230,230,230,0.6)", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", lineHeight: 1.65 }}>
                Your account was created using the email address you provided on your{" "}
                <span style={{ color: "#D4AF37", fontWeight: 600 }}>DRU CLEAR™ Assessment</span>.
                Create a password below to complete your membership access.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

              <div>
                <div style={inputWrapStyle}>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={inputStyle}
                  />
                  <button style={eyeButtonStyle} onClick={() => setShowPassword(!showPassword)} tabIndex={-1} type="button">
                    <EyeIcon visible={showPassword} />
                  </button>
                </div>
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

              <div style={inputWrapStyle}>
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  style={inputStyle}
                />
                <button style={eyeButtonStyle} onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1} type="button">
                  <EyeIcon visible={showConfirm} />
                </button>
              </div>

              {error && (
                <p style={{ color: "#E53935", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem" }}>{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{ width: "100%", background: "#D4AF37", color: "#0A2342", border: "none", borderRadius: 6, padding: "0.85rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.06em", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
              >
                {loading ? "Saving…" : "Create Password & Enter My Membership →"}
              </button>
            </div>
          </div>

        ) : (
          /* ── Password recovery — existing member or admin ── */
          <div>
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid #D4AF37", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem", background: "rgba(212,175,55,0.08)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#D4AF37"/>
                </svg>
              </div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                You're In!
              </h1>
              <p style={{ color: "rgba(230,230,230,0.6)", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", lineHeight: 1.65 }}>
                Set a password so you can come back to your portal anytime.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

              <div>
                <div style={inputWrapStyle}>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={inputStyle}
                  />
                  <button style={eyeButtonStyle} onClick={() => setShowPassword(!showPassword)} tabIndex={-1} type="button">
                    <EyeIcon visible={showPassword} />
                  </button>
                </div>
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

              <div style={inputWrapStyle}>
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  style={inputStyle}
                />
                <button style={eyeButtonStyle} onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1} type="button">
                  <EyeIcon visible={showConfirm} />
                </button>
              </div>

              {error && (
                <p style={{ color: "#E53935", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem" }}>{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{ width: "100%", background: "#D4AF37", color: "#0A2342", border: "none", borderRadius: 6, padding: "0.85rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.06em", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
              >
                {loading ? "Saving…" : "Save Password & Enter Portal →"}
              </button>
            </div>
          </div>
        )}

      </div>

      <footer style={{ marginTop: "3rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em", textAlign: "center" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
