import { useState } from "react";
import NavBar from "../components/NavBar";

const PAYMENT_FULL_ECOSYSTEM_URL = "https://link.druaiconsulting.com/payment-link/69e41a287dd3512d920772ff";

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
    badge: "Flagship Framework",
    badgeColor: "#D4AF37",
    name: "DRU CLEAR™",
    tagline: "Align for AI Execution",
    theme: null,
    image: "/DRU%20CLEAR%20.png",
    price: "$7,500",
    intro: "Every organization has a starting point. DRU CLEAR™ is the framework that finds it — and builds the bridge from where you are to where AI can take you.\n\nAs the flagship framework of the DRU AI Leadership Ecosystem™, DRU CLEAR™ is the transformation pathway that connects all four frameworks into a unified, executable strategy.",
    dimensions: [
      { label: "Clarity", desc: "Define your AI vision with precision." },
      { label: "Leadership", desc: "Ensure your leaders have the AI fluency and strategic conviction to drive transformation." },
      { label: "Execution", desc: "Close the gap between strategy and action." },
      { label: "Alignment", desc: "Unify your organization around a single AI strategy." },
      { label: "Results", desc: "Define, measure, and demonstrate ROI." },
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
    intro: "Most organizations don't have an AI problem — they have a culture problem. The 5C Cultural DNA™ framework helps organizations discover and address cultural dysfunction, silos, and communication breakdowns that silently block progress.",
    dimensions: [
      { label: "Communication", desc: "The foundation. How leaders and teams exchange information and create clarity around AI strategy." },
      { label: "Connection", desc: "The relational layer. Building trust and meaningful relationships between people and leadership." },
      { label: "Collaboration", desc: "The action layer. Breaking down silos and creating cross-functional alignment." },
      { label: "Coaching", desc: "The development layer. Leaders coaching teams through uncertainty and new AI capabilities." },
      { label: "Culture Transformation", desc: "The outcome. From resistance and fear around AI to ownership, confidence, and strategic adoption." },
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
    intro: "5D Leadership™ focuses on the whole leader — building from the inside out across five critical dimensions that determine whether leadership actually transforms an organization or just manages it.",
    dimensions: [
      { label: "I. Self", desc: "Personal mastery. How a leader thinks, decides, and shows up." },
      { label: "II. People", desc: "Relational intelligence. How a leader connects with and develops the individuals around them." },
      { label: "III. Team", desc: "Collective effectiveness. How a leader builds cohesion, trust, and high performance." },
      { label: "IV. Organization", desc: "Systemic strength. How a leader aligns culture, strategy, and operations." },
      { label: "V. Visionary", desc: "Strategic impact. How a leader positions their organization to lead — not follow." },
    ],
    closing: null,
    whoFor: "Companies that need leadership at every level. Organizations ready to develop leaders from the inside out across every tier of their business.",
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
    intro: "AI Sales Mastery™ combines the proven power of DISC behavioral insights with AI to create a sales approach that feels natural, builds trust, and accelerates revenue without pressure tactics or guesswork.",
    dimensions: [
      { label: "Hyper-Personalized Outreach at Scale", desc: "Reach the right person with the right message at the right time." },
      { label: "Speak Your Client's Decision Language", desc: "DISC gives you the map. AI gives you the speed." },
      { label: "Predict Objections Before They Happen", desc: "Know what concerns are coming and address them before they become barriers." },
      { label: "Close with Confidence, Not Pressure", desc: "When you know your client's behavioral style, closing becomes a natural next step." },
      { label: "Build Long-Term Client Relationships", desc: "Not one-time wins — a transformation of how your client sees you as a trusted partner." },
    ],
    closing: null,
    whoFor: "Sales teams ready to integrate AI into their sales strategy and leaders who want to accelerate revenue without sacrificing relationship.",
  },
];

