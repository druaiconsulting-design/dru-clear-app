import NavBar from "../components/NavBar";

const RESOURCE_CATEGORIES = [
  {
    label: "AI Leadership Guides",
    icon: "🧠",
    description: "Strategic frameworks and playbooks for leading with AI",
    comingSoon: true,
  },
  {
    label: "White Papers",
    icon: "📄",
    description: "In-depth research and thought leadership from DRU AI Consulting",
    comingSoon: true,
  },
  {
    label: "Notion Templates",
    icon: "📐",
    description: "Ready-to-use planning and strategy templates",
    comingSoon: true,
  },
  {
    label: "Case Studies",
    icon: "📊",
    description: "Real transformation stories from clients in the DRU ecosystem",
    comingSoon: true,
  },
];

// ─── New This Week ─────────────────────────────────────────────────────────────
// Set to null when nothing is new — banner will be hidden automatically
// Set to a string to show the banner: "AI Leadership Playbook — The 5-Step Framework..."
const NEW_THIS_WEEK: string | null = null;
// ──────────────────────────────────────────────────────────────────────────────

export default function Resources() {
  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/resources" />

      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 680, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Knowledge Vault</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.75rem" }}>Resource Hub</h1>
          <p style={{ color: "rgba(230,230,230,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.88rem", lineHeight: 1.7 }}>
            Curated guides, frameworks, and tools to accelerate your AI leadership journey. Resources added weekly.
          </p>
        </div>

        {/* New This Week banner — only shows when NEW_THIS_WEEK is set */}
        {NEW_THIS_WEEK && (
          <div style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.4)", borderRadius: 10, padding: "0.875rem 1.25rem", marginBottom: "1.75rem", display: "flex", alignItems: "center", gap: "0.875rem" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#D4AF37", flexShrink: 0 }} />
            <div>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>New This Week</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.85)", fontSize: "0.8rem", lineHeight: 1.5 }}>{NEW_THIS_WEEK}</p>
            </div>
          </div>
        )}

        {/* Resource categories */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
          {RESOURCE_CATEGORIES.map((cat) => (
            <div key={cat.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 10, padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
                  <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>{cat.icon}</span>
                  <div>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.04em", marginBottom: "0.3rem" }}>{cat.label}</p>
                    <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.55)", fontSize: "0.75rem", lineHeight: 1.6 }}>{cat.description}</p>
                  </div>
                </div>
                {cat.comingSoon && (
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#D4AF37", background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 4, padding: "0.2rem 0.5rem", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
                    Coming Soon
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Resources added weekly note */}
        <div style={{ textAlign: "center", padding: "1rem 0", marginBottom: "1rem" }}>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.3)", fontSize: "0.75rem", fontStyle: "italic" }}>
            New resources are added weekly. Check back often.
          </p>
        </div>

        {/* Assessment CTA */}
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "rgba(230,230,230,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", marginBottom: "0.75rem" }}>Haven't taken the assessment yet?</p>
          <a href="/" style={{ display: "inline-block", color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 6, padding: "0.65rem 1.25rem" }}>
            Take the DRU CLEAR™ Scorecard →
          </a>
        </div>

      </main>

      <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
