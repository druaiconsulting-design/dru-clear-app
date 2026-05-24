/**
 * DRU CLEAR™ AI Readiness Assessment
 * screens/Results.tsx — ResultsTransitionBlock + ResultsScreen
 */

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../../lib/supabase";
import {
  LeadData, Scores, DruLogo,
  GAP_MESSAGES, TIER_MESSAGES, STRENGTH_MESSAGES, TIER_ONE_LINERS,
  BADGE_URLS, BENCHMARK_PERCENTILES, WEBHOOK_COMPLETE_URL,
} from "../types";
import {
  getPillarScore, getTier, sendWebhook, sendWebhookJson,
  normalizePhone, saveToLocalStorage, UTM_PARAMS,
} from "../Utils";

// ─── Results Transition Block ─────────────────────────────────────────────────

function ResultsTransitionBlock({ onContinue }: { onContinue: () => void }) {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.18)", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}>
        <p style={{ color: "#D4AF37", fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.5rem", fontFamily: "'Montserrat', sans-serif" }}>What This Means For You</p>
        <p style={{ color: "#E6E6E6", fontSize: "0.78rem", lineHeight: 1.7 }}>Your results highlight key areas across leadership, alignment, execution, and AI readiness. This gives you visibility into where gaps may exist — but not why they exist or how to fix them.</p>
        <p style={{ color: "rgba(230,230,230,0.6)", fontSize: "0.75rem", lineHeight: 1.6, marginTop: "0.5rem", fontStyle: "italic" }}>Most leaders stay at this stage — aware of the challenges, but without a clear path forward.</p>
      </div>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.18)", borderRadius: 8, padding: "1rem", marginBottom: "1.25rem" }}>
        <p style={{ color: "#D4AF37", fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.5rem", fontFamily: "'Montserrat', sans-serif" }}>Your Next Step</p>
        <p style={{ color: "#E6E6E6", fontSize: "0.78rem", lineHeight: 1.7 }}>To move forward, the next step is to go deeper — identify root causes, prioritize what matters most, and gain clarity on what actions to take.</p>
      </div>
      <p style={{ color: "rgba(212,175,55,0.6)", fontSize: "0.68rem", textAlign: "center", fontStyle: "italic", marginBottom: "1rem", lineHeight: 1.5 }}>Your results are available for a limited time to ensure accuracy and relevance.</p>
      <button className="btn-magenta" onClick={onContinue} style={{ marginBottom: "0.75rem" }}>
        Continue to Diagnostic Options →
      </button>
    </div>
  );
}

// ─── Results Screen ───────────────────────────────────────────────────────────

export function ResultsScreen({
  lead, scores, onBookCall,
}: {
  lead: LeadData;
  scores: Scores;
  onBookCall: () => void;
}) {
  const clarityScore    = getPillarScore(scores, 0);
  const leadershipScore = getPillarScore(scores, 3);
  const executionScore  = getPillarScore(scores, 6);
  const alignmentScore  = getPillarScore(scores, 9);
  const resultsScore    = getPillarScore(scores, 12);
  const total           = clarityScore + leadershipScore + executionScore + alignmentScore + resultsScore;
  const scaledScore     = Math.round((total / 75) * 100);
  const tier            = getTier(total);

  const pillars = [
    { name: "Clarity",    score: clarityScore    },
    { name: "Leadership", score: leadershipScore  },
    { name: "Execution",  score: executionScore   },
    { name: "Alignment",  score: alignmentScore   },
    { name: "Results",    score: resultsScore      },
  ];
  const sorted          = [...pillars].sort((a, b) => a.score - b.score);
  const topGaps         = sorted.filter((p) => p.score < 12).slice(0, 2);
  const strongestPillar = [...pillars].sort((a, b) => b.score - a.score)[0];
  const badgeUrl        = BADGE_URLS[tier.label];
  const percentile      = BENCHMARK_PERCENTILES[tier.label];

  const handleBadgeDownload = async () => {
    if (!badgeUrl) return;
    try {
      const res  = await fetch(badgeUrl);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `DRU-CLEAR-Badge-${tier.label}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { window.open(badgeUrl, "_blank"); }
  };

  const [displayScore,   setDisplayScore]   = useState(0);
  const [badgeVisible,   setBadgeVisible]   = useState(false);
  const [oneLineVisible, setOneLineVisible] = useState(false);

  useEffect(() => {
    const duration    = 1200;
    const start       = performance.now();
    const target      = scaledScore;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    let rafId: number;
    const tick = (now: number) => {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayScore(Math.round(easeOutCubic(progress) * target));
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setTimeout(() => { setBadgeVisible(true); setTimeout(() => setOneLineVisible(true), 200); }, 300);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const assessmentShareUrl = "https://assessment.druaiconsulting.com";

  const handleShareScore = async () => {
    const shareText = `I just scored ${scaledScore}/100 on the AI Readiness Assessment! Take yours here: ${assessmentShareUrl}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "DRU CLEAR™ AI Readiness Score", text: shareText, url: assessmentShareUrl }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(shareText); } catch {
        const el = document.createElement("textarea"); el.value = shareText;
        document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el);
      }
      setShareLinkCopied(true); setTimeout(() => setShareLinkCopied(false), 2000);
    }
  };

  const [pillarsAnimated,  setPillarsAnimated]  = useState(false);
  const pillarSectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = pillarSectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setPillarsAnimated(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [showScrollHint, setShowScrollHint] = useState(true);
  const [resultsCopied,  setResultsCopied]  = useState(false);

  const handleCopyResultsLink = () => {
    const refParam = lead.email ? `?ref=${encodeURIComponent(lead.email)}` : "";
    const url      = `https://assessment.druaiconsulting.com${refParam}&score=${scaledScore}&result=${tier.label}`;
    navigator.clipboard.writeText(url)
      .then(() => { setResultsCopied(true); setTimeout(() => setResultsCopied(false), 2500); })
      .catch(() => {
        const el = document.createElement("textarea"); el.value = url;
        document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el);
        setResultsCopied(true); setTimeout(() => setResultsCopied(false), 2500);
      });
    sendWebhook({ event_type: "share_click", channel: "clipboard", first_name: lead.firstName, last_name: lead.lastName, email: lead.email, score: scaledScore, result: tier.label, ai_country_name: lead.country_name || "", ai_country_iso: lead.country_iso || "", ...UTM_PARAMS, timestamp: new Date().toISOString() });
  };

  useEffect(() => {
    const onScroll = () => { if (window.scrollY > 60) setShowScrollHint(false); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Confetti
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const COLORS = ["#D4AF37","#F5E27D","#B8860B","#FFD700","#E8C84A","#FFFFFF"];
    type Particle = { x: number; y: number; vx: number; vy: number; color: string; size: number; rotation: number; rotSpeed: number; alpha: number; shape: "rect" | "circle" };
    const particles: Particle[] = Array.from({ length: 90 }, () => ({
      x: Math.random() * canvas.width, y: -10 - Math.random() * 60,
      vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 5 + Math.random() * 7, rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.15, alpha: 1,
      shape: Math.random() > 0.4 ? "rect" : "circle",
    }));
    let frame = 0; let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.07; p.rotation += p.rotSpeed;
        if (frame > 40) p.alpha = Math.max(0, p.alpha - 0.012);
        ctx.save(); ctx.globalAlpha = p.alpha; ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.fillStyle = p.color;
        if (p.shape === "rect") { ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); }
        else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2.5, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      });
      frame++; if (frame < 130) { animId = requestAnimationFrame(draw); } else { ctx.clearRect(0, 0, canvas.width, canvas.height); }
    };
    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Fire completion webhook once
  const sentRef = useRef(false);
  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    const LIKERT_MAP: Record<number, string> = { 1: "Strongly Disagree", 2: "Disagree", 3: "Neutral", 4: "Agree", 5: "Strongly Agree" };
    const answerLabel = (qIndex: number): string => LIKERT_MAP[scores[qIndex]] || "Not answered";
    const scorePct    = (total / 75) * 100;
    const scoreCategory = scorePct <= 33 ? "Low" : scorePct <= 66 ? "Medium" : "High";
    const formatTimestamp = (date: Date, tz: string, label: string): string => {
      const datePart = date.toLocaleDateString("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
      const timePart = date.toLocaleTimeString("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
      const [mo, dy, yr] = datePart.split("/");
      return `${yr}-${mo}-${dy} ${timePart} ${label}`;
    };
    const now       = new Date();
    const userTz    = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const offsetMin = -now.getTimezoneOffset();
    const offsetHr  = Math.floor(Math.abs(offsetMin) / 60);
    const offsetMn  = Math.abs(offsetMin) % 60;
    const offsetLabel = `UTC${offsetMin >= 0 ? "+" : "-"}${String(offsetHr).padStart(2, "0")}${offsetMn ? ":" + String(offsetMn).padStart(2, "0") : ""}`;
    const mergedPayload = {
      event_type: "assessment_completed", tags: "Assessment-Completed",
      first_name: lead.firstName, last_name: lead.lastName, email: lead.email,
      phone: normalizePhone(lead.phone || ""), company: lead.company, role: lead.role,
      ai_country_name: lead.country_name || "", ai_country_iso: lead.country_iso || "",
      total_score: scaledScore, score_category: scoreCategory, tier: tier.label,
      assessment_status: "completed",
      completed_at_cst:  formatTimestamp(now, "America/Chicago", "CST"),
      completed_at_user: formatTimestamp(now, userTz, offsetLabel),
      user_timezone: userTz, ...UTM_PARAMS,
      question_1: answerLabel(0),  question_2: answerLabel(1),  question_3: answerLabel(2),
      question_4: answerLabel(3),  question_5: answerLabel(4),  question_6: answerLabel(5),
      question_7: answerLabel(6),  question_8: answerLabel(7),  question_9: answerLabel(8),
      question_10: answerLabel(9), question_11: answerLabel(10), question_12: answerLabel(11),
      question_13: answerLabel(12), question_14: answerLabel(13), question_15: answerLabel(14),
      timestamp: now.toISOString(),
    };
    saveToLocalStorage("assessment_completed", mergedPayload);
    sendWebhookJson(mergedPayload, WEBHOOK_COMPLETE_URL);
    (async () => {
      try {
        const randomPassword = crypto.randomUUID() + crypto.randomUUID();
        await supabase.auth.signUp({ email: lead.email, password: randomPassword, options: { data: { first_name: lead.firstName, full_name: `${lead.firstName} ${lead.lastName}`.trim(), tier: "free" } } });
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="screen-enter flex flex-col"
      style={{ minHeight: "100dvh", background: "#0A2342", overflowX: "hidden", padding: "clamp(1rem, 4vw, 1.5rem) clamp(0.875rem, 4vw, 1.25rem) 2rem", maxWidth: 480, margin: "0 auto", width: "100%", boxSizing: "border-box" }}
    >
      <canvas ref={confettiCanvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 9999 }} />

      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <DruLogo height={80} />
        <span className="text-xs" style={{ color: "rgba(230,230,230,0.35)", fontFamily: "'Inter', sans-serif" }}>Page 7 of 9</span>
      </div>

      {/* Score Hero */}
      <div className="flex flex-col items-center mb-4" style={{ gap: "0.75rem" }}>
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "rgba(230,230,230,0.5)" }}>Your Score</p>
          <div className="font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", lineHeight: 1, fontSize: "clamp(2.5rem, 12vw, 3rem)" }}>
            {displayScore}<span style={{ color: "rgba(212,175,55,0.5)", fontSize: "clamp(1.25rem, 6vw, 1.5rem)" }}>/100</span>
          </div>
        </div>
        <div className="font-bold tracking-widest px-4 py-2 rounded" style={{ color: tier.color, border: `1.5px solid ${tier.color}`, fontFamily: "'Inter', sans-serif", background: `${tier.color}18`, fontSize: "clamp(0.8rem, 4vw, 1rem)", letterSpacing: "0.12em", opacity: badgeVisible ? 1 : 0, transform: badgeVisible ? "scale(1)" : "scale(0.8)", transition: "opacity 0.4s ease, transform 0.4s ease" }}>
          {tier.label}
        </div>
        {(() => {
          const oneLiner = TIER_ONE_LINERS[tier.label];
          if (!oneLiner) return null;
          return (
            <p style={{ color: oneLiner.color, fontStyle: "italic", fontSize: "clamp(0.78rem, 3.2vw, 0.88rem)", lineHeight: 1.55, textAlign: "center", maxWidth: 320, margin: "0.1rem 0 0", opacity: oneLineVisible ? 1 : 0, transition: "opacity 0.5s ease", fontFamily: "'Lato', sans-serif" }}>
              {oneLiner.text}
            </p>
          );
        })()}
      </div>

      {/* Share Score */}
      <div className="flex justify-center mb-4">
        <button
          onClick={handleShareScore}
          style={{ display: "flex", alignItems: "center", gap: "0.45rem", padding: "0.65rem 1.4rem", background: `${tier.color}18`, color: tier.color, border: `1.5px solid ${tier.color}60`, borderRadius: 6, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "clamp(0.8rem, 3.5vw, 0.9rem)", letterSpacing: "0.04em", cursor: "pointer", transition: "background 0.2s, border-color 0.2s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${tier.color}30`; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${tier.color}18`; }}
        >
          {shareLinkCopied ? (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Link Copied!</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>Share Your Score</>
          )}
        </button>
      </div>

      {/* Percentile */}
      <p className="text-xs text-center mb-4" style={{ color: "rgba(212,175,55,0.75)", fontStyle: "italic", lineHeight: 1.6, padding: "0 0.5rem" }}>
        You scored higher than <strong style={{ color: "#D4AF37" }}>{percentile}%</strong> of organizations assessed on AI readiness.
      </p>

      {/* Scroll hint */}
      {showScrollHint && (
        <div className="flex flex-col items-center mb-3" style={{ opacity: 1, transition: "opacity 0.4s ease", pointerEvents: "none" }}>
          <p className="text-xs mb-1" style={{ color: "rgba(212,175,55,0.55)", fontFamily: "'Inter', sans-serif", letterSpacing: "0.06em" }}>scroll to see your full results</p>
          <svg className="scroll-chevron" width="20" height="12" viewBox="0 0 20 12" fill="none"><path d="M2 2L10 10L18 2" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      )}

      {/* Badge */}
      {badgeUrl && (
        <div className="flex flex-col items-center mb-4" style={{ gap: "0.4rem", position: "relative", zIndex: 1 }}>
          <button onClick={handleBadgeDownload} title="Tap to save & share" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "block", width: "100%", maxWidth: 320 }}>
            <img src={badgeUrl} alt={`${tier.label} tier badge`} loading="eager" width="320" height="168" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} style={{ width: "100%", maxWidth: 320, height: "auto", display: "block", borderRadius: 8, border: `1px solid ${tier.color}40`, boxShadow: `0 4px 24px ${tier.color}20` }} />
          </button>
          <p style={{ color: "rgba(212,175,55,0.55)", fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>Tap to save &amp; share</p>
        </div>
      )}

      <div className="gold-divider mb-3" />

      {/* Pillar Breakdown */}
      <div className="mb-4" ref={pillarSectionRef}>
        <h3 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(212,175,55,0.7)" }}>Pillar Breakdown</h3>
        <div className="flex flex-col" style={{ gap: "0.6rem" }}>
          {pillars.map((p, i) => (
            <div key={p.name}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", gap: "0.25rem" }}>
                <span style={{ color: "#E6E6E6", fontSize: "clamp(0.68rem, 2.8vw, 0.75rem)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{p.name[0]} — {p.name}</span>
                <span style={{ color: "#D4AF37", fontSize: "clamp(0.68rem, 2.8vw, 0.75rem)", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>{p.score}/15</span>
              </div>
              <div className="pillar-bar-track" style={{ height: 5 }}>
                <div className="pillar-bar-fill" style={{ width: pillarsAnimated ? `${(p.score / 15) * 100}%` : "0%", transition: pillarsAnimated ? `width 0.8s cubic-bezier(0.215, 0.61, 0.355, 1) ${i * 100}ms` : "none" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="gold-divider mb-3" />

      {/* Strongest Pillar */}
      {strongestPillar && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(212,175,55,0.7)" }}>Your Strongest Pillar</h3>
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 8, padding: "0.6rem 0.75rem", wordBreak: "break-word", overflowWrap: "break-word" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
              <span style={{ color: "#43A047", fontSize: "0.85rem", marginTop: 1, flexShrink: 0 }}>★</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ color: "#FFFFFF", fontSize: "clamp(0.68rem, 2.8vw, 0.75rem)", fontWeight: 600, marginBottom: "0.25rem" }}>{strongestPillar.name} — {strongestPillar.score}/15</p>
                <p style={{ color: "#E6E6E6", fontSize: "clamp(0.65rem, 2.6vw, 0.7rem)", lineHeight: 1.6, margin: 0 }}>{STRENGTH_MESSAGES[strongestPillar.name]}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Gaps */}
      {topGaps.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(212,175,55,0.7)" }}>Top Gap Areas</h3>
          <div className="flex flex-col gap-2">
            {topGaps.map((g) => (
              <div key={g.name} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 8, padding: "0.6rem 0.75rem", wordBreak: "break-word", overflowWrap: "break-word" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <span style={{ color: "#D4AF37", fontSize: "0.85rem", marginTop: 1, flexShrink: 0 }}>⚠</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ color: "#FFFFFF", fontSize: "clamp(0.68rem, 2.8vw, 0.75rem)", fontWeight: 600, marginBottom: "0.25rem" }}>{g.name} Gap</p>
                    <p style={{ color: "#E6E6E6", fontSize: "clamp(0.65rem, 2.6vw, 0.7rem)", lineHeight: 1.6, margin: 0 }}>{GAP_MESSAGES[g.name]}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tier Message */}
      <div className="dru-card mb-4" style={{ padding: "0.75rem 0.875rem" }}>
        <p style={{ color: "#E6E6E6", fontSize: "clamp(0.65rem, 2.8vw, 0.7rem)", lineHeight: 1.7 }}>{TIER_MESSAGES[tier.label]}</p>
      </div>

      <ResultsTransitionBlock onContinue={onBookCall} />

      {/* Copy Results Link */}
      <button
        onClick={handleCopyResultsLink}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", width: "100%", padding: "0.65rem 1rem", marginBottom: "1rem", background: resultsCopied ? "rgba(212,175,55,0.12)" : "transparent", color: resultsCopied ? "#D4AF37" : "rgba(212,175,55,0.7)", border: `1px solid ${resultsCopied ? "#D4AF37" : "rgba(212,175,55,0.3)"}`, borderRadius: 4, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.06em", cursor: "pointer", transition: "all 0.2s" }}
      >
        {resultsCopied ? (
          <><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7L5.5 10.5L12 3.5" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>LINK COPIED!</>
        ) : (
          <><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 1H13V5M13 1L7 7M6 3H2C1.44772 3 1 3.44772 1 4V12C1 12.5523 1.44772 13 2 13H10C10.5523 13 11 12.5523 11 12V8" stroke="rgba(212,175,55,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>COPY MY RESULTS LINK</>
        )}
      </button>

      <p className="text-center mb-4" style={{ color: "#E6E6E6", fontSize: "0.65rem", lineHeight: 1.6, opacity: 0.6, maxWidth: 400, margin: "0 auto 1rem" }}>
        This assessment is for informational purposes only and does not constitute professional consulting advice. Results are based on your self-reported responses. For a personalized strategy, book a consultation with DRU AI Consulting.
      </p>

      <div className="flex items-center justify-center gap-3">
        <DruLogo height={120} />
        <div>
          <p className="text-xs" style={{ color: "rgba(230,230,230,0.5)" }}>DRU AI Consulting</p>
          <p className="text-xs" style={{ color: "rgba(230,230,230,0.35)", fontSize: "0.65rem" }}>DeAnna R. Upshaw — AI Authority</p>
        </div>
      </div>
    </div>
  );
}
