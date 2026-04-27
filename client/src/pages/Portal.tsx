import { useState, useEffect, useCallback, useRef } from "react";
import NavBar from "../components/NavBar";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { PathwayStage } from "../contexts/AuthContext";

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

// ── Pathway Stage Logic ───────────────────────────────────────────────────────
const PATHWAY_STAGES = ["Discover", "Diagnose", "Design", "Deploy", "Dominate"];

function isStageActive(stageName: string, pathwayStage: PathwayStage): boolean {
  if (stageName === "Discover") return true;
  if (stageName === "Diagnose" || stageName === "Design") return pathwayStage === "diagnose" || pathwayStage === "deploy";
  if (stageName === "Deploy" || stageName === "Dominate") return pathwayStage === "deploy";
  return false;
}

function getStageStyle(stageName: string, pathwayStage: PathwayStage): React.CSSProperties {
  const active = isStageActive(stageName, pathwayStage);
  const isCurrent =
    (stageName === "Discover" && pathwayStage === "discover") ||
    ((stageName === "Diagnose" || stageName === "Design") && pathwayStage === "diagnose") ||
    ((stageName === "Deploy" || stageName === "Dominate") && pathwayStage === "deploy");
  if (isCurrent) return { background: "#C2185B", border: "1px solid #C2185B", borderRadius: 6, padding: "0.4rem 0.75rem", textAlign: "center" };
  if (active) return { background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.5)", borderRadius: 6, padding: "0.4rem 0.75rem", textAlign: "center" };
  return { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "0.4rem 0.75rem", textAlign: "center" };
}

