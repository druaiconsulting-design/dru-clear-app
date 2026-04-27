import { useState, useEffect } from "react";
import NavBar from "../components/NavBar";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

// ── Date helpers ──────────────────────────────────────────────────────────────
function getTodayCST(): string {
  const now = new Date();
  const cstOffset = -6 * 60;
  const cst = new Date(now.getTime() + cstOffset * 60 * 1000);
  return cst.toISOString().split("T")[0];
}

function formatDisplayDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface DailyContent {
  insight: string;
  lesson: string;
  lesson_badge: string;
  challenge: string;
}

interface StreakData {
  current_streak: number;
  longest_streak: number;
  total_completions: number;
}

// ── Fallback content (shown while loading or if generation hasn't run yet) ────
const FALLBACK_CONTENT: DailyContent = {
  insight: "The leaders who thrive in the AI era are not those who understand the technology best — they are those who ask the most strategic questions. AI fluency is not about knowing how models work. It is about knowing which problems are worth solving and which decisions require human judgment.",
  lesson: "Clarity in AI strategy means your entire organization — from the boardroom to the front line — can answer one question: 'Why are we pursuing AI, and what does success look like?' Without this shared clarity, AI investments scatter. With it, they compound.",
  lesson_badge: "DRU CLEAR™ · Pillar: Clarity",
  challenge: "Block 20 minutes today and ask your team this one question: 'If we could automate or accelerate one repetitive process with AI this quarter, what would have the biggest impact?' Write down the top three answers. That list is the beginning of your AI priority map.",
};

