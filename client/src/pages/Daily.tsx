import { useState, useEffect } from "react";
import AdminLayout from "../components/AdminLayout";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { useBrandCopy } from "../lib/brandCopy";

function getTodayCST(): string {
  const now = new Date();
  const cstOffset = -6 * 60;
  const cst = new Date(now.getTime() + cstOffset * 60 * 1000);
  return cst.toISOString().split("T")[0];
}

function formatDisplayDate(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

interface DailyContent {
  insight: string; lesson: string; lesson_badge: string;
  challenge: string; strategic_edge?: string;
}

interface StreakData {
  current_streak: number; longest_streak: number; total_completions: number;
}

const FALLBACK_CONTENT: DailyContent = {
  insight: "The leaders who thrive in the AI era are not those who understand the technology best — they are those who ask the most strategic questions. AI fluency is not about knowing how models work. It is about knowing which problems are worth solving and which decisions require human judgment.",
  lesson: "Clarity in AI strategy means your entire organization — from the boardroom to the front line — can answer one question: 'Why are we pursuing AI, and what does success look like?' Without this shared clarity, AI investments scatter. With it, they compound.",
  lesson_badge: "DRU CLEAR™ · Pillar: Clarity",
  challenge: "Block 20 minutes today and ask your team this one question: 'If we could automate or accelerate one repetitive process with AI this quarter, what would have the biggest impact?' Write down the top three answers. That list is the beginning of your AI priority map.",
  strategic_edge: "Most leaders are asking the wrong question about AI. They ask 'What can AI do?' when the only question that matters is 'What does my organization need to become?' Your AI strategy is not a technology decision — it is a leadership identity decision. Make it from that place.",
};

const ASSESSMENT_URL  = "https://assessment.druaiconsulting.com";
const NAV_UPGRADE_URL = "https://link.druaiconsulting.com/payment-link/69ead3017dd3512d920794b0";
const ACC_UPGRADE_URL = "https://link.druaiconsulting.com/payment-link/69ead3d37dd3512d920794b1";

function LockedCard({ title, icon, color, membersText, ctaText, ctaHref }: {
  title: string; icon: string; color: string;
  membersText: string; ctaText: string; ctaHref: string;
}) {
  return (
    <div style={{ border: "1px solid rgba(10,35,66,0.1)", background: "#FFFFFF", borderRadius: 10, padding: "1.25rem 1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem", paddingBottom: "0.875rem", borderBottom: "1px solid rgba(10,35,66,0.08)" }}>
        <span style={{ fontSize: "1.1rem", opacity: 0.35 }}>{icon}</span>
        <p style={{ fontFamily: "'Montserrat', sans-serif", color, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, opacity: 0.35 }}>{title}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="#D4AF37" strokeWidth="1.75"/>
            <path d="M7 11V7a5 5 0 0110 0v4" stroke="#D4AF37" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
        </div>
        <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(10,35,66,0.5)", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, textAlign: "center" as const, lineHeight: 1.6 }}>
          {membersText}
        </p>
        <a href={ctaHref} style={{ display: "inline-block", background: "#C2185B", color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "0.5rem 1.25rem", borderRadius: 6, textDecoration: "none" }}>
          {ctaText}
        </a>
      </div>
    </div>
  );
}

function StreakBadge({ streak }: { streak: StreakData }) {
  if (streak.current_streak === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8, padding: "0.65rem 1rem", marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <span style={{ fontSize: "1.2rem" }}>🔥</span>
        <div>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontWeight: 700, fontSize: "0.85rem", margin: 0 }}>{streak.current_streak}-Day Streak</p>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.45)", fontSize: "0.65rem", margin: 0 }}>Keep building your leadership muscle</p>
        </div>
      </div>
      <div style={{ marginLeft: "auto", textAlign: "right" as const }}>
        <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(10,35,66,0.45)", fontSize: "0.65rem", margin: 0 }}>Best: {streak.longest_streak} days</p>
        <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(10,35,66,0.35)", fontSize: "0.6rem", margin: 0 }}>{streak.total_completions} total completions</p>
      </div>
    </div>
  );
}