function getStageTextStyle(stageName: string, pathwayStage: PathwayStage): React.CSSProperties {
  const active = isStageActive(stageName, pathwayStage);
  const isCurrent =
    (stageName === "Discover" && pathwayStage === "discover") ||
    ((stageName === "Diagnose" || stageName === "Design") && pathwayStage === "diagnose") ||
    ((stageName === "Deploy" || stageName === "Dominate") && pathwayStage === "deploy");
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

// ── Daily state type ──────────────────────────────────────────────────────────
// unread    → red pulsing dot
// read      → gold glowing dot
// completed → fire streak (no dot)
type DailyState = "unread" | "read" | "completed";
// ─────────────────────────────────────────────────────────────────────────────

export default function Portal() {
  const { user, pathwayStage, isPaid } = useAuth();
  const userDisplay = user ? getUserDisplay(user) : { firstName: "", avatarUrl: null, initials: "" };
  const [dailyState, setDailyState] = useState<DailyState>("unread");
  const [currentStreak, setCurrentStreak] = useState(0);
  const today = getTodayCST();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Check daily status ────────────────────────────────────────────────────
  const checkDailyStatus = useCallback(async () => {
    if (!user?.id) return;

    const { data: readData } = await supabase
      .from("user_daily_reads")
      .select("read_at, completed_at")
      .eq("user_id", user.id)
      .eq("read_date", today)
      .single();

    if (!readData) {
      setDailyState("unread");
    } else if (readData.completed_at) {
      setDailyState("completed");
    } else {
      setDailyState("read");
    }

    if (isPaid) {
      const { data: streakData } = await supabase
        .from("user_streaks")
        .select("current_streak")
        .eq("user_id", user.id)
        .single();

      if (streakData?.current_streak) setCurrentStreak(streakData.current_streak);
    }
  }, [user?.id, today, isPaid]);

  // ── Initial check + poll every 5s while page is visible ──────────────────
  useEffect(() => {
    checkDailyStatus();

    // Poll every 5 seconds — stops when state reaches "completed"
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        checkDailyStatus();
      }
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkDailyStatus]);

  // Stop polling once completed — no need to keep checking
  useEffect(() => {
    if (dailyState === "completed" && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [dailyState]);

  // Re-check on tab focus and visibility change
  useEffect(() => {
    const handleFocus = () => checkDailyStatus();
    const handleVisibility = () => { if (document.visibilityState === "visible") checkDailyStatus(); };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [checkDailyStatus]);

  // ── Indicator logic ───────────────────────────────────────────────────────
  const getDailyIndicator = () => {
    if (dailyState === "completed") return null;

    if (dailyState === "read") {
      return (
        <div style={{
          position: "absolute", top: 10, right: 10,
          width: 8, height: 8, borderRadius: "50%",
          background: "#D4AF37",
          border: "1.5px solid #0A2342",
          boxShadow: "0 0 6px rgba(212,175,55,0.9)",
        }} />
      );
    }

    // unread — pulsing red
    return (
      <>
        <style>{`
          @keyframes dru-pulse {
            0% { box-shadow: 0 0 0 0 rgba(194,24,91,0.8); }
            70% { box-shadow: 0 0 0 7px rgba(194,24,91,0); }
            100% { box-shadow: 0 0 0 0 rgba(194,24,91,0); }
          }
        `}</style>
        <div style={{
          position: "absolute", top: 10, right: 10,
          width: 8, height: 8, borderRadius: "50%",
          background: "#C2185B",
          border: "1.5px solid #0A2342",
          animation: "dru-pulse 1.5s ease-in-out infinite",
        }} />
      </>
    );
  };

  const getDailySub = () => {
    if (dailyState === "completed" && currentStreak > 0) return `🔥 ${currentStreak}-day streak`;
    if (dailyState === "completed") return "✓ Challenge complete";
    if (dailyState === "read") return "Challenge waiting for you";
    return "Today's leadership insight";
  };

  const getDailyBorder = () =>
    dailyState === "completed" && currentStreak >= 7
      ? "1px solid rgba(212,175,55,0.7)"
      : "1px solid rgba(212,175,55,0.2)";

  const getDailyGlow = () =>
    dailyState === "completed" && currentStreak >= 7
      ? "0 0 18px rgba(212,175,55,0.25)"
      : "none";

  const QUICK_ACTIONS = [
    { key: "assessment", icon: "📋", label: "My Assessment", sub: "View your scorecard results", href: "/" },
    { key: "daily", icon: "⚡", label: "Daily Connection", sub: getDailySub(), href: "/daily", isDaily: true },
    { key: "support", icon: "✉️", label: "Need Support", sub: "Send DeAnna a message", href: "mailto:support@druaiconsulting.com" },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/portal" />

      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 680, margin: "0 auto", width: "100%" }}>

        {/* Welcome header */}
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
          {QUICK_ACTIONS.map((item) => (
            <a key={item.key} href={item.href} style={{ textDecoration: "none" }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: item.isDaily ? getDailyBorder() : "1px solid rgba(212,175,55,0.2)",
                  boxShadow: item.isDaily ? getDailyGlow() : "none",
                  borderRadius: 10, padding: "1.25rem 1rem", cursor: "pointer",
                  transition: "border-color 0.2s, background 0.2s, box-shadow 0.3s",
                  height: "100%", boxSizing: "border-box" as const, position: "relative" as const,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(212,175,55,0.5)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(212,175,55,0.06)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = item.isDaily ? getDailyBorder().replace("border: ", "") : "rgba(212,175,55,0.2)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
              >
                {item.isDaily && getDailyIndicator()}
                <div style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>{item.icon}</div>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.04em", marginBottom: "0.2rem" }}>{item.label}</p>
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.72rem", lineHeight: 1.5 }}>{item.sub}</p>
              </div>
            </a>
          ))}
        </div>

        {/* 7-day streak milestone banner */}
        {dailyState === "completed" && currentStreak >= 7 && (
          <div style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.4rem" }}>🔥</span>
            <div>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontWeight: 700, fontSize: "0.78rem", margin: 0 }}>
                {currentStreak}-Day Streak — You're building real leadership muscle.
              </p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.65rem", margin: 0, marginTop: 2 }}>
                Consistency is the compounding advantage most leaders never unlock.
              </p>
            </div>
          </div>
        )}

        {/* Dynamic Transformation Pathway */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 10, padding: "1.5rem", marginBottom: "1.5rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
            Your DRU AI Transformation Pathway™
          </p>
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
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.7rem", marginTop: "0.75rem", fontStyle: "italic" }}>
            {getStatusText(pathwayStage)}
          </p>
        </div>

      </main>

      <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