// ── Locked Card ───────────────────────────────────────────────────────────────
function LockedCard({ title, icon, color, teaser }: { title: string; icon: string; color: string; teaser: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderLeft: "3px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "1.25rem 1.5rem", position: "relative", overflow: "hidden" }}>
      <div style={{ filter: "blur(3px)", pointerEvents: "none", userSelect: "none", opacity: 0.35 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
          <span style={{ fontSize: "1.1rem" }}>{icon}</span>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: color, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{title}</p>
        </div>
        <p style={{ color: "#E6E6E6", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", lineHeight: 1.75 }}>{teaser}</p>
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(10,35,66,0.7)", backdropFilter: "blur(2px)", borderRadius: 10, padding: "1.5rem", gap: "0.75rem" }}>
        <div style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="#D4AF37" strokeWidth="1.75"/>
            <path d="M7 11V7a5 5 0 0110 0v4" stroke="#D4AF37" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.78rem", marginBottom: "0.3rem" }}>Paid Members Only</p>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.55)", fontSize: "0.72rem", lineHeight: 1.5 }}>Book your diagnostic to unlock the full Daily Connection experience</p>
        </div>
        <a href="/frameworks" style={{ display: "inline-block", background: "#C2185B", color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", padding: "0.5rem 1.1rem", borderRadius: 6, textDecoration: "none" }}>
          Book Your Diagnostic →
        </a>
      </div>
    </div>
  );
}

// ── Streak Badge ──────────────────────────────────────────────────────────────
function StreakBadge({ streak }: { streak: StreakData }) {
  if (streak.current_streak === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8, padding: "0.65rem 1rem", marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <span style={{ fontSize: "1.2rem" }}>🔥</span>
        <div>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontWeight: 700, fontSize: "0.85rem", margin: 0 }}>{streak.current_streak}-Day Streak</p>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.65rem", margin: 0 }}>Keep building your leadership muscle</p>
        </div>
      </div>
      <div style={{ marginLeft: "auto", textAlign: "right" }}>
        <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.65rem", margin: 0 }}>Best: {streak.longest_streak} days</p>
        <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.35)", fontSize: "0.6rem", margin: 0 }}>{streak.total_completions} total completions</p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Daily() {
  const { user, isPaid, pathwayStage } = useAuth();
  const [content, setContent] = useState<DailyContent | null>(null);
  const [streak, setStreak] = useState<StreakData>({ current_streak: 0, longest_streak: 0, total_completions: 0 });
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const today = getTodayCST();

  // ── Fetch today's content ─────────────────────────────────────────────────
  useEffect(() => {
    async function fetchContent() {
      try {
        const { data, error } = await supabase
          .from("daily_content")
          .select("insight, lesson, lesson_badge, challenge")
          .eq("content_date", today)
          .eq("stage", pathwayStage)
          .single();

        if (error || !data) {
          setContent(FALLBACK_CONTENT);
        } else {
          setContent(data);
        }
      } catch {
        setContent(FALLBACK_CONTENT);
      } finally {
        setLoading(false);
      }
    }

    fetchContent();
  }, [today, pathwayStage]);

  // ── Fetch streak + check if already completed today ───────────────────────
  useEffect(() => {
    if (!user?.id) return;

    async function fetchStreakAndStatus() {
      // Fetch streak
      const { data: streakData } = await supabase
        .from("user_streaks")
        .select("current_streak, longest_streak, total_completions")
        .eq("user_id", user!.id)
        .single();

      if (streakData) {
        setStreak(streakData);
      }

      // Check if already completed today
      const { data: readData } = await supabase
        .from("user_daily_reads")
        .select("completed_at")
        .eq("user_id", user!.id)
        .eq("read_date", today)
        .single();

      if (readData?.completed_at) {
        setCompleted(true);
      }
    }

    fetchStreakAndStatus();
  }, [user?.id, today]);

  // ── Mark as read when user visits ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    supabase.functions.invoke("handle-daily-action", {
      body: { action: "mark_read", user_id: user.id, read_date: today },
    }).catch(() => {});
  }, [user?.id, today]);

  // ── Handle challenge completion ───────────────────────────────────────────
  const handleComplete = async () => {
    if (completed || completing || !user?.id) return;
    setCompleting(true);

    try {
      const { data } = await supabase.functions.invoke("handle-daily-action", {
        body: { action: "complete_challenge", user_id: user.id, read_date: today },
      });

      if (data?.success) {
        setCompleted(true);
        if (data.current_streak !== undefined) {
          setStreak({
            current_streak: data.current_streak,
            longest_streak: data.longest_streak,
            total_completions: data.total_completions,
          });
        }
      }
    } catch {
      // Still mark as completed visually even if network fails
      setCompleted(true);
    } finally {
      setCompleting(false);
    }
  };

  const displayContent = content || FALLBACK_CONTENT;

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/daily" />

      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 680, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.3rem" }}>Daily Connection</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.85rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.4rem" }}>Today's Leadership Fuel</h1>
          <p style={{ color: "rgba(230,230,230,0.4)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem" }}>{formatDisplayDate()}</p>
        </div>

        {/* Gold divider */}
        <div style={{ height: 1, background: "linear-gradient(90deg, rgba(212,175,55,0.5) 0%, rgba(212,175,55,0.08) 100%)", marginBottom: "2rem" }} />

        {/* Streak badge — paid users only */}
        {isPaid && <StreakBadge streak={streak} />}

        {/* Free tier banner */}
        {!isPaid && (
          <div style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8, padding: "0.875rem 1.1rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" as const }}>
            <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.65)", fontSize: "0.78rem", lineHeight: 1.6, margin: 0 }}>
              You're viewing your free daily insight. Book a diagnostic to unlock the full experience.
            </p>
            <a href="/frameworks" style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontWeight: 700, fontSize: "0.68rem", letterSpacing: "0.06em", textTransform: "uppercase", textDecoration: "none", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
              Upgrade →
            </a>
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.1)", borderRadius: 10, padding: "1.25rem 1.5rem", height: 120, animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* AI Leadership Insight — always free */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.3)", borderLeft: "3px solid #D4AF37", borderRadius: 10, padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
                <span style={{ fontSize: "1.1rem" }}>⚡</span>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>AI Leadership Insight</p>
              </div>
              <p style={{ color: "#E6E6E6", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", lineHeight: 1.75 }}>{displayContent.insight}</p>
            </div>

            {/* Framework Micro-Lesson — paid only */}
            {isPaid ? (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(194,24,91,0.3)", borderLeft: "3px solid #C2185B", borderRadius: 10, padding: "1.25rem 1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "1.1rem" }}>🧠</span>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Framework Micro-Lesson</p>
                </div>
                <span style={{ display: "inline-block", fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em", color: "#D4AF37", background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 4, padding: "0.18rem 0.5rem", marginBottom: "0.875rem" }}>
                  {displayContent.lesson_badge}
                </span>
                <p style={{ color: "#E6E6E6", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", lineHeight: 1.75 }}>{displayContent.lesson}</p>
              </div>
            ) : (
              <LockedCard title="Framework Micro-Lesson" icon="🧠" color="#C2185B" teaser={displayContent.lesson} />
            )}

            {/* Action Challenge — paid only */}
            {isPaid ? (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(30,136,229,0.3)", borderLeft: "3px solid #1E88E5", borderRadius: 10, padding: "1.25rem 1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
                  <span style={{ fontSize: "1.1rem" }}>🎯</span>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#1E88E5", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Today's Action Challenge</p>
                </div>
                <p style={{ color: "#E6E6E6", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", lineHeight: 1.75, marginBottom: "1.25rem" }}>{displayContent.challenge}</p>
                <button
                  onClick={handleComplete}
                  disabled={completed || completing}
                  style={{ width: "100%", background: completed ? "rgba(67,160,71,0.15)" : completing ? "rgba(30,136,229,0.5)" : "#1E88E5", color: completed ? "#43A047" : "#FFFFFF", border: completed ? "1px solid rgba(67,160,71,0.4)" : "none", borderRadius: 6, padding: "0.75rem 1rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.06em", cursor: completed ? "default" : "pointer", transition: "all 0.3s" }}
                >
                  {completed ? "✓ Challenge Complete — Well done!" : completing ? "Saving..." : "I Completed This Challenge"}
                </button>

                {/* Streak update message */}
                {completed && streak.current_streak > 0 && (
                  <div style={{ marginTop: "0.75rem", textAlign: "center" }}>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.72rem", fontWeight: 700 }}>
                      🔥 {streak.current_streak}-day streak — you're building real momentum.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <LockedCard title="Today's Action Challenge" icon="🎯" color="#1E88E5" teaser={displayContent.challenge} />
            )}

          </div>
        )}

        {/* Share nudge */}
        <div style={{ marginTop: "2rem", background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 8, padding: "1rem 1.25rem", textAlign: "center" }}>
          <p style={{ color: "rgba(230,230,230,0.55)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", lineHeight: 1.6 }}>
            Know a leader who needs this? Share the DRU CLEAR™ Scorecard and start the conversation.
          </p>
          <a href="/" style={{ display: "inline-block", marginTop: "0.6rem", color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none" }}>
            Share the Assessment →
          </a>
        </div>

      </main>

      <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
