/**
 * DRU CLEAR™ AI Readiness Scorecard PWA
 * Design: Executive Prestige — Dark Luxury
 * Background: #0A2342 | Gold: #D4AF37 | Magenta CTA: #C2185B
 * Fonts: Playfair Display (headings) + Inter (body)
 */

import { useState, useEffect, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Screen =
  | "splash"
  | "welcome"
  | "lead-capture"
  | "clarity"
  | "leadership"
  | "execution"
  | "alignment"
  | "results-pillar"
  | "calculating"
  | "results";

interface LeadData {
  fullName: string;
  email: string;
  company: string;
  role: string;
}

interface Scores {
  [key: number]: number; // question index → score 1-5
}

// ─── Config ──────────────────────────────────────────────────────────────────

// WEBHOOK CONFIGURATION
// To connect your GoHighLevel CRM, update this URL:
const WEBHOOK_CONFIG = {
  url: "", // ← PASTE YOUR GHL WEBHOOK URL HERE
};

// ─── Webhook & Storage ───────────────────────────────────────────────────────

async function sendWebhook(payload: object): Promise<boolean> {
  if (!WEBHOOK_CONFIG.url) return false;
  try {
    await fetch(WEBHOOK_CONFIG.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return true;
  } catch {
    return false;
  }
}

function saveToLocalStorage(key: string, data: object) {
  try {
    const existing = JSON.parse(localStorage.getItem("dru_clear_submissions") || "[]");
    existing.push({ key, data, savedAt: new Date().toISOString() });
    localStorage.setItem("dru_clear_submissions", JSON.stringify(existing));
  } catch {}
}

// ─── Score Utilities ─────────────────────────────────────────────────────────

function getPillarScore(scores: Scores, startQ: number): number {
  return (scores[startQ] || 0) + (scores[startQ + 1] || 0) + (scores[startQ + 2] || 0);
}

function getTier(total: number): { label: string; className: string; color: string } {
  if (total <= 30) return { label: "EMERGING", className: "tier-emerging", color: "#E53935" };
  if (total <= 45) return { label: "DEVELOPING", className: "tier-developing", color: "#D4AF37" };
  if (total <= 60) return { label: "ADVANCING", className: "tier-advancing", color: "#1E88E5" };
  return { label: "LEADING", className: "tier-leading", color: "#43A047" };
}

const GAP_MESSAGES: Record<string, string> = {
  Clarity:
    "Your organization lacks a clear AI vision and strategic direction. Without clarity, AI efforts become scattered and ineffective.",
  Leadership:
    "Your leadership team may not be AI-fluent or actively sponsoring transformation. AI succeeds when leaders champion it.",
  Execution:
    "Your teams may lack the skills, tools, and processes to implement AI effectively. Strategy without execution is just theory.",
  Alignment:
    "Your departments and teams are not aligned around a unified AI strategy. Silos kill AI momentum.",
  Results:
    "You're not yet tracking or demonstrating AI return on investment. What isn't measured can't be managed or defended.",
};

const TIER_MESSAGES: Record<string, string> = {
  EMERGING:
    "Your organization is in the early stages of AI readiness. Without a structured approach, you risk wasting resources on disconnected initiatives. The DRU CLEAR Alignment Diagnostic will pinpoint exactly where to start for maximum impact.",
  DEVELOPING:
    "You've begun the AI conversation, but critical gaps in Clarity and Alignment are slowing your momentum. A full diagnostic will reveal the specific friction points and give you a clear path forward.",
  ADVANCING:
    "Your organization is making meaningful progress. However, one or two CLEAR pillars are underperforming and limiting your full potential. A diagnostic will identify exactly what's holding you back.",
  LEADING:
    "You're operating ahead of most organizations in AI readiness. The question now is sustainability and scale. An AI Leadership Advisory engagement will help you maintain your competitive edge and dominate your industry.",
};

const BOOKING_URL =
  "https://api.aiforbusiness.com/widget/bookings/dru-clear-ai-readiness-consultation";

// ─── Logo Component ───────────────────────────────────────────────────────────

const LOGO_CDN =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/dru-clear-logo-transparent_fdbc9d32.png";

function DruLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src={LOGO_CDN}
      alt="DRU CLEAR™ Logo"
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}

// ─── Score Button Row ─────────────────────────────────────────────────────────

function ScoreRow({
  questionNum,
  question,
  value,
  onChange,
}: {
  questionNum: number;
  question: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-6">
      <p className="text-sm font-medium mb-3" style={{ color: "#E6E6E6", lineHeight: 1.5 }}>
        <span style={{ color: "#D4AF37", marginRight: "0.4em" }}>{questionNum}.</span>
        {question}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: "rgba(230,230,230,0.45)", minWidth: 24 }}>
          SD
        </span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className={`score-btn${value === n ? " selected" : ""}`}
            onClick={() => onChange(n)}
            aria-label={`Score ${n}`}
          >
            {n}
          </button>
        ))}
        <span className="text-xs" style={{ color: "rgba(230,230,230,0.45)", minWidth: 24 }}>
          SA
        </span>
      </div>
    </div>
  );
}

