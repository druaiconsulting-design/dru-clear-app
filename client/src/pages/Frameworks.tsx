import NavBar from "../components/NavBar";

const PAYMENT_STRATEGIC_URL = "https://link.druaiconsulting.com/payment-link/69dc8f8d557558e89e51f222";
const PAYMENT_EXECUTIVE_URL = "https://link.druaiconsulting.com/payment-link/69dc91c480425dc02fbc7645";
const CALENDAR_URL = "https://link.druaiconsulting.com/widget/bookings/dru-clear-ai-readiness-consultation";

const FRAMEWORKS = [
  {
    id: "dru-clear",
    badge: "Flagship",
    badgeColor: "#D4AF37",
    name: "DRU CLEAR™",
    tagline: "AI Readiness · Alignment · Leadership",
    description: "The foundational framework for assessing and building organizational AI readiness. CLEAR stands for Clarity, Leadership, Execution, Alignment, and Results — the five pillars that determine whether your AI strategy will succeed or stall.",
    transformation: "From scattered AI experiments to a unified, strategic AI roadmap with clear ownership and measurable results.",
    whoFor: "Executives, leadership teams, and organizations beginning or accelerating their AI journey.",
    cta: "primary",
  },
  {
    id: "ai-leadership-ecosystem",
    badge: "Master OS",
    badgeColor: "#C2185B",
    name: "DRU AI Leadership Ecosystem™",
    tagline: "The Complete Operating System for AI-Led Organizations",
    description: "The master framework that integrates all DRU IP into a cohesive operating system. This is the blueprint for building an organization where AI is not a department — it is a discipline embedded in every layer of leadership and culture.",
    transformation: "From AI as a tool to AI as a competitive advantage woven into your organizational DNA.",
    whoFor: "C-suite leaders, boards, and organizations ready to move from AI adoption to AI transformation.",
    cta: "executive",
  },
  {
    id: "5c-cultural-dna",
    badge: "Culture",
    badgeColor: "#1E88E5",
    name: "5C Cultural DNA™",
    tagline: "Communication · Connections · Collaboration · Coaching · Culture Transformation",
    description: "A proven framework for diagnosing and transforming the cultural conditions that either accelerate or block AI adoption. Technology does not transform organizations — people do. The 5C framework ensures your people are ready to lead alongside AI.",
    transformation: "From resistance and uncertainty to a culture of confident, intentional AI adoption at every level.",
    whoFor: "HR leaders, culture officers, and executives driving organization-wide change initiatives.",
    cta: "strategic",
  },
  {
    id: "5d-leadership",
    badge: "Leadership",
    badgeColor: "#43A047",
    name: "5D Leadership™",
    tagline: "The Leadership Model for the AI Era",
    description: "A leadership development framework built for the demands of the AI era. The 5 Dimensions equip leaders with the fluency, confidence, and strategic clarity to make high-stakes AI decisions, lead through uncertainty, and build teams that thrive alongside artificial intelligence.",
    transformation: "From AI-anxious to AI-authoritative — leaders who drive strategy rather than react to technology.",
    whoFor: "Emerging and senior leaders, executive coaches, and leadership development programs.",
    cta: "strategic",
  },
];

export default function Frameworks() {
  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/frameworks" />

      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 680, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>DRU AI Leadership Ecosystem™</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.75rem" }}>The Four Frameworks</h1>
          <p style={{ color: "rgba(230,230,230,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.88rem", lineHeight: 1.7, maxWidth: 500, margin: "0 auto" }}>
            Original IP designed to move organizations from AI uncertainty to AI authority — at every level of leadership.
          </p>
        </div>

        {/* Framework cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {FRAMEWORKS.map((fw) => (
            <div key={fw.id} style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(212,175,55,0.18)",
              borderRadius: 12,
              overflow: "hidden",
            }}>
              {/* Card header */}
              <div style={{ padding: "1.25rem 1.5rem 1rem", borderBottom: "1px solid rgba(212,175,55,0.1)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.6rem" }}>
                  <span style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: fw.badgeColor,
                    background: `${fw.badgeColor}18`,
                    border: `1px solid ${fw.badgeColor}40`,
                    borderRadius: 4,
                    padding: "0.2rem 0.55rem",
                  }}>{fw.badge}</span>
                </div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "1.35rem", fontWeight: 700, marginBottom: "0.25rem" }}>{fw.name}</h2>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.45)", fontSize: "0.7rem", letterSpacing: "0.06em" }}>{fw.tagline}</p>
              </div>

              {/* Card body */}
              <div style={{ padding: "1.25rem 1.5rem" }}>
                <p style={{ color: "rgba(230,230,230,0.8)", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", lineHeight: 1.75, marginBottom: "1rem" }}>{fw.description}</p>

                <div style={{ background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 8, padding: "0.875rem", marginBottom: "1rem" }}>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.35rem" }}>Transformation</p>
                  <p style={{ color: "rgba(230,230,230,0.75)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", lineHeight: 1.65, fontStyle: "italic" }}>{fw.transformation}</p>
                </div>

                <div style={{ marginBottom: "1.25rem" }}>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.4)", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.3rem" }}>Ideal for</p>
                  <p style={{ color: "rgba(230,230,230,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem" }}>{fw.whoFor}</p>
                </div>

                {/* CTAs */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <a
                    href={fw.cta === "executive" ? PAYMENT_EXECUTIVE_URL : PAYMENT_STRATEGIC_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block",
                      background: "#C2185B",
                      color: "#FFFFFF",
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 700,
                      fontSize: "0.78rem",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      textDecoration: "none",
                      textAlign: "center",
                      padding: "0.75rem 1rem",
                      borderRadius: 6,
                      transition: "opacity 0.2s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.88"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
                  >
                    {fw.cta === "executive" ? "Get the Executive Diagnostic →" : "Get the Strategic Diagnostic →"}
                  </a>
                  <a
                    href={CALENDAR_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block",
                      background: "transparent",
                      color: "#D4AF37",
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      textDecoration: "none",
                      textAlign: "center",
                      padding: "0.65rem 1rem",
                      borderRadius: 6,
                      border: "1px solid rgba(212,175,55,0.3)",
                      transition: "border-color 0.2s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(212,175,55,0.6)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(212,175,55,0.3)"; }}
                  >
                    Book a Discovery Call
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

      </main>

      <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
