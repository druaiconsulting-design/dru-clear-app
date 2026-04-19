import { useState } from "react";
import NavBar from "../components/NavBar";

// ─── TEST MODE ────────────────────────────────────────────────────────────────
// Set to true to bypass payment iframe and test the full flow.
// Set to false before going live.
const BYPASS_PAYMENT = false;
// ─────────────────────────────────────────────────────────────────────────────

const PAYMENT_STRATEGIC_URL   = "https://link.druaiconsulting.com/payment-link/69dc8f8d557558e89e51f222";
const PAYMENT_EXECUTIVE_URL   = "https://link.druaiconsulting.com/payment-link/69dc91c480425dc02fbc7645";
const PAYMENT_DRU_CLEAR_URL   = "https://link.druaiconsulting.com/payment-link/69e41757557558e89e520dec";
const PAYMENT_5D_URL          = "https://link.druaiconsulting.com/payment-link/69e418197dd3512d920772fc";
const PAYMENT_5C_URL          = "https://link.druaiconsulting.com/payment-link/69e4194e557558e89e520def";
const PAYMENT_AI_SALES_URL    = "https://link.druaiconsulting.com/payment-link/69e419bb7dd3512d920772fe";
const CALENDAR_URL            = "https://link.druaiconsulting.com/widget/bookings/dru-clear-ai-readiness-consultation";

// Maps payment URLs → thank you page routes (used in bypass mode)
const THANK_YOU_ROUTES: Record<string, string> = {
  [PAYMENT_EXECUTIVE_URL]:  "/thank-you-ed",
  [PAYMENT_STRATEGIC_URL]:  "/thank-you-sd",
  [PAYMENT_DRU_CLEAR_URL]:  "/thank-you-dru-clear",
  [PAYMENT_5D_URL]:         "/thank-you-5d",
  [PAYMENT_5C_URL]:         "/thank-you-5c",
  [PAYMENT_AI_SALES_URL]:   "/thank-you-ai-sales",
};

const TERMS = [
  { title: "Services", body: "All diagnostic, framework, and ecosystem engagements are delivered virtually via Zoom unless otherwise agreed in writing. Session scheduling begins upon receipt of full or initial payment." },
  { title: "Payment", body: "Full payment is required before services commence, except for the Full Ecosystem engagement which requires 50% at signing and 50% at completion. All prices are in USD." },
  { title: "Non-Refundable Policy", body: "All payments are non-refundable. By completing your purchase you acknowledge that you have reviewed the service description, understand the scope of your selected engagement, and are committing to your transformation pathway. No refunds will be issued for any reason including unused sessions, scheduling conflicts, or change of mind." },
  { title: "Rescheduling", body: "Sessions may be rescheduled with a minimum of 48 hours notice. Sessions cancelled with less than 48 hours notice are forfeited." },
  { title: "Intellectual Property", body: "All frameworks, materials, and methodologies — including DRU CLEAR™, 5C Cultural DNA™, 5D Leadership™, and AI Sales Mastery™ — are the proprietary intellectual property of DRU AI Consulting. Materials shared during engagements are for client use only and may not be reproduced or redistributed." },
  { title: "Agreement", body: "Completing payment constitutes your agreement to these terms." },
];