// ─── Screen: Splash ───────────────────────────────────────────────────────────

function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="screen-enter flex flex-col items-center justify-between"
      style={{
        height: "100%",
        background: "#0A2342",
        padding: "3rem 2rem",
      }}
    >
      <div />
      <div className="flex flex-col items-center gap-6">
        <DruLogo className="w-72 max-w-full" />
        <p
          className="text-base font-medium tracking-wide text-center"
          style={{ color: "#E6E6E6", fontFamily: "'Inter', sans-serif" }}
        >
          DRU AI Consulting
        </p>
      </div>
      <p
        className="text-sm text-center tracking-widest uppercase"
        style={{ color: "rgba(230,230,230,0.55)", letterSpacing: "0.12em" }}
      >
        Leading with Intelligence and Impact
      </p>
    </div>
  );
}

// ─── Screen: Welcome ─────────────────────────────────────────────────────────

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div
      className="screen-enter flex flex-col"
      style={{
        height: "100%",
        background: "#0A2342",
        overflowY: "auto",
        padding: "2.5rem 1.5rem 2rem",
        maxWidth: 480,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Header */}
      <div className="flex flex-col items-center mb-6">
        <DruLogo className="w-48 max-w-full mb-6" />
        <h1
          className="text-3xl font-bold text-center mb-1"
          style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37" }}
        >
          DeAnna R. Upshaw
        </h1>
        <p className="text-lg font-medium text-center mb-1" style={{ color: "#FFFFFF" }}>
          AI Authority
        </p>
        <p className="text-sm text-center" style={{ color: "#E6E6E6" }}>
          CEO, DRU AI Consulting
        </p>
      </div>

      <div className="gold-divider mb-6" />

      <p
        className="text-center text-sm mb-6 italic"
        style={{ color: "#E6E6E6", fontFamily: "'Playfair Display', serif" }}
      >
        Your Trusted Advisor &amp; Strategist
      </p>

      <p className="text-sm leading-relaxed mb-8" style={{ color: "#E6E6E6" }}>
        How ready is your organization for the AI era? Take the free{" "}
        <strong style={{ color: "#D4AF37" }}>DRU CLEAR™ AI Readiness Scorecard</strong> and find
        out in 3 minutes.
      </p>

      <button className="btn-gold" onClick={onStart}>
        Start Your Assessment →
      </button>
    </div>
  );
}

// ─── Screen: Lead Capture ─────────────────────────────────────────────────────

function LeadCaptureScreen({
  onContinue,
}: {
  onContinue: (data: LeadData) => void;
}) {
  const [form, setForm] = useState<LeadData>({
    fullName: "",
    email: "",
    company: "",
    role: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.fullName || !form.email || !form.company || !form.role) {
      setError("Please fill in all fields to continue.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);

    const payload = {
      event: "lead_capture",
      fullName: form.fullName,
      email: form.email,
      company: form.company,
      role: form.role,
      timestamp: new Date().toISOString(),
    };

    saveToLocalStorage("lead_capture", payload);
    await sendWebhook(payload);

    setLoading(false);
    onContinue(form);
  };

  return (
    <div
      className="screen-enter flex flex-col"
      style={{
        height: "100%",
        background: "#0A2342",
        overflowY: "auto",
        padding: "2.5rem 1.5rem 2rem",
        maxWidth: 480,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <div className="mb-8">
        <h2
          className="text-2xl font-bold mb-2"
          style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF" }}
        >
          Before we begin —
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "#E6E6E6" }}>
          Enter your details to receive your personalized results and AI readiness insights.
        </p>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>
            Full Name
          </label>
          <input
            className="dru-input"
            placeholder="Your full name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>
            Email Address
          </label>
          <input
            className="dru-input"
            type="email"
            placeholder="your@email.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>
            Company Name
          </label>
          <input
            className="dru-input"
            placeholder="Your organization"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>
            Your Role / Title
          </label>
          <input
            className="dru-input"
            placeholder="e.g. CEO, VP of Operations"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm mb-4" style={{ color: "#E53935" }}>
          {error}
        </p>
      )}

      <button className="btn-gold" onClick={handleSubmit} disabled={loading}>
        {loading ? "Saving..." : "Continue →"}
      </button>
    </div>
  );
}

