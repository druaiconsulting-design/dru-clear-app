import { useState, useEffect, useRef } from "react";
import NavBar from "../components/NavBar";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { registerPasskey } from "../lib/passkey";
import type { PathwayStage } from "../contexts/AuthContext";

// ── Global pulse animation injected once ─────────────────────────────────────
const PULSE_STYLE = `
  @keyframes dru-pulse {
    0%   { box-shadow: 0 0 0 0 rgba(194,24,91,0.8); }
    70%  { box-shadow: 0 0 0 7px rgba(194,24,91,0); }
    100% { box-shadow: 0 0 0 0 rgba(194,24,91,0); }
  }
`;

function getUserDisplay(user: any): { firstName: string; avatarUrl: string | null; initials: string } {
  const firstName = user?.firstName || "";
  const fullName = user?.fullName || firstName;
  const email = user?.email || "";
  const avatarUrl = user?.picture || null;
  const displayFirst = firstName || email.split("@")[0] || "";
  const initials = fullName
    ? fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();
  return { firstName: displayFirst, avatarUrl, initials };
}

function PortalAvatar({ user }: { user: any }) {
  const { avatarUrl, initials } = getUserDisplay(user);
  const [imgError, setImgError] = useState(false);
  if (avatarUrl && !imgError) {
    return (
      <img src={avatarUrl} alt="Profile" onError={() => setImgError(true)}
        style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(212,175,55,0.5)", flexShrink: 0 }} />
    );
  }
  return (
    <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(212,175,55,0.12)", border: "2px solid rgba(212,175,55,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "#D4AF37", lineHeight: 1 }}>{initials}</span>
    </div>
  );
}