// ─── Shared styles ────────────────────────────────────────────────────────────
const pRow    = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.9rem 1rem", borderRadius: 8, gap: 12, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 8, background: "rgba(255,255,255,0.04)" } as const;
const pRowMag = { ...pRow, borderLeft: "3px solid #C2185B" } as const;
const pName   = { fontFamily: "'Playfair Display', serif", fontSize: "0.88rem", fontWeight: 600, color: "#FFFFFF", margin: "0 0 3px" } as const;
const pSub    = { fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", color: "rgba(230,230,230,0.55)", margin: 0, lineHeight: 1.5 } as const;
const pPrice  = { fontFamily: "'Playfair Display', serif", fontSize: "1rem", fontWeight: 700, color: "#D4AF37", whiteSpace: "nowrap" as const, textAlign: "right" as const } as const;
const anchorTag = { display: "inline-block", fontFamily: "'Montserrat', sans-serif", fontSize: "0.58rem", fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "rgba(212,175,55,0.15)", color: "#D4AF37", marginRight: 5 } as const;
// ─────────────────────────────────────────────────────────────────────────────

type ModalConfig = { url: string; title: string } | null;

function PathwaySection() {
  const stages = [
    { label: "Discover", gold: true },
    { label: "Diagnose", gold: true },
    { label: "Design",   gold: true },
    { label: "Deploy",   gold: false },
    { label: "Dominate", gold: false },
  ];
  return (
    <div style={{ textAlign: "center" }}>
      <p style={{
        fontFamily: "'Montserrat', sans-serif",
        fontSize: "0.75rem", fontWeight: 700,
        letterSpacing: "0.2em", textTransform: "uppercase",
        color: "#D4AF37",
        textShadow: "0 0 12px rgba(212,175,55,1), 0 0 24px rgba(212,175,55,0.7), 0 0 48px rgba(212,175,55,0.35)",
        marginBottom: 12,
      }}>
        The DRU AI Transformation Pathway™
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 0 }}>
        {stages.map((stage, i, arr) => (
          <div key={stage.label} style={{ display: "flex", alignItems: "center" }}>
            <span style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: "0.92rem", fontWeight: 700,
              letterSpacing: "0.06em",
              color: stage.gold ? "#D4AF37" : "#E91E8C",
              padding: "5px 10px",
              borderBottom: `2px solid ${stage.gold ? "#D4AF37" : "#C2185B"}`,
              textShadow: stage.gold
                ? "0 0 8px rgba(212,175,55,0.9), 0 0 18px rgba(212,175,55,0.5)"
                : "0 0 8px rgba(194,24,91,0.9), 0 0 18px rgba(194,24,91,0.5)",
            }}>{stage.label}</span>
            {i < arr.length - 1 && <span style={{ color: "rgba(212,175,55,0.5)", fontSize: "0.8rem", padding: "0 2px" }}>›</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function TermsModal({ modal, onClose }: { modal: NonNullable<ModalConfig>; onClose: () => void }) {
  const [accepted, setAccepted] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, height: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1.25rem", background: "#061829", borderBottom: "1px solid rgba(212,175,55,0.25)", flexShrink: 0 }}>
          <div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(212,175,55,0.6)", margin: "0 0 2px" }}>
              {showPayment ? "Step 2 of 2 — Payment" : "Step 1 of 2 — Review & Agree"}
            </p>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "0.85rem", fontWeight: 600, color: "#FFFFFF", margin: 0 }}>{modal.title}</p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "rgba(255,255,255,0.7)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 600, padding: "0.35rem 0.75rem", cursor: "pointer", letterSpacing: "0.06em" }}>✕ Close</button>
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
                onClick={() => accepted && setShowPayment(true)}
                style={{ display: "block", width: "100%", background: accepted ? "#C2185B" : "rgba(194,24,91,0.25)", color: accepted ? "#FFFFFF" : "rgba(255,255,255,0.3)", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", padding: "0.875rem 1rem", borderRadius: 6, border: accepted ? "none" : "1px solid rgba(194,24,91,0.3)", cursor: accepted ? "pointer" : "not-allowed", transition: "all 0.2s ease" }}
              >
                Continue to Payment →
              </button>
              <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", color: "rgba(230,230,230,0.3)", textAlign: "center", marginTop: 10 }}>
                Full terms available at app.druaiconsulting.com/terms
              </p>
            </div>
          </div>
        ) : (
          <iframe src={modal.url} title={modal.title} style={{ flex: 1, width: "100%", border: "none", background: "#FFFFFF" }} allow="payment" />
        )}
      </div>
    </div>
  );
}