const FRAMEWORKS = [
  {
    id: "dru-clear",
    badge: "The Connector",
    badgeColor: "#D4AF37",
    name: "DRU CLEAR™",
    tagline: "Align for AI Execution",
    theme: null,
    image: "/DRU%20CLEAR%20.png",
    price: "$7,500",
    paymentUrl: PAYMENT_DRU_CLEAR_URL,
    intro: "Every organization has a starting point. DRU CLEAR™ is the framework that finds it — and builds the bridge from where you are to where AI can take you.\n\nAs the flagship framework of the DRU AI Leadership Ecosystem™, DRU CLEAR™ is the transformation pathway that connects all four frameworks into a unified, executable strategy. It is not just an assessment — it is a complete AI readiness diagnosis, strategy design, and execution alignment system built for organizations ready to lead in the AI era.",
    dimensions: [
      { label: "Clarity", desc: "Define your AI vision with precision. Where are you going, why does it matter, and what does success look like across your entire organization?" },
      { label: "Leadership", desc: "Ensure your leaders have the AI fluency, executive sponsorship, and strategic conviction to drive transformation from the top down and the inside out." },
      { label: "Execution", desc: "Close the gap between strategy and action. Identify the processes, capabilities, and resources needed to implement AI where it delivers the greatest impact." },
      { label: "Alignment", desc: "Unify your organization around a single AI strategy. Break down silos, synchronize departments, and ensure every team is moving in the same direction." },
      { label: "Results", desc: "Define, measure, and demonstrate ROI. What gets measured gets managed — and what gets managed gets transformed." },
    ],
    closing: "DRU CLEAR™ is where your AI transformation begins, and where all four frameworks come together.",
    whoFor: "Organizations ready for complete AI leadership transformation — executives, leadership teams, and organizations that refuse to leave their AI future to chance.",
  },
  {
    id: "5c-cultural-dna",
    badge: "Culture",
    badgeColor: "#C2185B",
    name: "5C Cultural DNA™",
    tagline: "Communication · Connection · Collaboration · Coaching · Culture Transformation",
    theme: "Learn IT. Live IT. Lead IT. Leadership Thinking with AI.",
    image: "/5C%20.png",
    price: "$6,000",
    paymentUrl: PAYMENT_5C_URL,
    intro: "Most organizations don't have an AI problem — they have a culture problem. Before any technology can transform a business, the people, communication patterns, and leadership behaviors have to be ready to receive it.\n\nThe 5C Cultural DNA™ framework helps organizations discover and address cultural dysfunction, silos, and communication breakdowns that silently block progress. It gives leaders a structured path to use AI as a strategic thinking partner — not a decision-maker — moving through all five dimensions for greater organizational results.",
    dimensions: [
      { label: "Communication", desc: "The foundation. How leaders and teams exchange information, share vision, and create clarity around AI strategy across every level of the organization." },
      { label: "Connection", desc: "The relational layer. Building trust and meaningful relationships between people, departments, and leadership — the human bonds that make collaboration possible." },
      { label: "Collaboration", desc: "The action layer. Breaking down silos and creating cross-functional alignment so AI initiatives don't get trapped in one department but flow through the whole organization." },
      { label: "Coaching", desc: "The development layer. Leaders coaching teams through uncertainty, change, and new AI capabilities — building confidence and competency from the inside out." },
      { label: "Culture Transformation", desc: "The outcome. When the first four C's are working, culture shifts naturally — from resistance and fear around AI to ownership, confidence, and strategic adoption." },
    ],
    closing: null,
    whoFor: "Organizations navigating culture shifts, leadership teams experiencing silos or communication breakdowns, and executives ready to build a culture where AI and human intelligence work together.",
  },
  {
    id: "5d-leadership",
    badge: "Leadership",
    badgeColor: "#1E88E5",
    name: "5D Leadership™",
    tagline: "Transformational Leadership Across Five Critical Dimensions",
    theme: null,
    image: "/5D%20Leadership%20visual%20model%20design.png",
    price: "$6,500",
    paymentUrl: PAYMENT_5D_URL,
    intro: "Most leadership development programs focus on skills. 5D Leadership™ focuses on the whole leader — building from the inside out across five critical dimensions that determine whether leadership actually transforms an organization or just manages it.\n\nThis AI-infused leadership methodology ensures that personal mastery, team effectiveness, organizational strength, and strategic impact all develop together — not in isolation.",
    dimensions: [
      { label: "I. Self", desc: "Personal mastery. How a leader thinks, decides, and shows up — the foundation everything else is built on." },
      { label: "II. People", desc: "Relational intelligence. How a leader connects with, develops, and brings out the best in the individuals around them." },
      { label: "III. Team", desc: "Collective effectiveness. How a leader builds cohesion, trust, and high performance across a team that moves as one." },
      { label: "IV. Organization", desc: "Systemic strength. How a leader aligns culture, strategy, and operations to create an organization built for sustainable growth." },
      { label: "V. Visionary", desc: "Strategic impact. How a leader sees beyond today, anticipates what AI makes possible, and positions their organization to lead — not follow." },
    ],
    closing: null,
    whoFor: "Companies that need leadership at every level — not just at the top. Organizations ready to develop leaders from the inside out across every tier of their business.",
  },
  {
    id: "ai-sales-mastery",
    badge: "Sales",
    badgeColor: "#C2185B",
    name: "AI Sales Mastery™",
    tagline: "DISC Behavioral Insights + AI for Revenue Acceleration",
    theme: "Personality Mastery + AI = Sales That Feel Natural, Trusted, and Effective.",
    image: "/AI%20Sales%20Mastery%20framework%20infographic.png",
    price: "$6,000",
    paymentUrl: PAYMENT_AI_SALES_URL,
    intro: "The future of sales is not louder — it's smarter. AI Sales Mastery™ combines the proven power of DISC behavioral insights with AI to create a sales approach that feels natural, builds trust, and accelerates revenue without pressure tactics or guesswork.\n\nWhen you understand how your client thinks, decides, and communicates — and you use AI to personalize that understanding at scale — selling stops feeling like selling.",
    dimensions: [
      { label: "Hyper-Personalized Outreach at Scale", desc: "Reach the right person with the right message at the right time — every time — without losing the human touch." },
      { label: "Speak Your Client's Decision Language", desc: "Every buyer has a behavioral style that drives how they evaluate, decide, and commit. DISC gives you the map. AI gives you the speed." },
      { label: "Predict Objections Before They Happen", desc: "Stop reacting and start anticipating. Know what concerns are coming and address them before they become barriers." },
      { label: "Close with Confidence, Not Pressure", desc: "Confidence comes from clarity. When you know your client's behavioral style and your AI is working alongside you, closing becomes a natural next step." },
      { label: "Build Long-Term Client Relationships", desc: "Not one-time wins. The goal is not a transaction — it's a transformation of how your client sees you as a trusted partner." },
    ],
    closing: null,
    whoFor: "Sales teams ready to integrate AI into their sales strategy and leaders who want to accelerate revenue without sacrificing relationship.",
  },
];

