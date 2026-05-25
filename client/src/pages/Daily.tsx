import { useState, useEffect } from "react";
import NavBar from "../components/NavBar";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

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

interface DailyContent {
  insight: string;
  lesson: string;
  lesson_badge: string;
  challenge: string;
  strategic_edge?: string;
}

interface StreakData {
  current_streak: number;
  longest_streak: number;
  total_completions: number;
}

const FALLBACK_CONTENT: DailyContent = {
  insight: "The leaders who thrive in the AI era are not those who understand the technology best — they are those who ask the most strategic questions. AI fluency is not about knowing how models work. It is about knowing which problems are worth solving and which decisions require human judgment.",
  lesson: "Clarity in AI strategy means your entire organization — from the boardroom to the front line — can answer one question: 'Why are we pursuing AI, and what does success look like?' Without this shared clarity, AI investments scatter. With it, they compound.",
  lesson_badge: "DRU CLEAR™ · Pillar: Clarity",
  challenge: "Block 20 minutes today and ask your team this one question: 'If we could automate or accelerate one repetitive process with AI this quarter, what would have the biggest impact?' Write down the top three answers. That list is the beginning of your AI priority map.",
  strategic_edge: "Most leaders are asking the wrong question about AI. They ask 'What can AI do?' when the only question that matters is 'What does my organization need to become?' Your AI strategy is not a technology decision — it is a leadership identity decision. Make it from that place.",
};

const ASSESSMENT_URL = "https://assessment.druaiconsulting.com";

