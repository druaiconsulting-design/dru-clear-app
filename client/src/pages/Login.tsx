import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

type Mode = "choose" | "admin" | "client-email" | "client-login" | "client-register" | "forgot-password" | "forgot-sent";

export default function Login() {
  const { loginAdmin, loginClient, registerClient, loginWithGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  const btnGold = {
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
    cursor: "pointer",
  } as const;

  const btnMagenta = { ...btnGold, background: "#C2185B", color: "#FFFFFF" };

  const getPasswordStrength = (p: string) => {
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
  };

  const strength = getPasswordStrength(password);

  const handleGoogleLogin = async () => {
    setError(""); setLoading(true);
    const result = await loginWithGoogle();
    if (!result.success) { setError(result.error || "Google sign in failed."); setLoading(false); }
  };

  const handleAdminLogin = async () => {
    setError(""); setLoading(true);
    const result = await loginAdmin(email, password);
    setLoading(false);
    if (!result.success) setError(result.error || "Login failed.");
    else window.location.href = "/admin";
  };

  const handleClientLogin = async () => {
    setError(""); setLoading(true);
    const result = await loginClient(email, password);
    setLoading(false);
    if (!result.success) setError(result.error || "Login failed.");
    else window.location.href = "/portal";
  };

  const handleClientRegister = async () => {
    setError(""); setLoading(true);
    if (!firstName) { setError("Please enter your first name."); setLoading(false); return; }
    const result = await registerClient(email, password, firstName);
    setLoading(false);
    if (!result.success) setError(result.error || "Registration failed.");
    else window.location.href = "/portal";
  };

  const handleForgotPassword = async () => {
    setError(""); setLoading(true);
    if (!email) { setError("Please enter your email."); setLoading(false); return; }
    const result = await resetPassword(email);
    setLoading(false);
    if (!result.success) setError(result.error || "Could not send reset email.");
    else setMode("forgot-sent");
  };

  const back = (to: Mode) => () => { setMode(to); setError(""); setPassword(""); };

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <p style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "1.8rem", fontWeight: 700, letterSpacing: "0.04em", marginBottom: "0.25rem" }}>DRU</p>
        <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.4)", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>AI Consulting</p>
      </div>

      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* CHOOSE */}
        {mode === "choose" && (
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.75rem", fontWeight: 700, textAlign: "center", marginBottom: "0.5rem" }}>Welcome</h1>
            <p style={{ color: "rgba(230,230,230,0.5)", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", textAlign: "center", marginBottom: "2rem" }}>Sign in to your DRU AI ecosystem</p>

            {/* Google */}
            <button onClick={handleGoogleLogin} disabled={loading} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", background: "#FFFFFF", color: "#1a1a1a", border: "none", borderRadius: 8, padding: "0.85rem 1rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.04em", cursor: "pointer", marginBottom: "0.875rem" }}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
                <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
                <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
              </svg>
              {loading ? "Redirecting..." : "Continue with Google"}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.875rem" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
              <span style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Inter', sans-serif", fontSize: "0.72rem" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button onClick={() => setMode("admin")} style={{ background: "rgba(194,24,91,0.1)", border: "1px solid rgba(194,24,91,0.35)", borderRadius: 10, padding: "1rem 1.25rem", cursor: "pointer", textAlign: "left" }}>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.15rem" }}>Admin Access</p>
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.72rem" }}>Authorized personnel only</p>
              </button>
              <button onClick={() => setMode("client-email")} style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 10, padding: "1rem 1.25rem", cursor: "pointer", textAlign: "left" }}>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.15rem" }}>Client Portal</p>
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.72rem" }}>Sign in with email & password</p>
              </button>
            </div>
            {error && <p style={{ color: "#E53935", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", marginTop: "1rem", textAlign: "center" }}>{error}</p>}
            <p style={{ textAlign: "center", marginTop: "1.5rem" }}>
              <a href="/" style={{ color: "rgba(212,175,55,0.6)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", textDecoration: "none" }}>← Back to Assessment</a>
            </p>
          </div>
        )}

        {/* ADMIN */}
        {mode === "admin" && (
          <div>
            <button onClick={back("choose")} style={{ background: "none", border: "none", color: "rgba(212,175,55,0.6)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", cursor: "pointer", marginBottom: "1.5rem", padding: 0 }}>← Back</button>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>Admin Sign In</h1>
            <p style={{ color: "rgba(230,230,230,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", marginBottom: "1.75rem" }}>DRU AI Consulting — Command Center</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", marginBottom: "1.25rem" }}>
              <input type="email" placeholder="Admin email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()} style={inputStyle} />
            </div>
            {error && <p style={{ color: "#E53935", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", marginBottom: "0.875rem" }}>{error}</p>}
            <button onClick={handleAdminLogin} disabled={loading} style={btnMagenta}>{loading ? "Signing in..." : "Sign In →"}</button>
          </div>
        )}

        {/* CLIENT EMAIL */}
        {mode === "client-email" && (
          <div>
            <button onClick={back("choose")} style={{ background: "none", border: "none", color: "rgba(212,175,55,0.6)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", cursor: "pointer", marginBottom: "1.5rem", padding: 0 }}>← Back</button>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>Client Portal</h1>
            <p style={{ color: "rgba(230,230,230,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", marginBottom: "1.75rem" }}>Enter your email to continue</p>
            <input type="email" placeholder="Your email address" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setMode("client-login")} style={{ ...inputStyle, marginBottom: "1.25rem" }} />
            {error && <p style={{ color: "#E53935", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", marginBottom: "0.875rem" }}>{error}</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <button onClick={() => { if (email) setMode("client-login"); else setError("Please enter your email."); }} style={btnGold}>Sign In →</button>
              <button onClick={() => { if (email) setMode("client-register"); else setError("Please enter your email."); }} style={{ ...btnGold, background: "transparent", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.35)" }}>Create Account →</button>
            </div>
          </div>
        )}

        {/* CLIENT LOGIN */}
        {mode === "client-login" && (
          <div>
            <button onClick={back("client-email")} style={{ background: "none", border: "none", color: "rgba(212,175,55,0.6)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", cursor: "pointer", marginBottom: "1.5rem", padding: 0 }}>← Back</button>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>Welcome Back</h1>
            <p style={{ color: "rgba(230,230,230,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", marginBottom: "1.75rem" }}>Signing in as <span style={{ color: "#D4AF37" }}>{email}</span></p>
            <input type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleClientLogin()} style={{ ...inputStyle, marginBottom: "0.5rem" }} />
            <button onClick={() => setMode("forgot-password")} style={{ background: "none", border: "none", color: "rgba(212,175,55,0.5)", fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", cursor: "pointer", padding: 0, marginBottom: "1.25rem", display: "block" }}>Forgot password?</button>
            {error && <p style={{ color: "#E53935", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", marginBottom: "0.875rem" }}>{error}</p>}
            <button onClick={handleClientLogin} disabled={loading} style={btnGold}>{loading ? "Signing in..." : "Enter Portal →"}</button>
          </div>
        )}

        {/* CLIENT REGISTER */}
        {mode === "client-register" && (
          <div>
            <button onClick={back("client-email")} style={{ background: "none", border: "none", color: "rgba(212,175,55,0.6)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", cursor: "pointer", marginBottom: "1.5rem", padding: 0 }}>← Back</button>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>Create Account</h1>
            <p style={{ color: "rgba(230,230,230,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", marginBottom: "1.75rem" }}>Setting up access for <span style={{ color: "#D4AF37" }}>{email}</span></p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", marginBottom: "0.5rem" }}>
              <input type="text" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
              <input type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            </div>
            {password.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden", marginBottom: "0.35rem" }}>
                  <div style={{ height: "100%", width: strength.width, background: strength.color, borderRadius: 2, transition: "all 0.3s" }} />
                </div>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.7rem", color: strength.color }}>{strength.label} — min 8 chars, 1 number, 1 special character</p>
              </div>
            )}
            {error && <p style={{ color: "#E53935", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", marginBottom: "0.875rem" }}>{error}</p>}
            <button onClick={handleClientRegister} disabled={loading} style={btnGold}>{loading ? "Creating account..." : "Create Account & Enter Portal →"}</button>
          </div>
        )}

        {/* FORGOT PASSWORD */}
        {mode === "forgot-password" && (
          <div>
            <button onClick={back("client-login")} style={{ background: "none", border: "none", color: "rgba(212,175,55,0.6)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", cursor: "pointer", marginBottom: "1.5rem", padding: 0 }}>← Back</button>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>Reset Password</h1>
            <p style={{ color: "rgba(230,230,230,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", marginBottom: "1.75rem" }}>Enter your email and we'll send you a reset link.</p>
            <input type="email" placeholder="Your email address" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleForgotPassword()} style={{ ...inputStyle, marginBottom: "1.25rem" }} />
            {error && <p style={{ color: "#E53935", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", marginBottom: "0.875rem" }}>{error}</p>}
            <button onClick={handleForgotPassword} disabled={loading} style={btnGold}>{loading ? "Sending..." : "Send Reset Link →"}</button>
          </div>
        )}

        {/* FORGOT SENT */}
        {mode === "forgot-sent" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", border: "2px solid #43A047", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M5 14L11 20L23 8" stroke="#43A047" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.75rem" }}>Check Your Email</h1>
            <p style={{ color: "rgba(230,230,230,0.6)", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", lineHeight: 1.7, marginBottom: "2rem" }}>
              We sent a password reset link to <span style={{ color: "#D4AF37" }}>{email}</span>. Check your inbox and follow the link to create a new password.
            </p>
            <button onClick={back("choose")} style={btnGold}>Back to Sign In</button>
          </div>
        )}

      </div>

      <footer style={{ marginTop: "3rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em", textAlign: "center" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