// ── Need Support Modal ────────────────────────────────────────────────────────
function SupportModal({ onClose, userEmail }: { onClose: () => void; userEmail?: string }) {
  const [copied, setCopied] = useState(false);
  const supportEmail = "support@druaiconsulting.com";
  const subject = "Support Request — DRU CLEAR™ Member";
  const mailtoHref = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(supportEmail).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#0d2340", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 12, padding: "2rem 1.75rem", maxWidth: 360, width: "100%", boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
          <div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 0.3rem" }}>Need Support</p>
            <h3 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>We're Here for You</h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "1.3rem", lineHeight: 1, padding: "0.25rem", marginTop: "-2px" }}>×</button>
        </div>

        <div style={{ height: 1, background: "rgba(212,175,55,0.15)", marginBottom: "1.25rem" }} />

        <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.7)", fontSize: "0.82rem", lineHeight: 1.7, marginBottom: "1.5rem" }}>
          Have a question or need assistance? Email us directly and we'll get back to you within 1 business day.
        </p>

        <a
          href={mailtoHref}
          style={{ display: "block", width: "100%", background: "#C2185B", color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", textAlign: "center", padding: "0.85rem 1rem", borderRadius: 6, marginBottom: "0.75rem", boxSizing: "border-box" }}
        >
          ✉️  Send Us an Email
        </a>

        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 8, padding: "0.75rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.55)", fontSize: "0.72rem", margin: 0 }}>{supportEmail}</p>
          <button
            onClick={handleCopy}
            style={{ background: "none", border: "none", color: copied ? "#43A047" : "rgba(212,175,55,0.7)", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.06em", cursor: "pointer", whiteSpace: "nowrap", padding: 0, transition: "color 0.2s" }}
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pathway Stage Logic ───────────────────────────────────────────────────────
const PATHWAY_STAGES = ["Discover", "Diagnose", "Design", "Deploy", "Dominate"];

function isStageActive(stageName: string, pathwayStage: PathwayStage): boolean {
  if (stageName === "Discover") return true;
  if (stageName === "Diagnose" || stageName === "Design") return pathwayStage === "diagnose" || pathwayStage === "deploy";
  if (stageName === "Deploy" || stageName === "Dominate") return pathwayStage === "deploy";
  return false;
}

function getStageStyle(stageName: string, pathwayStage: PathwayStage): React.CSSProperties {
  const isCurrent =
    (stageName === "Discover" && pathwayStage === "discover") ||
    ((stageName === "Diagnose" || stageName === "Design") && pathwayStage === "diagnose") ||
    ((stageName === "Deploy" || stageName === "Dominate") && pathwayStage === "deploy");
  const active = isStageActive(stageName, pathwayStage);
  if (isCurrent) return { background: "#C2185B", border: "1px solid #C2185B", borderRadius: 6, padding: "0.4rem 0.75rem", textAlign: "center" };
  if (active) return { background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.5)", borderRadius: 6, padding: "0.4rem 0.75rem", textAlign: "center" };
  return { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "0.4rem 0.75rem", textAlign: "center" };
}

function getStageTextStyle(stageName: string, pathwayStage: PathwayStage): React.CSSProperties {
  const isCurrent =
    (stageName === "Discover" && pathwayStage === "discover") ||
    ((stageName === "Diagnose" || stageName === "Design") && pathwayStage === "diagnose") ||
    ((stageName === "Deploy" || stageName === "Dominate") && pathwayStage === "deploy");
  const active = isStageActive(stageName, pathwayStage);
  return { fontFamily: "'Montserrat', sans-serif", color: isCurrent ? "#FFFFFF" : active ? "#D4AF37" : "rgba(255,255,255,0.3)", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.06em" };
}

function getStatusText(pathwayStage: PathwayStage): string {
  if (pathwayStage === "discover") return "You are in the Discover stage. Your diagnostic purchase unlocks Diagnose + Design.";
  if (pathwayStage === "diagnose") return "Diagnose + Design are unlocked. A framework or bundle purchase unlocks Deploy + Dominate.";
  if (pathwayStage === "deploy") return "Your full transformation pathway is unlocked. Your AI leadership journey is underway.";
  return "";
}

function getTodayCST(): string {
  const now = new Date();
  const cstOffset = -6 * 60;
  const cst = new Date(now.getTime() + cstOffset * 60 * 1000);
  return cst.toISOString().split("T")[0];
}

type DailyState = "unread" | "read" | "completed";

export default function Portal() {
  const { user, pathwayStage, isPaid } = useAuth();
  const userDisplay = user ? getUserDisplay(user) : { firstName: "", avatarUrl: null, initials: "" };
  const [dailyState, setDailyState] = useState<DailyState>("unread");
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showSupport, setShowSupport] = useState(false);
  const today = getTodayCST();
  const isFetching = useRef(false);

  // ── Passkey state ─────────────────────────────────────────────────────────
  const [hasPasskey, setHasPasskey] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState("");
  const [passkeyDismissed, setPasskeyDismissed] = useState(false);

  // ── Check if user already has a passkey ───────────────────────────────────
  useEffect(() => {
    async function checkPasskey() {
      if (!user?.id) return;
      const { data } = await supabase
        .from("passkey_credentials")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      if (data && data.length > 0) setHasPasskey(true);
    }
    checkPasskey();
  }, [user?.id]);

  const handleSetupPasskey = async () => {
    setPasskeyLoading(true);
    setPasskeyMessage("");
    const result = await registerPasskey();
    setPasskeyLoading(false);
    if (result.success) {
      setHasPasskey(true);
      setPasskeyMessage("Passkey saved — you can now sign in with biometrics.");
    } else {
      setPasskeyMessage(result.error || "Something went wrong.");
    }
  };

  // ── Check daily status ────────────────────────────────────────────────────
  async function checkDailyStatus() {
    if (!user?.id || isFetching.current) return;
    isFetching.current = true;
    try {
      const { data: readData } = await supabase
        .from("user_daily_reads")
        .select("read_at, completed_at")
        .eq("user_id", user.id)
        .eq("read_date", today)
        .maybeSingle();

      if (!readData) setDailyState("unread");
      else if (readData.completed_at) setDailyState("completed");
      else setDailyState("read");

      if (isPaid) {
        const { data: streakData } = await supabase
          .from("user_streaks")
          .select("current_streak")
          .eq("user_id", user.id)
          .maybeSingle();
        if (streakData?.current_streak) setCurrentStreak(streakData.current_streak);
      }
    } catch {}
    finally { isFetching.current = false; }
  }

  useEffect(() => {
    if (user?.id) checkDailyStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const handleFocus = () => { if (user?.id) checkDailyStatus(); };
    const handleVisibility = () => { if (document.visibilityState === "visible" && user?.id) checkDailyStatus(); };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Indicator ─────────────────────────────────────────────────────────────
  const getDailyIndicator = () => {
    if (dailyState === "completed") return null;
    if (dailyState === "read") {
      return <div style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: "50%", background: "#D4AF37", border: "1.5px solid #0A2342", boxShadow: "0 0 6px rgba(212,175,55,0.9)" }} />;
    }
    return <div style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: "50%", background: "#C2185B", border: "1.5px solid #0A2342", animation: "dru-pulse 1.5s ease-in-out infinite" }} />;
  };

  const getDailySub = () => {
    if (dailyState === "completed" && currentStreak > 0) return `🔥 ${currentStreak}-day streak`;
    if (dailyState === "completed") return "✓ Challenge complete";
    if (dailyState === "read") return "Challenge waiting for you";
    return "Today's leadership insight";
  };

  const getDailyBorder = () =>
    dailyState === "completed" && currentStreak >= 7 ? "1px solid rgba(212,175,55,0.7)" : "1px solid rgba(212,175,55,0.2)";

  const getDailyGlow = () =>
    dailyState === "completed" && currentStreak >= 7 ? "0 0 18px rgba(212,175,55,0.25)" : "none";

  const QUICK_ACTIONS = [
    {
      key: "assessment",
      icon: "📋",
      label: "My Assessment",
      sub: "View your assessment results",
      href: "/my-results",
      onClick: undefined as (() => void) | undefined,
    },
    {
      key: "daily",
      icon: "⚡",
      label: "Daily Connection",
      sub: getDailySub(),
      href: "/daily",
      onClick: undefined as (() => void) | undefined,
      isDaily: true,
    },
    {
      key: "support",
      icon: "✉️",
      label: "Need Support",
      sub: "Get in touch with us",
      href: "#",
      onClick: () => setShowSupport(true),
    },
  ];

  return (
    <>
      <style>{PULSE_STYLE}</style>

      {showSupport && <SupportModal onClose={() => setShowSupport(false)} userEmail={user?.email} />}

      <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
        <NavBar active="/portal" />

        <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 680, margin: "0 auto", width: "100%" }}>

          <div style={{ marginBottom: "2rem" }}>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>Your AI Transformation Hub</p>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.875rem" }}>
              {user && <PortalAvatar user={user} />}
              <div>
                <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.2rem" }}>
                  {userDisplay.firstName
                    ? <>Welcome Back, <span style={{ color: "#D4AF37" }}>{userDisplay.firstName}</span></>
                    : <>Welcome Back</>}
                </h1>
                {user?.email && <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.35)", fontSize: "0.72rem", margin: 0 }}>{user.email}</p>}
              </div>
            </div>
            <p style={{ color: "rgba(230,230,230,0.7)", fontFamily: "'Inter', sans-serif", fontSize: "0.9rem", lineHeight: 1.7 }}>
              Everything you need to accelerate your AI leadership journey — in one place.
            </p>
          </div>

          {/* 3 Quick action cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
            {QUICK_ACTIONS.map((item) => {
              const isDaily = item.key === "daily";
              const cardStyle: React.CSSProperties = {
                background: "rgba(255,255,255,0.04)",
                border: isDaily ? getDailyBorder() : "1px solid rgba(212,175,55,0.2)",
                boxShadow: isDaily ? getDailyGlow() : "none",
                borderRadius: 10,
                padding: "1.25rem 1rem",
                cursor: "pointer",
                transition: "border-color 0.2s, background 0.2s",
                height: "100%",
                boxSizing: "border-box",
                position: "relative",
              };

              const inner = (
                <div
                  style={cardStyle}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(212,175,55,0.5)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(212,175,55,0.06)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = isDaily ? getDailyBorder() : "rgba(212,175,55,0.2)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
                >
                  {isDaily && getDailyIndicator()}
                  <div style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>{item.icon}</div>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.04em", marginBottom: "0.2rem" }}>{item.label}</p>
                  <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.72rem", lineHeight: 1.5 }}>{item.sub}</p>
                </div>
              );

              if (item.onClick) {
                return (
                  <div key={item.key} style={{ textDecoration: "none" }} onClick={item.onClick}>
                    {inner}
                  </div>
                );
              }

              return (
                <a key={item.key} href={item.href} style={{ textDecoration: "none" }}>
                  {inner}
                </a>
              );
            })}
          </div>

          {/* ── Passkey Setup Card ──────────────────────────────────────────── */}
          {!passkeyDismissed && (
            <div style={{
              background: hasPasskey ? "rgba(67,160,71,0.06)" : "rgba(212,175,55,0.04)",
              border: hasPasskey ? "1px solid rgba(67,160,71,0.3)" : "1px solid rgba(212,175,55,0.2)",
              borderRadius: 10,
              padding: "1rem 1.25rem",
              marginBottom: "1.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flex: 1, minWidth: 0 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: hasPasskey ? "rgba(67,160,71,0.12)" : "rgba(212,175,55,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: "1.1rem",
                }}>
                  {hasPasskey ? "✅" : "🔐"}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontFamily: "'Montserrat', sans-serif",
                    color: hasPasskey ? "#43A047" : "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    letterSpacing: "0.04em",
                    margin: 0,
                    marginBottom: "0.1rem",
                  }}>
                    {hasPasskey ? "Passkey Active" : "Speed Up Your Login"}
                  </p>
                  <p style={{
                    fontFamily: "'Inter', sans-serif",
                    color: "rgba(230,230,230,0.45)",
                    fontSize: "0.68rem",
                    margin: 0,
                    lineHeight: 1.4,
                  }}>
                    {hasPasskey
                      ? "Face ID or fingerprint sign-in is enabled."
                      : "Set up Face ID or fingerprint to sign in instantly."}
                  </p>
                  {passkeyMessage && (
                    <p style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: "0.68rem",
                      margin: "0.35rem 0 0",
                      color: hasPasskey ? "#43A047" : "#E53935",
                    }}>
                      {passkeyMessage}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                {!hasPasskey && (
                  <button
                    onClick={handleSetupPasskey}
                    disabled={passkeyLoading}
                    style={{
                      background: "#D4AF37",
                      color: "#0A2342",
                      border: "none",
                      borderRadius: 6,
                      padding: "0.55rem 1rem",
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 700,
                      fontSize: "0.7rem",
                      letterSpacing: "0.06em",
                      cursor: passkeyLoading ? "default" : "pointer",
                      opacity: passkeyLoading ? 0.7 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {passkeyLoading ? "Setting up..." : "Set Up →"}
                  </button>
                )}
                {hasPasskey && (
                  <button
                    onClick={() => setPasskeyDismissed(true)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(255,255,255,0.3)",
                      cursor: "pointer",
                      fontSize: "1.1rem",
                      lineHeight: 1,
                      padding: "0.25rem",
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 7-day streak milestone banner */}
          {dailyState === "completed" && currentStreak >= 7 && (
            <div style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.4rem" }}>🔥</span>
              <div>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontWeight: 700, fontSize: "0.78rem", margin: 0 }}>{currentStreak}-Day Streak — You're building real leadership muscle.</p>
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.65rem", margin: 0, marginTop: 2 }}>Consistency is the compounding advantage most leaders never unlock.</p>
              </div>
            </div>
          )}

          {/* Dynamic Transformation Pathway */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 10, padding: "1.5rem", marginBottom: "1.5rem" }}>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>Your DRU AI Transformation Pathway™</p>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", overflowX: "auto", paddingBottom: "0.5rem" }}>
              {PATHWAY_STAGES.map((stage, i) => (
                <div key={stage} style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                  <div style={getStageStyle(stage, pathwayStage)}>
                    <p style={getStageTextStyle(stage, pathwayStage)}>{stage}</p>
                  </div>
                  {i < 4 && <span style={{ color: isStageActive(PATHWAY_STAGES[i + 1], pathwayStage) ? "rgba(212,175,55,0.6)" : "rgba(255,255,255,0.15)", fontSize: "0.8rem" }}>→</span>}
                </div>
              ))}
            </div>
            <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.7rem", marginTop: "0.75rem", fontStyle: "italic" }}>{getStatusText(pathwayStage)}</p>
          </div>

        </main>

        <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
          © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
        </footer>
      </div>
    </>
  );
}