// ── Locked Card ───────────────────────────────────────────────────────────────
function LockedCard({
  title, icon, color, teaser, ctaText, ctaHref,
}: {
  title: string; icon: string; color: string; teaser: string;
  ctaText?: string; ctaHref?: string;
}) {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderLeft: "3px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "1.25rem 1.5rem", position: "relative", overflow: "hidden" }}>
      <div style={{ filter: "blur(3px)", pointerEvents: "none", userSelect: "none", opacity: 0.35 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
          <span style={{ fontSize: "1.1rem" }}>{icon}</span>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: color, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>{title}</p>
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
        <div style={{ textAlign: "center" as const }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.78rem", marginBottom: "0.3rem" }}>
            {ctaText ? "Navigator & Accelerator Members Only" : "Paid Members Only"}
          </p>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.55)", fontSize: "0.72rem", lineHeight: 1.5 }}>
            {ctaText
              ? "Upgrade to Navigator or Accelerator to unlock DeAnna's exclusive daily strategic insight"
              : "Book your diagnostic to unlock the full Daily Connection experience"}
          </p>
        </div>
        <a
          href={ctaHref || "/frameworks"}
          style={{ display: "inline-block", background: "#C2185B", color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "0.5rem 1.1rem", borderRadius: 6, textDecoration: "none" }}
        >
          {ctaText || "Book Your Diagnostic →"}
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
      <div style={{ marginLeft: "auto", textAlign: "right" as const }}>
        <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.65rem", margin: 0 }}>Best: {streak.longest_streak} days</p>
        <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.35)", fontSize: "0.6rem", margin: 0 }}>{streak.total_completions} total completions</p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Daily() {
  const { user, isPaid, hasStrategicEdge, pathwayStage } = useAuth();
  const [content, setContent] = useState<DailyContent | null>(null);
  const [streak, setStreak] = useState<StreakData>({ current_streak: 0, longest_streak: 0, total_completions: 0 });
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const today = getTodayCST();

  const handleCopy = () => {
    navigator.clipboard.writeText(ASSESSMENT_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // ── Fetch today's content ─────────────────────────────────────────────────
  useEffect(() => {
    async function fetchContent() {
      try {
        const { data } = await supabase
          .from("daily_content")
          .select("insight, lesson, lesson_badge, challenge, strategic_edge")
          .eq("content_date", today)
          .eq("stage", pathwayStage)
          .maybeSingle();
        setContent(data || FALLBACK_CONTENT);
      } catch {
        setContent(FALLBACK_CONTENT);
      } finally {
        setLoading(false);
      }
    }
    fetchContent();
  }, [today, pathwayStage]);

  // ── Fetch streak + completion status ─────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    async function fetchStatus() {
      try {
        const { data: readData } = await supabase
          .from("user_daily_reads")
          .select("completed_at")
          .eq("user_id", user!.id)
          .eq("read_date", today)
          .maybeSingle();
        if (readData?.completed_at) setCompleted(true);

        const { data: streakData } = await supabase
          .from("user_streaks")
          .select("current_streak, longest_streak, total_completions")
          .eq("user_id", user!.id)
          .maybeSingle();
        if (streakData) setStreak(streakData);
      } catch {}
    }
    fetchStatus();
  }, [user?.id, today]);

  // ── Mark as read on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("user_daily_reads")
      .upsert(
        { user_id: user.id, read_date: today, read_at: new Date().toISOString() },
        { onConflict: "user_id,read_date", ignoreDuplicates: true }
      )
      .then(() => {});
  }, [user?.id, today]);

  // ── Handle challenge completion ───────────────────────────────────────────
  const handleComplete = async () => {
    if (completed || completing || !user?.id) return;
    setCompleting(true);
    const now = new Date().toISOString();
    try {
      await supabase
        .from("user_daily_reads")
        .upsert(
          { user_id: user.id, read_date: today, completed_at: now, read_at: now },
          { onConflict: "user_id,read_date" }
        );
      setCompleted(true);
      supabase.functions.invoke("handle-daily-action", {
        body: { action: "complete_challenge", user_id: user.id, read_date: today },
      }).then(({ data }) => {
        if (data?.current_streak !== undefined) {
          setStreak({
            current_streak:   data.current_streak,
            longest_streak:   data.longest_streak,
            total_completions: data.total_completions,
          });
        }
      }).catch(() => {});
    } catch {
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
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "0.3rem" }}>Daily Connection</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.85rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.4rem" }}>Today's Leadership Fuel</h1>
          <p style={{ color: "rgba(230,230,230,0.4)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem" }}>{formatDisplayDate()}</p>
        </div>

        <div style={{ height: 1, background: "linear-gradient(90deg, rgba(212,175,55,0.5) 0%, rgba(212,175,55,0.08) 100%)", marginBottom: "2rem" }} />

        {isPaid && <StreakBadge streak={streak} />}

        {/* Free tier banner */}
        {!isPaid && (
          <div style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8, padding: "0.875rem 1.1rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" as const }}>
            <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.65)", fontSize: "0.78rem", lineHeight: 1.6, margin: 0 }}>
              You're viewing your free daily insight. Book a diagnostic to unlock the full experience.
            </p>
            <a href="/frameworks" style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontWeight: 700, fontSize: "0.68rem", letterSpacing: "0.06em", textTransform: "uppercase" as const, textDecoration: "none", whiteSpace: "nowrap" as const, flexShrink: 0 }}>Upgrade →</a>
          </div>
        )}

        {/* Dynamic access level badge — shown to all logged-in users */}
        {(() => {
          const tierConfig = hasStrategicEdge
            ? { label: "Navigator / Accelerator Member", sub: "", dot: "#D4AF37", border: "rgba(212,175,55,0.35)", bg: "linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(212,175,55,0.04) 100%)" }
            : isPaid
            ? { label: "Diagnostic Client", sub: "3 cards unlocked · upgrade to Navigator for full access", dot: "#1E88E5", border: "rgba(30,136,229,0.3)", bg: "rgba(30,136,229,0.05)" }
            : { label: "Free Member", sub: "1 card unlocked · book your diagnostic to unlock more", dot: "rgba(230,230,230,0.3)", border: "rgba(255,255,255,0.08)", bg: "rgba(255,255,255,0.02)" };
          return (
            <div style={{ background: tierConfig.bg, border: `1px solid ${tierConfig.border}`, borderRadius: 8, padding: "0.65rem 1rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: tierConfig.dot, flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: 0 }}>{tierConfig.label}</p>
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.62rem", margin: "2px 0 0", lineHeight: 1.4 }}>{tierConfig.sub}</p>
              </div>
            </div>
          );
        })()}

        {/* Cards */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.1)", borderRadius: 10, padding: "1.25rem 1.5rem", height: 120 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Card 1 — AI Leadership Insight (Free) */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.3)", borderLeft: "3px solid #D4AF37", borderRadius: 10, padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
                <span style={{ fontSize: "1.1rem" }}>⚡</span>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>AI Leadership Insight</p>
              </div>
              <p style={{ color: "#E6E6E6", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", lineHeight: 1.75 }}>{displayContent.insight}</p>
            </div>

            {/* Card 2 — Framework Micro-Lesson (Paid+) */}
            {isPaid ? (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(194,24,91,0.3)", borderLeft: "3px solid #C2185B", borderRadius: 10, padding: "1.25rem 1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "1.1rem" }}>🧠</span>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Framework Micro-Lesson</p>
                </div>
                <span style={{ display: "inline-block", fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em", color: "#D4AF37", background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 4, padding: "0.18rem 0.5rem", marginBottom: "0.875rem" }}>
                  {displayContent.lesson_badge}
                </span>
                <p style={{ color: "#E6E6E6", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", lineHeight: 1.75 }}>{displayContent.lesson}</p>
              </div>
            ) : (
              <LockedCard title="Framework Micro-Lesson" icon="🧠" color="#C2185B" teaser={displayContent.lesson} />
            )}

            {/* Card 3 — Action Challenge (Paid+) */}
            {isPaid ? (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(30,136,229,0.3)", borderLeft: "3px solid #1E88E5", borderRadius: 10, padding: "1.25rem 1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
                  <span style={{ fontSize: "1.1rem" }}>🎯</span>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#1E88E5", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Today's Action Challenge</p>
                </div>
                <p style={{ color: "#E6E6E6", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", lineHeight: 1.75, marginBottom: "1.25rem" }}>{displayContent.challenge}</p>
                <button
                  onClick={handleComplete}
                  disabled={completed || completing}
                  style={{
                    width: "100%",
                    background: completed ? "#D4AF37" : completing ? "rgba(30,136,229,0.5)" : "#1E88E5",
                    color: completed ? "#0A2342" : "#FFFFFF",
                    border: "none",
                    borderRadius: 6,
                    padding: "0.85rem 1rem",
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    letterSpacing: "0.06em",
                    cursor: completed ? "default" : "pointer",
                    transition: "all 0.4s ease",
                    boxShadow: completed ? "0 0 18px rgba(212,175,55,0.45)" : "none",
                  }}
                >
                  {completed ? "✓  Completed" : completing ? "Saving..." : "MARK COMPLETE"}
                </button>
                {completed && streak.current_streak > 0 && (
                  <div style={{ marginTop: "0.75rem", textAlign: "center" as const }}>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.72rem", fontWeight: 700 }}>
                      🔥 {streak.current_streak}-day streak — you're building real momentum.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <LockedCard title="Today's Action Challenge" icon="🎯" color="#1E88E5" teaser={displayContent.challenge} />
            )}

            {/* Card 4 — DeAnna's Strategic Edge (Navigator + Accelerator) */}
            {hasStrategicEdge ? (
              <div style={{
                background: "linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(10,35,66,0.6) 100%)",
                border: "1px solid rgba(212,175,55,0.5)",
                borderLeft: "3px solid #D4AF37",
                borderRadius: 10,
                padding: "1.25rem 1.5rem",
                position: "relative" as const,
                overflow: "hidden",
              }}>
                <div style={{ position: "absolute" as const, top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "1.1rem" }}>✦</span>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>DeAnna's Strategic Edge</p>
                  </div>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.1em", color: "#0A2342", background: "#D4AF37", borderRadius: 20, padding: "2px 8px", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>Exclusive</span>
                </div>

                <p style={{ color: "#F0E6C8", fontFamily: "'Playfair Display', serif", fontSize: "0.92rem", lineHeight: 1.8, fontStyle: "italic" }}>
                  {displayContent.strategic_edge || FALLBACK_CONTENT.strategic_edge}
                </p>

                <div style={{ marginTop: "1rem", paddingTop: "0.875rem", borderTop: "1px solid rgba(212,175,55,0.15)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: "0.65rem" }}>D</span>
                  </div>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(212,175,55,0.6)", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: 0 }}>DeAnna R. Upshaw · AI Authority</p>
                </div>
              </div>
            ) : isPaid ? (
              <LockedCard
                title="DeAnna's Strategic Edge"
                icon="✦"
                color="#D4AF37"
                teaser={FALLBACK_CONTENT.strategic_edge || ""}
                ctaText="Upgrade to Navigator →"
                ctaHref="/community"
              />
            ) : null}

          </div>
        )}

        {/* Share footer */}
        <div style={{ marginTop: "2rem", background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 8, padding: "1rem 1.25rem", textAlign: "center" as const }}>
          <p style={{ color: "rgba(230,230,230,0.55)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", lineHeight: 1.6, marginBottom: "0.875rem" }}>
            Do you know a leader who could benefit from the DRU CLEAR™ Assessment? Kindly share the link below and initiate a conversation.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.625rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 6, padding: "0.55rem 0.875rem", maxWidth: 420, margin: "0 auto" }}>
            <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.72rem", flex: 1, textAlign: "left" as const, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{ASSESSMENT_URL}</span>
            <button
              onClick={handleCopy}
              style={{ background: copied ? "rgba(212,175,55,0.15)" : "transparent", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 4, color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "0.3rem 0.7rem", cursor: "pointer", whiteSpace: "nowrap" as const, transition: "all 0.2s ease", flexShrink: 0 }}
            >
              {copied ? "✓ Copied!" : "Copy Link"}
            </button>
          </div>
        </div>

      </main>

      <footer style={{ textAlign: "center" as const, padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