export default function Daily() {
  const positioning = useBrandCopy("positioning");
  const { user, isPaid, isNavigator, isAccelerator, hasStrategicEdge, pathwayStage } = useAuth();
  const isNavigatorPlus = hasStrategicEdge;

  const [content, setContent]     = useState<DailyContent | null>(null);
  const [streak, setStreak]       = useState<StreakData>({ current_streak: 0, longest_streak: 0, total_completions: 0 });
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [copied, setCopied]       = useState(false);
  const today = getTodayCST();

  const handleCopy = () => {
    navigator.clipboard.writeText(ASSESSMENT_URL).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  };

  useEffect(() => {
    async function fetchContent() {
      try {
        const { data } = await supabase.from("daily_content").select("insight, lesson, lesson_badge, challenge, strategic_edge").eq("content_date", today).eq("stage", pathwayStage).maybeSingle();
        setContent(data || FALLBACK_CONTENT);
      } catch { setContent(FALLBACK_CONTENT); }
      finally { setLoading(false); }
    }
    fetchContent();
  }, [today, pathwayStage]);

  useEffect(() => {
    if (!user?.id) return;
    async function fetchStatus() {
      try {
        const { data: readData } = await supabase.from("user_daily_reads").select("completed_at").eq("user_id", user!.id).eq("read_date", today).maybeSingle();
        if (readData?.completed_at) setCompleted(true);
        const { data: streakData } = await supabase.from("user_streaks").select("current_streak, longest_streak, total_completions").eq("user_id", user!.id).maybeSingle();
        if (streakData) setStreak(streakData);
      } catch {}
    }
    fetchStatus();
  }, [user?.id, today]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("user_daily_reads").upsert(
      { user_id: user.id, read_date: today, read_at: new Date().toISOString() },
      { onConflict: "user_id,read_date", ignoreDuplicates: true }
    ).then(() => {});
  }, [user?.id, today]);

  const handleComplete = async () => {
    if (completed || completing || !user?.id) return;
    setCompleting(true);
    const now = new Date().toISOString();
    try {
      await supabase.from("user_daily_reads").upsert(
        { user_id: user.id, read_date: today, completed_at: now, read_at: now },
        { onConflict: "user_id,read_date" }
      );
      setCompleted(true);
      supabase.functions.invoke("handle-daily-action", {
        body: { action: "complete_challenge", user_id: user.id, read_date: today },
      }).then(({ data }) => {
        if (data?.current_streak !== undefined) {
          setStreak({ current_streak: data.current_streak, longest_streak: data.longest_streak, total_completions: data.total_completions });
        }
      }).catch(() => {});
    } catch { setCompleted(true); }
    finally { setCompleting(false); }
  };

  const displayContent = content || FALLBACK_CONTENT;

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 680, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "0.3rem" }}>Daily Connection</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "1.85rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.4rem" }}>Today's Leadership Fuel</h1>
          <p style={{ color: "rgba(10,35,66,0.4)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem" }}>{formatDisplayDate()}</p>
        </div>

        <div style={{ height: 1, background: "linear-gradient(90deg, rgba(212,175,55,0.4) 0%, rgba(212,175,55,0.05) 100%)", marginBottom: "2rem" }} />

        {isPaid && <StreakBadge streak={streak} />}

        {/* Tier badge */}
        {(() => {
          const tierConfig = isAccelerator
            ? { label: "Accelerator Member", sub: "", dot: "#D4AF37", border: "rgba(212,175,55,0.3)", bg: "rgba(212,175,55,0.06)" }
            : isNavigator
            ? { label: "Navigator Member",   sub: "", dot: "#D4AF37", border: "rgba(212,175,55,0.3)", bg: "rgba(212,175,55,0.06)" }
            : isPaid
            ? { label: "Diagnostic Client", sub: "3 cards unlocked · upgrade to Navigator for full access", dot: "#1E88E5", border: "rgba(30,136,229,0.25)", bg: "rgba(30,136,229,0.04)" }
            : { label: "Free Tier", sub: "", dot: "rgba(10,35,66,0.3)", border: "rgba(10,35,66,0.1)", bg: "rgba(10,35,66,0.02)" };
          return (
            <div style={{ background: tierConfig.bg, border: `1px solid ${tierConfig.border}`, borderRadius: 8, padding: "0.65rem 1rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: tierConfig.dot, flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: 0 }}>{tierConfig.label}</p>
                {tierConfig.sub && <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.45)", fontSize: "0.62rem", margin: "2px 0 0", lineHeight: 1.4 }}>{tierConfig.sub}</p>}
              </div>
            </div>
          );
        })()}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {[1,2,3,4].map(i => <div key={i} style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.08)", borderRadius: 10, padding: "1.25rem 1.5rem", height: 120 }} />)}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Card 1 — Positioning Insight */}
            <div style={{ background: "#FFFFFF", border: "1px solid rgba(212,175,55,0.25)", borderLeft: "3px solid #D4AF37", borderRadius: 10, padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
                <span style={{ fontSize: "1.1rem" }}>⚡</span>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>{positioning} Insight</p>
              </div>
              <p style={{ color: "rgba(10,35,66,0.8)", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", lineHeight: 1.75 }}>{displayContent.insight}</p>
            </div>

            {/* Card 2 — Framework Micro-Lessons (Navigator+) */}
            {isNavigatorPlus ? (
              <div style={{ background: "#FFFFFF", border: "1px solid rgba(194,24,91,0.25)", borderLeft: "3px solid #C2185B", borderRadius: 10, padding: "1.25rem 1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "1.1rem" }}>🧠</span>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Framework Micro-Lessons</p>
                </div>
                <span style={{ display: "inline-block", fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em", color: "#D4AF37", background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 4, padding: "0.18rem 0.5rem", marginBottom: "0.875rem" }}>
                  {displayContent.lesson_badge}
                </span>
                <p style={{ color: "rgba(10,35,66,0.8)", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", lineHeight: 1.75 }}>{displayContent.lesson}</p>
              </div>
            ) : (
              <LockedCard title="Framework Micro-Lessons" icon="🧠" color="#C2185B" membersText="Navigator & Accelerator Monthly Subscriptions Members" ctaText="Upgrade to Navigator →" ctaHref={NAV_UPGRADE_URL} />
            )}

            {/* Card 3 — Today's Action Challenge (Accelerator) */}
            {isAccelerator ? (
              <div style={{ background: "#FFFFFF", border: "1px solid rgba(30,136,229,0.25)", borderLeft: "3px solid #1E88E5", borderRadius: 10, padding: "1.25rem 1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
                  <span style={{ fontSize: "1.1rem" }}>🎯</span>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#1E88E5", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Today's Action Challenge</p>
                </div>
                <p style={{ color: "rgba(10,35,66,0.8)", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", lineHeight: 1.75, marginBottom: "1.25rem" }}>{displayContent.challenge}</p>
                <button onClick={handleComplete} disabled={completed || completing}
                  style={{ width: "100%", background: completed ? "#D4AF37" : completing ? "rgba(30,136,229,0.5)" : "#1E88E5", color: completed ? "#0A2342" : "#FFFFFF", border: "none", borderRadius: 6, padding: "0.85rem 1rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.06em", cursor: completed ? "default" : "pointer", transition: "all 0.4s ease", boxShadow: completed ? "0 0 18px rgba(212,175,55,0.3)" : "none" }}>
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
              <LockedCard title="Today's Action Challenge" icon="🎯" color="#1E88E5" membersText="Accelerator Monthly Subscriptions Members" ctaText="Upgrade to Accelerator →" ctaHref={ACC_UPGRADE_URL} />
            )}

            {/* Card 4 — DeAnna's Strategic Edge (Accelerator) — stays dark as premium branded card */}
            {isAccelerator ? (
              <div style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.12) 0%, #0A2342 100%)", border: "1px solid rgba(212,175,55,0.5)", borderLeft: "3px solid #D4AF37", borderRadius: 10, padding: "1.25rem 1.5rem", position: "relative" as const, overflow: "hidden" }}>
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
                    <span style={{ fontSize: "0.65rem", color: "#D4AF37" }}>D</span>
                  </div>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(212,175,55,0.6)", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: 0 }}>DeAnna R. Upshaw · AI Authority</p>
                </div>
              </div>
            ) : (
              <LockedCard title="DeAnna's Strategic Edge" icon="✦" color="#D4AF37" membersText="Accelerator Monthly Subscriptions Members" ctaText="Upgrade to Accelerator →" ctaHref={ACC_UPGRADE_URL} />
            )}
          </div>
        )}

        {/* Share footer */}
        <div style={{ marginTop: "2rem", background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 8, padding: "1rem 1.25rem", textAlign: "center" as const }}>
          <p style={{ color: "rgba(10,35,66,0.55)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", lineHeight: 1.6, marginBottom: "0.875rem" }}>
            Do you know a leader who could benefit from the DRU CLEAR™ Assessment? Kindly share the link below and initiate a conversation.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.625rem", background: "rgba(10,35,66,0.03)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 6, padding: "0.55rem 0.875rem", maxWidth: 420, margin: "0 auto" }}>
            <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.45)", fontSize: "0.72rem", flex: 1, textAlign: "left" as const, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{ASSESSMENT_URL}</span>
            <button onClick={handleCopy}
              style={{ background: copied ? "rgba(212,175,55,0.12)" : "transparent", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 4, color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "0.3rem 0.7rem", cursor: "pointer", whiteSpace: "nowrap" as const, transition: "all 0.2s ease", flexShrink: 0 }}>
              {copied ? "✓ Copied!" : "Copy Link"}
            </button>
          </div>
        </div>

        <footer style={{ textAlign: "center" as const, padding: "1rem 0 0.5rem", color: "rgba(10,35,66,0.3)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
          © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
        </footer>
      </main>
    </AdminLayout>
  );
}
