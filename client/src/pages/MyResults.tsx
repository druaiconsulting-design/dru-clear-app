import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

// ── Constants (mirrored from assessment) ─────────────────────────────────────

const GAP_MESSAGES: Record<string, string> = {
  Clarity: "Your organization lacks a clear AI vision and strategic direction. Without clarity, AI efforts become scattered and ineffective.",
  Leadership: "Your leadership team may not be AI-fluent or actively sponsoring transformation. AI succeeds when leaders champion it.",
  Execution: "Your teams may lack the skills, tools, and processes to implement AI effectively. Strategy without execution is just theory.",
  Alignment: "Your departments and teams are not aligned around a unified AI strategy. Silos kill AI momentum.",
  Results: "You're not yet tracking or demonstrating AI return on investment. What isn't measured can't be managed or defended.",
};

const STRENGTH_MESSAGES: Record<string, string> = {
  Clarity: "Your AI vision is clearly defined and connected to your business strategy — a critical foundation that most organizations struggle to establish.",
  Leadership: "Your executive team is AI-fluent and actively sponsoring transformation — the single most important driver of successful AI adoption.",
  Execution: "Your teams have the skills, tools, and processes to implement AI effectively — turning strategy into measurable results.",
  Alignment: "Your departments operate as a unified AI front with clear communication and coordinated priorities — rare and powerful.",
  Results: "You measure, track, and demonstrate AI ROI consistently — giving you the credibility and data to scale confidently.",
};

const TIER_MESSAGES: Record<string, string> = {
  EMERGING: "Your organization is in the early stages of AI readiness. Without a structured approach, you risk wasting resources on disconnected initiatives. The DRU CLEAR™ Alignment Diagnostic will pinpoint exactly where to start for maximum impact.",
  DEVELOPING: "You've begun the AI conversation, but critical gaps in Clarity and Alignment are slowing your momentum. A full diagnostic will reveal the specific friction points and give you a clear path forward.",
  ADVANCING: "Your organization is making meaningful progress. However, one or two CLEAR pillars are underperforming and limiting your full potential. A diagnostic will identify exactly what's holding you back.",
  LEADING: "You're operating ahead of most organizations in AI readiness. The question now is sustainability and scale. An AI Leadership Advisory engagement will help you maintain your competitive edge and dominate your industry.",
};

const TIER_ONE_LINERS: Record<string, { text: string; color: string }> = {
  EMERGING: { text: "Most organizations don't even know where to start — now you do. Let's build your AI foundation together.", color: "#E57373" },
  DEVELOPING: { text: "You've made progress, but the gaps are costing you. Let's close them before your competitors do.", color: "#FFD54F" },
  ADVANCING: { text: "You're ahead of most organizations — here's how to turn that advantage into market dominance.", color: "#66BB6A" },
  LEADING: { text: "You're ahead of most organizations — here's how to turn that advantage into market dominance.", color: "#66BB6A" },
};

const BADGE_URLS: Record<string, string> = {
  EMERGING: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512997684/kOtwAuULsXPXkaGB.png",
  DEVELOPING: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512997684/fWXAJkZaBbdHEhOn.png",
  ADVANCING: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512997684/amcdeQtIckHTNLhd.png",
  LEADING: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512997684/BcciWNCYnCPbYcGB.png",
};

const BENCHMARK_PERCENTILES: Record<string, number> = {
  EMERGING: 25,
  DEVELOPING: 52,
  ADVANCING: 74,
  LEADING: 93,
};

const LOGO_CDN = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512997684/NJTJspnSktvZQJaw.png";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssessmentResult {
  total_score: number;
  tier: string;
  clarity_score: number;
  leadership_score: number;
  execution_score: number;
  alignment_score: number;
  results_score: number;
  created_at: string;
  user_timezone: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTierColor(tier: string): string {
  switch (tier) {
    case "LEADING":   return "#43A047";
    case "ADVANCING": return "#1E88E5";
    case "DEVELOPING":return "#D4AF37";
    case "EMERGING":  return "#E53935";
    default:          return "#D4AF37";
  }
}