// ─── Shared styles ────────────────────────────────────────────────────────────
const pSection    = { marginBottom: "2rem" } as const;
const pStepHeader = { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 } as const;
const pDivider    = { flex: 1, height: "0.5px", background: "rgba(255,255,255,0.1)" } as const;
const pRow        = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.9rem 1rem", borderRadius: 8, gap: 12, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 8, background: "rgba(255,255,255,0.04)" } as const;
const pRowGold    = { ...pRow, borderLeft: "3px solid #D4AF37" } as const;
const pRowMag     = { ...pRow, borderLeft: "3px solid #C2185B" } as const;
const pName       = { fontFamily: "'Playfair Display', serif", fontSize: "0.88rem", fontWeight: 600, color: "#FFFFFF", margin: "0 0 3px" } as const;
const pSub        = { fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", color: "rgba(230,230,230,0.55)", margin: 0, lineHeight: 1.5 } as const;
const pPrice      = { fontFamily: "'Playfair Display', serif", fontSize: "1rem", fontWeight: 700, color: "#D4AF37", whiteSpace: "nowrap" as const, textAlign: "right" as const } as const;
const pMeta       = { fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", color: "rgba(230,230,230,0.4)", textAlign: "right" as const, whiteSpace: "nowrap" as const } as const;
const pReportTag  = { display: "inline-block", marginTop: 6, fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(230,230,230,0.5)" } as const;
const anchorTag   = { display: "inline-block", fontFamily: "'Montserrat', sans-serif", fontSize: "0.58rem", fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "rgba(212,175,55,0.15)", color: "#D4AF37", marginRight: 5 } as const;
// ─────────────────────────────────────────────────────────────────────────────

type ModalConfig = { url: string; title: string } | null;

// ─── Pathway Component ────────────────────────────────────────────────────────
function PathwaySection() {
  const stages = [
    { label: "Discover", color: "#D4AF37" },
    { label: "Diagnose", color: "#D4AF37" },
    { label: "Design",   color: "#D4AF37" },
    { label: "Deploy",   color: "#C2185B" },
    { label: "Dominate", color: "#C2185B" },
  ];
  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.92rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#D4AF37", marginBottom: 12 }}>
        The DRU AI Transformation Pathway™
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 0 }}>
        {stages.map((stage, i, arr) => (
          <div key={stage.label} style={{ display: "flex", alignItems: "center" }}>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.92rem", fontWeight: 700, letterSpacing: "0.06em", color: stage.color, padding: "5px 10px", borderBottom: `2px solid ${stage.color}` }}>
              {stage.label}
            </span>
            {i < arr.length - 1 && <span style={{ color: "rgba(212,175,55,0.5)", fontSize: "0.8rem", padding: "0 2px" }}>›</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepPathwayLabel({ stages, colors }: { stages: string; colors: string[] }) {
  const parts = stages.split(" + ");
  return (
    <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", color: "rgba(230,230,230,0.5)", marginTop: 2 }}>
      Pathway Stage{parts.length > 1 ? "s" : ""}:{" "}
      {parts.map((p, i) => (
        <span key={p}>
          <strong style={{ color: colors[i] || colors[0] }}>{p}</strong>
          {i < parts.length - 1 && <span style={{ color: "rgba(230,230,230,0.5)" }}> + </span>}
        </span>
      ))}
    </p>
  );
}

// ─── Terms + Payment Modal ────────────────────────────────────────────────────
function TermsModal({ modal, onClose }: { modal: NonNullable<ModalConfig>; onClose: () => void }) {
  const [accepted, setAccepted] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const thankYouRoute = THANK_YOU_ROUTES[modal.url];

  const handleContinue = () => {
    if (!accepted) return;
    if (BYPASS_PAYMENT && thankYouRoute) {
      window.location.href = thankYouRoute;
    } else {
      setShowPayment(true);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, height: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1.25rem", background: "#061829", borderBottom: "1px solid rgba(212,175,55,0.25)", flexShrink: 0 }}>
          <div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(212,175,55,0.6)", margin: "0 0 2px" }}>
              {showPayment ? "Step 2 of 2 — Payment" : "Step 1 of 2 — Review & Agree"}
            </p>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "0.85rem", fontWeight: 600, color: "#FFFFFF", margin: 0 }}>{modal.title}</p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "rgba(255,255,255,0.7)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 600, padding: "0.35rem 0.75rem", cursor: "pointer" }}>✕ Close</button>
        </div>

        {!showPayment ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={{ padding: "1.25rem 1.5rem 0" }}>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "1rem", color: "#D4AF37", fontWeight: 600, marginBottom: 4 }}>DRU AI Consulting</p>
              <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(230,230,230,0.4)", marginBottom: 16 }}>Terms of Engagement</p>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 1.5rem" }}>
              {TERMS.map((section) => (
                <div key={section.title} style={{ marginBottom: 16 }}>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "#D4AF37", letterSpacing: "0.06em", marginBottom: 4 }}>{section.title}</p>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.76rem", color: "rgba(230,230,230,0.7)", lineHeight: 1.7 }}>{section.body}</p>
                </div>
              ))}
              <div style={{ height: 8 }} />
            </div>
            <div style={{ padding: "1.25rem 1.5rem", borderTop: "1px solid rgba(212,175,55,0.15)", background: "#061829", flexShrink: 0 }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 16 }}>
                <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} style={{ marginTop: 2, accentColor: "#D4AF37", width: 16, height: 16, flexShrink: 0 }} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: "rgba(230,230,230,0.75)", lineHeight: 1.6 }}>
                  I have read and agree to the Terms of Engagement. I understand all payments are non-refundable.
                </span>
              </label>
              <button
                onClick={handleContinue}
                style={{ display: "block", width: "100%", background: accepted ? "#C2185B" : "rgba(194,24,91,0.25)", color: accepted ? "#FFFFFF" : "rgba(255,255,255,0.3)", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", padding: "0.875rem 1rem", borderRadius: 6, border: accepted ? "none" : "1px solid rgba(194,24,91,0.3)", cursor: accepted ? "pointer" : "not-allowed", transition: "all 0.2s ease" }}
              >
                {BYPASS_PAYMENT && thankYouRoute ? "Simulate Payment & Continue →" : "Continue to Payment →"}
              </button>
              {BYPASS_PAYMENT && (
                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.58rem", color: "rgba(212,175,55,0.4)", textAlign: "center", marginTop: 8, letterSpacing: "0.06em" }}>
                  ⚠ TEST MODE — Payment bypassed
                </p>
              )}
              {!BYPASS_PAYMENT && (
                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", color: "rgba(230,230,230,0.3)", textAlign: "center", marginTop: 10 }}>
                  Full terms available at app.druaiconsulting.com/terms
                </p>
              )}
            </div>
          </div>
        ) : (
          <iframe src={modal.url} title={modal.title} style={{ flex: 1, width: "100%", border: "none", background: "#FFFFFF" }} allow="payment" />
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Frameworks() {
  const [modal, setModal] = useState<ModalConfig>(null);
  const openModal = (url: string, title: string) => setModal({ url, title });

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/frameworks" />
      {modal && <TermsModal modal={modal} onClose={() => setModal(null)} />}

      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 680, margin: "0 auto", width: "100%" }}>

        {/* Strategic Outcomes */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(230,230,230,0.45)", fontWeight: 600, marginBottom: 10 }}>Strategic Outcomes</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
            {["Innovation", "Effectiveness", "Integration", "Performance"].map((o) => (
              <span key={o} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 14px", borderRadius: 20, border: "1px solid rgba(212,175,55,0.5)", color: "#D4AF37" }}>{o}</span>
            ))}
          </div>
        </div>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Your Investment in Transformation</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.85rem", fontWeight: 700, lineHeight: 1.25, marginBottom: "0.875rem" }}>Every transformation begins<br />with clarity.</h1>
          <p style={{ color: "rgba(230,230,230,0.6)", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", lineHeight: 1.8, maxWidth: 500, margin: "0 auto 1.5rem" }}>
            The DRU AI Transformation Pathway™ is a proven, sequential journey that moves you from awareness to full organizational activation. Every client walks the same five stages — no shortcuts, no skipped steps.
          </p>
          <PathwaySection />
        </div>

        {/* STEP 1 */}
        <div style={pSection}>
          <div style={pStepHeader}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#D4AF37", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.8rem", fontWeight: 700, color: "#3a2e00" }}>1</span>
            </div>
            <div>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "1rem", fontWeight: 600, color: "#FFFFFF", margin: 0 }}>Take the Assessment</p>
              <StepPathwayLabel stages="Discover" colors={["#D4AF37"]} />
              <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", color: "rgba(230,230,230,0.4)", marginTop: 1 }}>Uncover where you are and where you want to be</p>
            </div>
            <div style={pDivider} />
          </div>
          <div style={pRowGold}>
            <div style={{ flex: 1 }}>
              <p style={pName}>DRU CLEAR™ AI Readiness Scorecard</p>
              <p style={pSub}>Identify your gaps across all 4 frameworks and receive a personalized readiness score. Your transformation begins the moment you see your results.</p>
            </div>
            <p style={{ ...pPrice, fontSize: "1.1rem" }}>Free</p>
          </div>
        </div>

        {/* STEP 2 */}
        <div style={pSection}>
          <div style={pStepHeader}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#D4AF37", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.8rem", fontWeight: 700, color: "#3a2e00" }}>2</span>
            </div>
            <div>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "1rem", fontWeight: 600, color: "#FFFFFF", margin: 0 }}>Complete Your Diagnostic</p>
              <StepPathwayLabel stages="Diagnose + Design" colors={["#D4AF37", "#D4AF37"]} />
              <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", color: "rgba(230,230,230,0.4)", marginTop: 1 }}>Required investment to move forward in the pathway</p>
            </div>
            <div style={pDivider} />
          </div>
          <div style={pRowMag}>
            <div style={{ flex: 1 }}>
              <p style={pName}>Executive Diagnostic (ED) <span style={{ display: "inline-block", fontFamily: "'Montserrat', sans-serif", fontSize: "0.58rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#D4AF37", color: "#3a2e00", marginLeft: 8, verticalAlign: "middle" }}>Best Value</span></p>
              <p style={pSub}>120-min Zoom · Review of all 4 frameworks</p>
              <span style={pReportTag}>Includes: Executive AI Alignment Report — boardroom-ready</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
              <p style={pPrice}>$4,997</p>
              <button onClick={() => openModal(PAYMENT_EXECUTIVE_URL, "Executive Diagnostic — $4,997")} style={{ background: "#C2185B", color: "#FFF", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.07em", textTransform: "uppercase", padding: "0.45rem 0.875rem", borderRadius: 6, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>Book Now →</button>
            </div>
          </div>
          <div style={pRow}>
            <div style={{ flex: 1 }}>
              <p style={pName}>Strategic Diagnostic (SD)</p>
              <p style={pSub}>90-min Zoom · Review of 5D Leadership™ + DRU CLEAR™</p>
              <span style={pReportTag}>Includes: Strategic AI Insight Report</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
              <p style={pPrice}>$3,497</p>
              <button onClick={() => openModal(PAYMENT_STRATEGIC_URL, "Strategic Diagnostic — $3,497")} style={{ background: "transparent", color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.07em", textTransform: "uppercase", padding: "0.4rem 0.875rem", borderRadius: 6, border: "1px solid rgba(212,175,55,0.4)", cursor: "pointer", whiteSpace: "nowrap" }}>Book Now →</button>
            </div>
          </div>
        </div>

        {/* Transition */}
        <div style={{ textAlign: "center", padding: "1.5rem 1rem", margin: "0.5rem 0", borderTop: "1px solid rgba(212,175,55,0.15)", borderBottom: "1px solid rgba(212,175,55,0.15)" }}>
          <p style={{ fontSize: "1.25rem", color: "#D4AF37", marginBottom: 8 }}>↓</p>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "0.95rem", color: "#FFFFFF", fontWeight: 600, marginBottom: 6 }}>Your diagnostic is complete. Your pathway is clear.</p>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", color: "rgba(230,230,230,0.55)", lineHeight: 1.75, maxWidth: 460, margin: "0 auto" }}>
            You and DeAnna will partner in discovering which framework or bundle targets your highest-impact transformation opportunity — closing the gap between where you are and where you are destined to be.
          </p>
        </div>

        {/* STEP 3 */}
        <div style={{ ...pSection, marginTop: "1.5rem" }}>
          <div style={pStepHeader}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#C2185B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.8rem", fontWeight: 700, color: "#FFFFFF" }}>3</span>
            </div>
            <div>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "1rem", fontWeight: 600, color: "#FFFFFF", margin: 0 }}>Activate Your Transformation</p>
              <StepPathwayLabel stages="Deploy + Dominate" colors={["#C2185B", "#C2185B"]} />
              <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", color: "rgba(230,230,230,0.4)", marginTop: 1 }}>Post-diagnostic · Virtual delivery</p>
            </div>
            <div style={pDivider} />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0 8px 2px" }}>
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(212,175,55,0.6)", fontWeight: 600, margin: 0 }}>Individual Frameworks</p>
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", color: "rgba(230,230,230,0.35)", fontStyle: "italic", margin: 0 }}>See Detail Below</p>
          </div>
          {[
            { name: "DRU CLEAR™", sub: "Flagship · Connects all 4 frameworks", price: "$7,500", gold: true },
            { name: "5D Leadership™", sub: "5 Dimensions of leadership", price: "$6,500", gold: false },
            { name: "5C Cultural DNA™", sub: "Culture transformation", price: "$6,000", gold: false },
            { name: "AI Sales Mastery™", sub: "DISC + AI revenue acceleration", price: "$6,000", gold: false },
          ].map((fw) => (
            <div key={fw.name} style={fw.gold ? pRowGold : pRow}>
              <div style={{ flex: 1 }}>
                <p style={pName}>{fw.name}</p>
                <p style={pSub}>{fw.sub}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={pPrice}>{fw.price}</p>
                <p style={pMeta}>3 sessions · 90 min</p>
              </div>
            </div>
          ))}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0 8px 2px" }}>
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(212,175,55,0.6)", fontWeight: 600, margin: 0 }}>Bundles</p>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.62rem", color: "rgba(230,230,230,0.35)", fontStyle: "italic", margin: 0 }}>Available after your diagnostic session</p>
          </div>
          <div style={pRowMag}>
            <div style={{ flex: 1 }}>
              <p style={pName}>Full Ecosystem — All 4 <span style={{ display: "inline-block", fontFamily: "'Montserrat', sans-serif", fontSize: "0.58rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#C2185B", color: "#fff", marginLeft: 8, verticalAlign: "middle" }}>Best Value</span></p>
              <p style={pSub}><span style={anchorTag}>Anchor</span> DRU CLEAR™ · 5D · 5C · AI Sales · 3 months</p>
              <p style={{ ...pSub, marginTop: 3 }}>4 sessions/month · 90 min · 12 sessions total</p>
            </div>
            <p style={pPrice}>$26,000</p>
          </div>
          <div style={pRow}>
            <div style={{ flex: 1 }}>
              <p style={pName}>DRU CLEAR™ + 2 Frameworks</p>
              <p style={pSub}><span style={anchorTag}>Anchor</span> DRU CLEAR™ · + your choice of 2</p>
            </div>
            <p style={pPrice}>$19,500</p>
          </div>
          <div style={pRow}>
            <div style={{ flex: 1 }}>
              <p style={pName}>DRU CLEAR™ + 1 Framework</p>
              <p style={pSub}><span style={anchorTag}>Anchor</span> DRU CLEAR™ · + your choice of 1</p>
            </div>
            <p style={pPrice}>$13,500</p>
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", padding: "2rem 1.5rem", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(212,175,55,0.2)", marginBottom: "3rem" }}>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", color: "#FFFFFF", fontWeight: 600, marginBottom: 8 }}>Every journey starts with the assessment.</p>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", color: "rgba(230,230,230,0.55)", lineHeight: 1.75, marginBottom: 20 }}>Discover your gaps. See where you are.<br />Define where you are destined to be.</p>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(230,230,230,0.5)", marginBottom: 14 }}>Choose Your Diagnostic</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360, margin: "0 auto" }}>
            <button onClick={() => openModal(PAYMENT_EXECUTIVE_URL, "Executive Diagnostic — $4,997")} style={{ background: "#C2185B", color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", padding: "0.875rem 1rem", borderRadius: 6, border: "none", cursor: "pointer" }}>
              Book Executive Diagnostic →
            </button>
            <button onClick={() => openModal(PAYMENT_STRATEGIC_URL, "Strategic Diagnostic — $3,497")} style={{ background: "transparent", color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", padding: "0.8rem 1rem", borderRadius: 6, border: "1px solid rgba(212,175,55,0.35)", cursor: "pointer" }}>
              Book Strategic Diagnostic →
            </button>
          </div>
        </div>

        {/* Framework Detail Cards */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>DRU AI Leadership Ecosystem™</p>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.75rem" }}>Explore the Frameworks</h2>
          <p style={{ color: "rgba(230,230,230,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.88rem", lineHeight: 1.7, maxWidth: 500, margin: "0 auto" }}>
            Original IP designed to move organizations from AI uncertainty to AI authority. Each framework can be engaged individually, in pairs, or as a complete ecosystem.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {FRAMEWORKS.map((fw) => (
            <div key={fw.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.18)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ position: "relative" }}>
                <img src={fw.image} alt={fw.name} style={{ width: "100%", display: "block", maxHeight: 220, objectFit: "cover", objectPosition: "center top" }} />
                <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(10,35,66,0.9)", border: "1px solid rgba(212,175,55,0.55)", borderRadius: 10, padding: "0.65rem 1.25rem", backdropFilter: "blur(4px)" }}>
                  <p style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontWeight: 700, fontSize: "1.5rem", lineHeight: 1 }}>{fw.price}</p>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.5)", fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 3 }}>Virtual</p>
                </div>
                <div style={{ position: "absolute", bottom: 12, left: 12 }}>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: fw.badgeColor, background: "rgba(10,35,66,0.85)", border: `1px solid ${fw.badgeColor}60`, borderRadius: 4, padding: "0.2rem 0.55rem" }}>{fw.badge}</span>
                </div>
              </div>
              <div style={{ padding: "1.25rem 1.5rem" }}>
                <h2 style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "1.35rem", fontWeight: 700, marginBottom: "0.25rem" }}>{fw.name}</h2>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.45)", fontSize: "0.7rem", letterSpacing: "0.06em", marginBottom: fw.theme ? "0.4rem" : "1rem" }}>{fw.tagline}</p>
                {fw.theme && <p style={{ fontFamily: "'Inter', sans-serif", color: "#D4AF37", fontSize: "0.75rem", fontStyle: "italic", marginBottom: "1rem", opacity: 0.85 }}>{fw.theme}</p>}
                {fw.intro.split("\n\n").map((para, i) => (
                  <p key={i} style={{ color: "rgba(230,230,230,0.8)", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", lineHeight: 1.75, marginBottom: "0.875rem" }}>{para}</p>
                ))}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1rem" }}>
                  {fw.dimensions.map((dim) => (
                    <div key={dim.label} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                      <span style={{ color: fw.badgeColor, fontSize: "0.7rem", marginTop: 2, flexShrink: 0 }}>✦</span>
                      <div>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.78rem" }}>{dim.label}</span>
                        <span style={{ color: "rgba(230,230,230,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem" }}> — {dim.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {fw.closing && (
                  <div style={{ background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 8, padding: "0.875rem", marginBottom: "1rem" }}>
                    <p style={{ color: "rgba(230,230,230,0.75)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", lineHeight: 1.65, fontStyle: "italic" }}>{fw.closing}</p>
                  </div>
                )}
                <div style={{ marginBottom: "1.25rem" }}>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.4)", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.3rem" }}>Ideal for</p>
                  <p style={{ color: "rgba(230,230,230,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", lineHeight: 1.6 }}>{fw.whoFor}</p>
                </div>
                <button
                  onClick={() => openModal(fw.paymentUrl, `${fw.name} — ${fw.price}`)}
                  style={{ display: "block", width: "100%", background: "#C2185B", color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", padding: "0.75rem 1rem", borderRadius: 6, border: "none", cursor: "pointer" }}
                >
                  Get Started →
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* In-person note */}
        <div style={{ marginTop: "2rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 10, padding: "1.25rem 1.5rem", textAlign: "center" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.4rem" }}>In-Person Workshop Pricing</p>
          <p style={{ color: "rgba(230,230,230,0.6)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem", lineHeight: 1.6, marginBottom: "0.75rem" }}>Available for on-site facilitation. Custom pricing based on team size, location, and engagement scope.</p>
          <button
            onClick={() => openModal(CALENDAR_URL, "Book a Strategy Call — In-Person Pricing")}
            style={{ background: "transparent", color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", border: "none", cursor: "pointer", padding: 0 }}
          >
            Book a Strategy Call for Custom Pricing →
          </button>
        </div>

      </main>

      <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