// ─── Screen: Scorecard Pillar ─────────────────────────────────────────────────

interface PillarScreenProps {
  pillarLetter: string;
  pillarName: string;
  subtitle: string;
  progress: number;
  progressLabel: string;
  questions: string[];
  questionStartIndex: number;
  scores: Scores;
  onScoreChange: (qIndex: number, value: number) => void;
  onNext: () => void;
  nextLabel?: string;
}

function PillarScreen({
  pillarLetter,
  pillarName,
  subtitle,
  progress,
  progressLabel,
  questions,
  questionStartIndex,
  scores,
  onScoreChange,
  onNext,
  nextLabel = "Next →",
}: PillarScreenProps) {
  const allAnswered = questions.every(
    (_, i) => scores[questionStartIndex + i] && scores[questionStartIndex + i] > 0
  );

  return (
    <div
      className="screen-enter flex flex-col"
      style={{
        height: "100%",
        background: "#0A2342",
        overflowY: "auto",
        padding: "2rem 1.5rem 2rem",
        maxWidth: 480,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Progress */}
      <div className="mb-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium" style={{ color: "rgba(212,175,55,0.7)" }}>
            {progressLabel}
          </span>
          <span className="text-xs" style={{ color: "rgba(230,230,230,0.4)" }}>
            {progress}%
          </span>
        </div>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h2
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37" }}
        >
          {pillarLetter} — {pillarName}
        </h2>
        <p className="text-sm" style={{ color: "#E6E6E6" }}>
          {subtitle}
        </p>
      </div>

      <div className="gold-divider mb-6" />

      {/* Questions */}
      <div className="flex-1">
        {questions.map((q, i) => (
          <ScoreRow
            key={i}
            questionNum={questionStartIndex + i + 1}
            question={q}
            value={scores[questionStartIndex + i] || 0}
            onChange={(v) => onScoreChange(questionStartIndex + i, v)}
          />
        ))}
      </div>

      <div className="mt-4">
        {!allAnswered && (
          <p className="text-xs text-center mb-3" style={{ color: "rgba(230,230,230,0.4)" }}>
            Please answer all questions to continue
          </p>
        )}
        <button
          className="btn-gold"
          onClick={onNext}
          disabled={!allAnswered}
          style={{ opacity: allAnswered ? 1 : 0.4 }}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Screen: Calculating ─────────────────────────────────────────────────────

function CalculatingScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="screen-enter flex flex-col items-center justify-center gap-8"
      style={{ height: "100%", background: "#0A2342", padding: "2rem" }}
    >
      <div className="gold-spinner" />
      <div className="text-center">
        <p
          className="text-lg font-medium mb-2"
          style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF" }}
        >
          Analyzing your responses
        </p>
        <p className="text-sm" style={{ color: "rgba(230,230,230,0.6)" }}>
          across all 5 CLEAR™ pillars...
        </p>
      </div>
    </div>
  );
}

// ─── Screen: Results ─────────────────────────────────────────────────────────

function ResultsScreen({
  lead,
  scores,
}: {
  lead: LeadData;
  scores: Scores;
}) {
  const clarityScore = getPillarScore(scores, 0);
  const leadershipScore = getPillarScore(scores, 3);
  const executionScore = getPillarScore(scores, 6);
  const alignmentScore = getPillarScore(scores, 9);
  const resultsScore = getPillarScore(scores, 12);
  const total = clarityScore + leadershipScore + executionScore + alignmentScore + resultsScore;

  const tier = getTier(total);

  const pillars = [
    { name: "Clarity", score: clarityScore },
    { name: "Leadership", score: leadershipScore },
    { name: "Execution", score: executionScore },
    { name: "Alignment", score: alignmentScore },
    { name: "Results", score: resultsScore },
  ];

  const sorted = [...pillars].sort((a, b) => a.score - b.score);
  const topGaps = sorted.slice(0, 2);

  const ctaLabel =
    tier.label === "LEADING"
      ? "Explore AI Leadership Advisory →"
      : "Book Your DRU CLEAR™ Alignment Diagnostic →";

  // Send results webhook on mount
  const sentRef = useRef(false);
  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;

    const payload = {
      event: "scorecard_complete",
      fullName: lead.fullName,
      email: lead.email,
      company: lead.company,
      role: lead.role,
      totalScore: total,
      pillarScores: {
        clarity: clarityScore,
        leadership: leadershipScore,
        execution: executionScore,
        alignment: alignmentScore,
        results: resultsScore,
      },
      tier: tier.label,
      topGaps: topGaps.map((g) => g.name),
      timestamp: new Date().toISOString(),
    };

    saveToLocalStorage("scorecard_complete", payload);
    sendWebhook(payload);
  }, []);

  return (
    <div
      className="screen-enter flex flex-col"
      style={{
        height: "100%",
        background: "#0A2342",
        overflowY: "auto",
        padding: "2rem 1.5rem 2.5rem",
        maxWidth: 480,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Overall Score */}
      <div className="text-center mb-6">
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "rgba(230,230,230,0.5)" }}>
          Your AI Readiness Score
        </p>
        <div
          className="count-up text-6xl font-bold mb-2"
          style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37" }}
        >
          {total}
          <span className="text-3xl" style={{ color: "rgba(212,175,55,0.5)" }}>
            /75
          </span>
        </div>
        <div
          className="text-xl font-bold tracking-widest"
          style={{ color: tier.color, fontFamily: "'Inter', sans-serif" }}
        >
          {tier.label}
        </div>
      </div>

      <div className="gold-divider mb-6" />

      {/* Pillar Breakdown */}
      <div className="mb-6">
        <h3
          className="text-sm font-semibold uppercase tracking-widest mb-4"
          style={{ color: "rgba(212,175,55,0.7)" }}
        >
          Pillar Breakdown
        </h3>
        <div className="flex flex-col gap-3">
          {pillars.map((p) => (
            <div key={p.name}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium" style={{ color: "#E6E6E6" }}>
                  {p.name[0]} — {p.name}
                </span>
                <span className="text-sm font-semibold" style={{ color: "#D4AF37" }}>
                  {p.score}/15
                </span>
              </div>
              <div className="pillar-bar-track">
                <div
                  className="pillar-bar-fill"
                  style={{ width: `${(p.score / 15) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Gap Areas */}
      <div className="mb-6">
        <h3
          className="text-sm font-semibold uppercase tracking-widest mb-4"
          style={{ color: "rgba(212,175,55,0.7)" }}
        >
          Top Gap Areas
        </h3>
        <div className="flex flex-col gap-3">
          {topGaps.map((g) => (
            <div key={g.name} className="dru-card">
              <div className="flex items-start gap-2">
                <span style={{ color: "#D4AF37", fontSize: "1rem", marginTop: 1 }}>⚠</span>
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: "#FFFFFF" }}>
                    {g.name} Gap
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "#E6E6E6" }}>
                    {GAP_MESSAGES[g.name]}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tier Message */}
      <div className="dru-card mb-6">
        <p className="text-xs leading-relaxed" style={{ color: "#E6E6E6" }}>
          {TIER_MESSAGES[tier.label]}
        </p>
      </div>

      {/* CTA */}
      <button
        className="btn-magenta mb-6"
        onClick={() => window.open(BOOKING_URL, "_blank")}
      >
        {ctaLabel}
      </button>

      {/* Footer */}
      <div className="gold-divider mb-4" />
      <div className="flex flex-col items-center gap-2">
        <DruLogo className="w-32" />
        <p className="text-xs text-center" style={{ color: "rgba(230,230,230,0.5)" }}>
          DRU AI Consulting
        </p>
        <p className="text-xs text-center" style={{ color: "rgba(230,230,230,0.4)" }}>
          DeAnna R. Upshaw — AI Authority
        </p>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function DruClearApp() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [lead, setLead] = useState<LeadData>({ fullName: "", email: "", company: "", role: "" });
  const [scores, setScores] = useState<Scores>({});

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const updateScore = (qIndex: number, value: number) => {
    setScores((prev) => ({ ...prev, [qIndex]: value }));
  };

  const goTo = (s: Screen) => setScreen(s);

  return (
    <div
      style={{
        height: "100dvh",
        width: "100%",
        background: "#0A2342",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {screen === "splash" && <SplashScreen onDone={() => goTo("welcome")} />}

      {screen === "welcome" && <WelcomeScreen onStart={() => goTo("lead-capture")} />}

      {screen === "lead-capture" && (
        <LeadCaptureScreen
          onContinue={(data) => {
            setLead(data);
            goTo("clarity");
          }}
        />
      )}

      {screen === "clarity" && (
        <PillarScreen
          pillarLetter="C"
          pillarName="CLARITY"
          subtitle="AI Vision & Strategic Direction"
          progress={20}
          progressLabel="1 of 5"
          questions={[
            "Our organization has a clearly defined AI vision that connects to our overall business strategy.",
            "Leaders and teams across the organization understand why we are pursuing AI and what success looks like.",
            "We have identified specific strategic priorities where AI will have the greatest business impact.",
          ]}
          questionStartIndex={0}
          scores={scores}
          onScoreChange={updateScore}
          onNext={() => goTo("leadership")}
        />
      )}

      {screen === "leadership" && (
        <PillarScreen
          pillarLetter="L"
          pillarName="LEADERSHIP"
          subtitle="Executive AI Fluency & Sponsorship"
          progress={40}
          progressLabel="2 of 5"
          questions={[
            "Our organizational leaders can clearly articulate how AI connects to our business strategy and competitive position.",
            "There is a designated executive sponsor who is accountable for driving AI transformation.",
            "Our leadership team actively participates in AI learning, development, and decision-making.",
          ]}
          questionStartIndex={3}
          scores={scores}
          onScoreChange={updateScore}
          onNext={() => goTo("execution")}
        />
      )}

      {screen === "execution" && (
        <PillarScreen
          pillarLetter="E"
          pillarName="EXECUTION"
          subtitle="Operational AI Implementation Capacity"
          progress={60}
          progressLabel="3 of 5"
          questions={[
            "We have identified specific business processes where AI can deliver measurable impact.",
            "Our teams have the skills, tools, and resources needed to implement AI solutions today.",
            "We have completed at least one AI pilot or proof of concept in the past 12 months.",
          ]}
          questionStartIndex={6}
          scores={scores}
          onScoreChange={updateScore}
          onNext={() => goTo("alignment")}
        />
      )}

      {screen === "alignment" && (
        <PillarScreen
          pillarLetter="A"
          pillarName="ALIGNMENT"
          subtitle="Cross-Functional Strategic Coherence"
          progress={80}
          progressLabel="4 of 5"
          questions={[
            "Our AI initiatives are aligned with our overall business goals and strategic plan.",
            "There is clear and consistent communication between departments about AI priorities and progress.",
            "Our AI efforts are coordinated across teams and business units rather than operating in silos.",
          ]}
          questionStartIndex={9}
          scores={scores}
          onScoreChange={updateScore}
          onNext={() => goTo("results-pillar")}
        />
      )}

      {screen === "results-pillar" && (
        <PillarScreen
          pillarLetter="R"
          pillarName="RESULTS"
          subtitle="Measurement, Tracking & ROI"
          progress={100}
          progressLabel="5 of 5"
          questions={[
            "We have defined clear Key Performance Indicators to measure the success of our AI initiatives.",
            "We can demonstrate measurable return on investment from at least one AI-related initiative.",
            "We have a system in place to regularly track and report AI progress to leadership.",
          ]}
          questionStartIndex={12}
          scores={scores}
          onScoreChange={updateScore}
          onNext={() => goTo("calculating")}
          nextLabel="See My Results →"
        />
      )}

      {screen === "calculating" && <CalculatingScreen onDone={() => goTo("results")} />}

      {screen === "results" && <ResultsScreen lead={lead} scores={scores} />}
    </div>
  );
}