function formatCompletedDate(createdAt: string, userTimezone: string): string {
  try {
    const date = new Date(createdAt);
    const tz = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const datePart = date.toLocaleDateString("en-US", {
      timeZone: tz, year: "numeric", month: "long", day: "numeric",
    });
    const timePart = date.toLocaleTimeString("en-US", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: true,
    });
    const tzAbbr = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value || "";
    return `${datePart} at ${timePart} ${tzAbbr}`;
  } catch {
    return createdAt;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MyResults() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [displayScore, setDisplayScore] = useState(0);
  const [badgeVisible, setBadgeVisible] = useState(false);
  const [oneLineVisible, setOneLineVisible] = useState(false);
  const [pillarsAnimated, setPillarsAnimated] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [resultsCopied, setResultsCopied] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(true);

  const pillarSectionRef = useRef<HTMLDivElement>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchResults() {
      if (!user?.email) return;
      const { data, error } = await supabase
        .from("submissions")
        .select("total_score, tier, clarity_score, leadership_score, execution_score, alignment_score, results_score, created_at, user_timezone")
        .eq("email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data || error) setNotFound(true);
      else setResult(data);
      setLoading(false);
    }
    fetchResults();
  }, [user?.email]);

  // ── Score animation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!result) return;
    const duration = 1200;
    const start = performance.now();
    const target = result.total_score;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    let rafId: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayScore(Math.round(easeOutCubic(progress) * target));
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          setBadgeVisible(true);
          setTimeout(() => setOneLineVisible(true), 200);
        }, 300);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [result]);

  // ── Pillar scroll animation ────────────────────────────────────────────────
  useEffect(() => {
    const el = pillarSectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setPillarsAnimated(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [result]);

  // ── Scroll hint ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => { if (window.scrollY > 60) setShowScrollHint(false); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
        <NavBar active="/my-results" />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.4)", fontSize: "0.85rem" }}>
            Loading your results...
          </p>
        </div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
        <NavBar active="/my-results" />
        <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>
          <button
            onClick={() => navigate("/portal")}
            style={{ background: "none", border: "none", color: "rgba(212,175,55,0.6)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.7rem", letterSpacing: "0.08em", cursor: "pointer", padding: 0, marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            ← Back to Portal
          </button>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 10, padding: "2.5rem 1.5rem", textAlign: "center" }}>
            <p style={{ fontSize: "2rem", marginBottom: "1rem" }}>📋</p>
            <h3 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.75rem" }}>
              No Assessment Found
            </h3>
            <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.85rem", lineHeight: 1.7, marginBottom: "1.5rem" }}>
              We couldn't find a completed assessment linked to your account. Take the assessment to see your results here.
            </p>
            <a
              href="https://assessment.druaiconsulting.com"
              style={{ display: "inline-block", background: "#C2185B", color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", padding: "0.85rem 1.5rem", borderRadius: 6 }}
            >
              Take the Assessment →
            </a>
          </div>
        </main>
      </div>
    );
  }

  if (!result) return null;

  // ── Derived values ─────────────────────────────────────────────────────────
  const tierColor  = getTierColor(result.tier);
  const percentile = BENCHMARK_PERCENTILES[result.tier] || 0;
  const badgeUrl   = BADGE_URLS[result.tier];
  const oneLiner   = TIER_ONE_LINERS[result.tier];

  const pillars = [
    { name: "Clarity",    score: result.clarity_score },
    { name: "Leadership", score: result.leadership_score },
    { name: "Execution",  score: result.execution_score },
    { name: "Alignment",  score: result.alignment_score },
    { name: "Results",    score: result.results_score },
  ];

  const sorted          = [...pillars].sort((a, b) => a.score - b.score);
  const topGaps         = sorted.filter((p) => p.score < 12).slice(0, 2);
  const strongestPillar = [...pillars].sort((a, b) => b.score - a.score)[0];
  const completedDate   = formatCompletedDate(result.created_at, result.user_timezone);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleBadgeDownload = async () => {
    if (!badgeUrl) return;
    try {
      const res  = await fetch(badgeUrl);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `DRU-CLEAR-Badge-${result.tier}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(badgeUrl, "_blank");
    }
  };

  const handleShareScore = async () => {
    const shareText = `I just scored ${result.total_score}/100 on the DRU CLEAR™ AI Readiness Assessment! See how ready your organization is: https://assessment.druaiconsulting.com`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "DRU CLEAR™ AI Readiness Score", text: shareText, url: "https://assessment.druaiconsulting.com" }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(shareText); } catch {}
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
    }
  };

  const handleCopyResultsLink = () => {
    const url = `https://assessment.druaiconsulting.com?score=${result.total_score}&result=${result.tier}`;
    navigator.clipboard.writeText(url)
      .then(() => { setResultsCopied(true); setTimeout(() => setResultsCopied(false), 2500); })
      .catch(() => {});
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
      <NavBar active="/my-results" />

      <main
        style={{ flex: 1, padding: "clamp(1rem, 4vw, 1.5rem) clamp(0.875rem, 4vw, 1.25rem) 2rem", maxWidth: 480, margin: "0 auto", width: "100%", boxSizing: "border-box" }}
      >

        {/* Back */}
        <button
          onClick={() => navigate("/portal")}
          style={{ background: "none", border: "none", color: "rgba(212,175,55,0.6)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.7rem", letterSpacing: "0.08em", cursor: "pointer", padding: 0, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          ← Back to Portal
        </button>

        {/* Logo row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <img src={LOGO_CDN} alt="DRU CLEAR™ Logo" style={{ height: 80, width: "auto", objectFit: "contain" }} />
        </div>

        {/* Score + tier + one-liner */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1rem", gap: "0.75rem" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(230,230,230,0.5)", marginBottom: "0.25rem" }}>
              Your Score
            </p>
            <div style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", lineHeight: 1, fontSize: "clamp(2.5rem, 12vw, 3rem)", fontWeight: 700 }}>
              {displayScore}
              <span style={{ color: "rgba(212,175,55,0.5)", fontSize: "clamp(1.25rem, 6vw, 1.5rem)" }}>/100</span>
            </div>
          </div>

          <div style={{ fontWeight: 700, letterSpacing: "0.12em", padding: "0.4rem 1rem", borderRadius: 4, color: tierColor, border: `1.5px solid ${tierColor}`, fontFamily: "'Inter', sans-serif", background: `${tierColor}18`, fontSize: "clamp(0.8rem, 4vw, 1rem)", opacity: badgeVisible ? 1 : 0, transform: badgeVisible ? "scale(1)" : "scale(0.8)", transition: "opacity 0.4s ease, transform 0.4s ease" }}>
            {result.tier}
          </div>

          {oneLiner && (
            <p style={{ color: oneLiner.color, fontStyle: "italic", fontSize: "clamp(0.78rem, 3.2vw, 0.88rem)", lineHeight: 1.55, textAlign: "center", maxWidth: 320, margin: 0, opacity: oneLineVisible ? 1 : 0, transition: "opacity 0.5s ease", fontFamily: "'Lato', sans-serif" }}>
              {oneLiner.text}
            </p>
          )}
        </div>

        {/* Share button */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
          <button
            onClick={handleShareScore}
            style={{ display: "flex", alignItems: "center", gap: "0.45rem", padding: "0.65rem 1.4rem", background: `${tierColor}18`, color: tierColor, border: `1.5px solid ${tierColor}60`, borderRadius: 6, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "clamp(0.8rem, 3.5vw, 0.9rem)", letterSpacing: "0.04em", cursor: "pointer" }}
          >
            {shareLinkCopied ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Link Copied!</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>Share Your Score</>
            )}
          </button>
        </div>

        {/* Percentile */}
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", textAlign: "center", marginBottom: "1rem", color: "rgba(212,175,55,0.75)", fontStyle: "italic", lineHeight: 1.6, padding: "0 0.5rem" }}>
          You scored higher than <strong style={{ color: "#D4AF37" }}>{percentile}%</strong> of organizations assessed on AI readiness.
        </p>

        {/* Scroll hint */}
        {showScrollHint && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "0.75rem", pointerEvents: "none" }}>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "rgba(212,175,55,0.55)", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
              scroll to see your full results
            </p>
            <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
              <path d="M2 2L10 10L18 2" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {/* Badge */}
        {badgeUrl && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1.5rem", gap: "0.4rem" }}>
            <button
              onClick={handleBadgeDownload}
              title="Tap to save & share"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%", maxWidth: 320 }}
            >
              <img
                src={badgeUrl}
                alt={`${result.tier} tier badge`}
                style={{ width: "100%", maxWidth: 320, height: "auto", display: "block", borderRadius: 8, border: `1px solid ${tierColor}40`, boxShadow: `0 4px 24px ${tierColor}20` }}
              />
            </button>
            <p style={{ color: "rgba(212,175,55,0.55)", fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>
              Tap to save &amp; share
            </p>
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(212,175,55,0.2)", marginBottom: "1rem" }} />

        {/* Pillar breakdown */}
        <div style={{ marginBottom: "1rem" }} ref={pillarSectionRef}>
          <h3 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(212,175,55,0.7)", marginBottom: "0.75rem" }}>
            Pillar Breakdown
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {pillars.map((p, i) => (
              <div key={p.name}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", gap: "0.25rem" }}>
                  <span style={{ fontFamily: "'Inter', sans-serif", color: "#E6E6E6", fontSize: "clamp(0.68rem, 2.8vw, 0.75rem)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                    {p.name[0]} — {p.name}
                  </span>
                  <span style={{ fontFamily: "'Inter', sans-serif", color: "#D4AF37", fontSize: "clamp(0.68rem, 2.8vw, 0.75rem)", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                    {p.score}/15
                  </span>
                </div>
                <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{ height: "100%", width: pillarsAnimated ? `${(p.score / 15) * 100}%` : "0%", background: "#D4AF37", borderRadius: 3, transition: pillarsAnimated ? `width 0.8s cubic-bezier(0.215, 0.61, 0.355, 1) ${i * 100}ms` : "none" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(212,175,55,0.2)", marginBottom: "1rem" }} />

        {/* Strongest pillar */}
        {strongestPillar && (
          <div style={{ marginBottom: "1rem" }}>
            <h3 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(212,175,55,0.7)", marginBottom: "0.5rem" }}>
              Your Strongest Pillar
            </h3>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 8, padding: "0.6rem 0.75rem", wordBreak: "break-word", overflowWrap: "break-word" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ color: "#43A047", fontSize: "0.85rem", marginTop: 1, flexShrink: 0 }}>★</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontSize: "clamp(0.68rem, 2.8vw, 0.75rem)", fontWeight: 600, marginBottom: "0.25rem" }}>
                    {strongestPillar.name} — {strongestPillar.score}/15
                  </p>
                  <p style={{ fontFamily: "'Inter', sans-serif", color: "#E6E6E6", fontSize: "clamp(0.65rem, 2.6vw, 0.7rem)", lineHeight: 1.6, margin: 0 }}>
                    {STRENGTH_MESSAGES[strongestPillar.name]}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top gap areas */}
        {topGaps.length > 0 && (
          <div style={{ marginBottom: "1rem" }}>
            <h3 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(212,175,55,0.7)", marginBottom: "0.5rem" }}>
              Top Gap Areas
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {topGaps.map((g) => (
                <div key={g.name} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 8, padding: "0.6rem 0.75rem", wordBreak: "break-word", overflowWrap: "break-word" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                    <span style={{ color: "#D4AF37", fontSize: "0.85rem", marginTop: 1, flexShrink: 0 }}>⚠</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontSize: "clamp(0.68rem, 2.8vw, 0.75rem)", fontWeight: 600, marginBottom: "0.25rem" }}>
                        {g.name} Gap
                      </p>
                      <p style={{ fontFamily: "'Inter', sans-serif", color: "#E6E6E6", fontSize: "clamp(0.65rem, 2.6vw, 0.7rem)", lineHeight: 1.6, margin: 0 }}>
                        {GAP_MESSAGES[g.name]}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tier message */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 8, padding: "0.75rem 0.875rem", marginBottom: "1rem" }}>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "#E6E6E6", fontSize: "clamp(0.65rem, 2.8vw, 0.7rem)", lineHeight: 1.7, margin: 0 }}>
            {TIER_MESSAGES[result.tier]}
          </p>
        </div>

        {/* Copy results link */}
        <button
          onClick={handleCopyResultsLink}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", width: "100%", padding: "0.65rem 1rem", marginBottom: "1rem", background: resultsCopied ? "rgba(212,175,55,0.12)" : "transparent", color: resultsCopied ? "#D4AF37" : "rgba(212,175,55,0.7)", border: `1px solid ${resultsCopied ? "#D4AF37" : "rgba(212,175,55,0.3)"}`, borderRadius: 4, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.06em", cursor: "pointer", transition: "all 0.2s" }}
        >
          {resultsCopied ? (
            <><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7L5.5 10.5L12 3.5" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>LINK COPIED!</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 1H13V5M13 1L7 7M6 3H2C1.44772 3 1 3.44772 1 4V12C1 12.5523 1.44772 13 2 13H10C10.5523 13 11 12.5523 11 12V8" stroke="rgba(212,175,55,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>COPY MY RESULTS LINK</>
          )}
        </button>

        {/* Disclaimer */}
        <p style={{ fontFamily: "'Inter', sans-serif", textAlign: "center", color: "#E6E6E6", fontSize: "0.65rem", lineHeight: 1.6, opacity: 0.6, maxWidth: 400, margin: "0 auto 1.5rem" }}>
          This assessment is for informational purposes only and does not constitute professional consulting advice. Results are based on your self-reported responses. For a personalized strategy, book a consultation with DRU AI Consulting.
        </p>

        {/* Logo + branding */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <img src={LOGO_CDN} alt="DRU CLEAR™ Logo" style={{ height: 80, width: "auto", objectFit: "contain" }} />
          <div>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: "rgba(230,230,230,0.5)", margin: 0 }}>DRU AI Consulting</p>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.65rem", color: "rgba(230,230,230,0.35)", margin: 0 }}>DeAnna R. Upshaw — AI Authority</p>
          </div>
        </div>

        {/* Completed date in user's timezone */}
        <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.2)", fontSize: "0.65rem", textAlign: "center", margin: 0 }}>
          Assessment completed {completedDate}
        </p>

      </main>

      <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
