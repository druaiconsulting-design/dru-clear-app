import { useEffect } from "react";
import { LOGO_CDN, HEADSHOT_CDN } from "../config";
import { LIKERT_LABELS } from "../constants";
import type { Scores } from "../types";

// ── DruLogo ───────────────────────────────────────────────────────────────────

export function DruLogo({ height = 64, className = "" }: { height?: number; className?: string }) {
  return (
    <img
      src={LOGO_CDN}
      alt="DRU CLEAR™ Logo"
      className={className}
      style={{ height, width: "auto", maxWidth: "100%", objectFit: "contain", flexShrink: 0, display: "block" }}
    />
  );
}

// ── ScoreRow ──────────────────────────────────────────────────────────────────

export function ScoreRow({ questionNum, question, value, onChange }: {
  questionNum: number; question: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="mb-5">
      <p className="text-sm font-medium mb-3" style={{ color: "#E6E6E6", lineHeight: 1.5 }}>
        <span style={{ color: "#D4AF37", marginRight: "0.4em" }}>{questionNum}.</span>{question}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={`score-btn${value === n ? " selected" : ""}`} onClick={() => onChange(n)} aria-label={LIKERT_LABELS[n - 1].replace("\n", " ")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 4px", height: "auto" }}>
            <span style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1 }}>{n}</span>
            <span style={{ fontSize: "0.6rem", lineHeight: 1.2, textAlign: "center", whiteSpace: "pre-line", opacity: 0.85, fontFamily: "'Inter', sans-serif" }}>{LIKERT_LABELS[n - 1]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── SplashScreen ──────────────────────────────────────────────────────────────

export function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="screen-enter flex flex-col items-center justify-between" style={{ height: "100%", background: "#0A2342", padding: "3rem 2rem" }}>
      <div />
      <div className="flex flex-col items-center gap-6">
        <DruLogo height={140} />
        <p className="text-base font-medium tracking-wide text-center" style={{ color: "#E6E6E6", fontFamily: "'Inter', sans-serif" }}>DRU AI Consulting</p>
      </div>
      <p className="text-sm text-center tracking-widest uppercase" style={{ color: "rgba(230,230,230,0.55)", letterSpacing: "0.12em" }}>Leading with Intelligence and Impact</p>
    </div>
  );
}

// ── WelcomeScreen ─────────────────────────────────────────────────────────────

export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="screen-enter flex flex-col" style={{ minHeight: "100dvh", background: "#0A2342", padding: "2.5rem 1.5rem 2rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <div className="flex flex-col items-center mb-6">
        <DruLogo height={120} className="mb-4" />
        <div style={{ width: 120, height: 120, borderRadius: "50%", border: "2.5px solid #D4AF37", boxShadow: "0 0 0 4px rgba(212,175,55,0.15), 0 4px 20px rgba(0,0,0,0.4)", overflow: "hidden", marginBottom: "1.25rem", flexShrink: 0 }}>
          <img src={HEADSHOT_CDN} alt="DeAnna R. Upshaw" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} />
        </div>
        <h1 className="text-3xl font-bold text-center mb-1" style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37" }}>DeAnna R. Upshaw</h1>
        <p className="text-lg font-medium text-center mb-1" style={{ color: "#FFFFFF" }}>AI Authority</p>
        <p className="text-sm text-center" style={{ color: "#E6E6E6" }}>CEO DRU AI Consulting</p>
      </div>
      <div className="gold-divider mb-6" />
      <p className="text-center text-sm mb-6 italic" style={{ color: "#E6E6E6", fontFamily: "'Playfair Display', serif" }}>Your Trusted Strategist &amp; Partner</p>
      <p className="text-sm leading-relaxed mb-8" style={{ color: "#E6E6E6" }}>
        How ready is your organization for the AI era? Take the free{" "}
        <strong style={{ color: "#D4AF37" }}>DRU CLEAR™ AI Readiness Assessment</strong> and find out in 3 minutes.
      </p>
      <button className="btn-gold" onClick={onStart}>Start Your Assessment →</button>
    </div>
  );
}

// ── CalculatingScreen ─────────────────────────────────────────────────────────

export function CalculatingScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="screen-enter flex flex-col items-center justify-center gap-8" style={{ height: "100%", background: "#0A2342", padding: "2rem" }}>
      <div className="gold-spinner" />
      <div className="text-center">
        <p className="text-lg font-medium mb-2" style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF" }}>Analyzing your responses</p>
        <p className="text-sm" style={{ color: "rgba(230,230,230,0.6)" }}>across all 5 CLEAR™ pillars...</p>
      </div>
    </div>
  );
}

// ── ExpiredScreen ─────────────────────────────────────────────────────────────

export function ExpiredScreen({ onRetake }: { onRetake: () => void }) {
  return (
    <div className="screen-enter flex flex-col items-center justify-center" style={{ minHeight: "100dvh", background: "#0A2342", padding: "2.5rem 1.5rem", textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", border: "2px solid rgba(212,175,55,0.4)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem", background: "rgba(212,175,55,0.06)" }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="11" stroke="#D4AF37" strokeWidth="2" strokeOpacity="0.6"/><path d="M16 9v8l4 4" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.8"/></svg>
      </div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.75rem", fontWeight: 700, color: "#D4AF37", marginBottom: "1rem", lineHeight: 1.2 }}>Your Results Have Expired</h2>
      <p style={{ color: "#E6E6E6", fontSize: "0.85rem", lineHeight: 1.7, maxWidth: 320, marginBottom: "0.75rem" }}>Your AI Readiness score is only valid for 48 hours to ensure accuracy and relevance.</p>
      <p style={{ color: "rgba(230,230,230,0.6)", fontSize: "0.78rem", lineHeight: 1.6, maxWidth: 300, marginBottom: "2rem", fontStyle: "italic" }}>To get your most accurate and current results, take the assessment again — it only takes 3 minutes.</p>
      <button className="btn-gold" onClick={onRetake} style={{ maxWidth: 320 }}>Retake My Assessment →</button>
      <div style={{ marginTop: "2rem" }}><DruLogo height={120} /></div>
    </div>
  );
}

// ── NudgeBanner ───────────────────────────────────────────────────────────────

export function NudgeBanner({ onDismiss, onBookNow }: { onDismiss: () => void; onBookNow: () => void }) {
  return (
    <div style={{ background: "linear-gradient(135deg, #0A1628 0%, #0D1F3C 100%)", borderBottom: "1px solid rgba(212,175,55,0.4)", padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", zIndex: 9998 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.04em", marginBottom: 2 }}>Your results expire soon</div>
        <div style={{ color: "rgba(255,255,255,0.65)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem" }}>Your AI Readiness score expires in less than 12 hours.</div>
      </div>
      <button onClick={onBookNow} style={{ background: "#C2185B", color: "#FFFFFF", border: "none", borderRadius: 4, padding: "0.4rem 0.8rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.68rem", letterSpacing: "0.04em", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>Reserve Now</button>
      <button onClick={onDismiss} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "1.1rem", flexShrink: 0, padding: "0.25rem" }}>×</button>
    </div>
  );
}

// ── ResultsTransitionBlock ────────────────────────────────────────────────────

export function ResultsTransitionBlock({ onContinue }: { onContinue: () => void }) {
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
      <button className="btn-magenta" onClick={onContinue} style={{ marginBottom: "0.75rem" }}>Continue to Diagnostic Options →</button>
    </div>
  );
}