export default function BundlePricing() {
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

        {/* ── BUNDLE PRICING ───────────────────────────────────────────────── */}
        <div style={{ margin: "2.5rem 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(212,175,55,0.2)" }} />
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#D4AF37", whiteSpace: "nowrap" }}>Bundle Pricing</p>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(212,175,55,0.2)" }} />
          </div>

          {/* Full Ecosystem — Best Value — with CTA */}
          <div style={{ ...pRowMag, flexDirection: "column", alignItems: "stretch", padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ ...pName, fontSize: "1rem" }}>
                  Full Ecosystem — All 4
                  <span style={{ display: "inline-block", fontFamily: "'Montserrat', sans-serif", fontSize: "0.58rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#C2185B", color: "#fff", marginLeft: 8, verticalAlign: "middle" }}>Best Value</span>
                </p>
                <p style={pSub}><span style={anchorTag}>Anchor</span> DRU CLEAR™ · 5D · 5C · AI Sales · 3 months</p>
                <p style={{ ...pSub, marginTop: 3 }}>4 sessions/month · 90 min · 12 sessions total</p>
              </div>
              <p style={{ ...pPrice, fontSize: "1.25rem", marginLeft: 16 }}>$26,000</p>
            </div>
            <button
              onClick={() => openModal(PAYMENT_FULL_ECOSYSTEM_URL, "Full Ecosystem — All 4 · $26,000")}
              style={{ display: "block", width: "100%", background: "#C2185B", color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.875rem 1rem", borderRadius: 6, border: "none", cursor: "pointer" }}
            >
              Secure My Pathway →
            </button>
          </div>

          {/* DRU CLEAR + 2 — info only */}
          <div style={pRow}>
            <div style={{ flex: 1 }}>
              <p style={pName}>DRU CLEAR™ + 2 Frameworks</p>
              <p style={pSub}><span style={anchorTag}>Anchor</span> DRU CLEAR™ · + your choice of 2</p>
            </div>
            <p style={pPrice}>$19,500</p>
          </div>

          {/* DRU CLEAR + 1 — info only */}
          <div style={pRow}>
            <div style={{ flex: 1 }}>
              <p style={pName}>DRU CLEAR™ + 1 Framework</p>
              <p style={pSub}><span style={anchorTag}>Anchor</span> DRU CLEAR™ · + your choice of 1</p>
            </div>
            <p style={pPrice}>$13,500</p>
          </div>

          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "rgba(230,230,230,0.35)", fontStyle: "italic", textAlign: "center", marginTop: 12 }}>
            Available after your diagnostic session
          </p>
        </div>

        {/* ── DRU AI LEADERSHIP ECOSYSTEM ─────────────────────────────────── */}
        <div style={{ marginTop: "3rem" }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>DRU AI Leadership Ecosystem™</p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.75rem" }}>What You're Investing In</h2>
            <p style={{ color: "rgba(230,230,230,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.88rem", lineHeight: 1.7, maxWidth: 500, margin: "0 auto" }}>
              Four proprietary frameworks. One unified ecosystem. Designed to move your organization from AI uncertainty to AI authority.
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
                  <div>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.4)", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.3rem" }}>Ideal for</p>
                    <p style={{ color: "rgba(230,230,230,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", lineHeight: 1.6 }}>{fw.whoFor}</p>
                  </div>
                  {/* NO CTA buttons on bundle page */}
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
