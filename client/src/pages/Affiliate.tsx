import NavBar from "../components/NavBar";

const TOOLS = [
  {
    name: "Manus AI",
    category: "AI Agent Platform",
    description: "The most capable AI agent platform for complex, multi-step tasks. Build, deploy, and automate workflows that used to require a team.",
    badge: "DeAnna Uses This",
    badgeColor: "#C2185B",
    badgeBg: "rgba(194,24,91,0.12)",
    badgeBorder: "rgba(194,24,91,0.3)",
    href: "https://druaiconsulting.com/manus",
    showButton: true,
    affiliateNote: "Affiliate link — DeAnna earns a commission at no cost to you.",
  },
  {
    name: "Lovable",
    category: "AI App Builder",
    description: "Build full-stack web apps with plain English prompts. The fastest way for non-developers to bring digital products to life.",
    badge: "Recommended",
    badgeColor: "#C2185B",
    badgeBg: "rgba(194,24,91,0.12)",
    badgeBorder: "rgba(194,24,91,0.3)",
    href: "https://druaiconsulting.com/lovable",
    showButton: true,
    affiliateNote: "Affiliate link — DeAnna earns a commission at no cost to you.",
  },
  {
    name: "GoHighLevel (GHL)",
    category: "CRM & Automation",
    description: "The all-in-one platform for CRM, funnels, automations, calendars, and email. The backbone of the DRU AI Consulting ecosystem.",
    badge: "DRU Ecosystem Powered By",
    badgeColor: "#D4AF37",
    badgeBg: "rgba(212,175,55,0.1)",
    badgeBorder: "rgba(212,175,55,0.3)",
    href: "#",
    showButton: false,
    affiliateNote: "",
  },
];

export default function Affiliate() {
  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/affiliate" />

      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 680, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Curated by DeAnna R. Upshaw</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.75rem" }}>Leadership & AI Tools</h1>
          <p style={{ color: "rgba(230,230,230,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.88rem", lineHeight: 1.7 }}>
            Each tool listed below has been individually vetted and trusted by DeAnna within the DRU AI Consulting ecosystem. When you succeed, our collective success is achieved.
          </p>
        </div>

        {/* Disclosure */}
        <div style={{ background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 8, padding: "0.875rem 1rem", marginBottom: "2rem" }}>
          <p style={{ color: "rgba(230,230,230,0.5)", fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", lineHeight: 1.6 }}>
            <span style={{ color: "#D4AF37", fontWeight: 700 }}>Affiliate disclosure:</span> Links on this page are affiliate links. If you purchase through these links, you and DeAnna win! She only recommends tools she actively uses and trusts.
          </p>
        </div>

        {/* Tool cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {TOOLS.map((tool) => (
            <div key={tool.name} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.18)", borderRadius: 12, padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "0.6rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.3rem", flexWrap: "wrap" as const }}>
                    <h3 style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "1rem" }}>{tool.name}</h3>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: tool.badgeColor, background: tool.badgeBg, border: `1px solid ${tool.badgeBorder}`, borderRadius: 4, padding: "0.15rem 0.45rem" }}>{tool.badge}</span>
                  </div>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.65rem", letterSpacing: "0.08em" }}>{tool.category}</p>
                </div>
              </div>

              <p style={{ color: "rgba(230,230,230,0.75)", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", lineHeight: 1.7, marginBottom: "1rem" }}>{tool.description}</p>

              {tool.showButton ? (
                <>
                  <a href={tool.href} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", background: "rgba(212,175,55,0.1)", color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", padding: "0.6rem 1rem", borderRadius: 6, border: "1px solid rgba(212,175,55,0.3)", marginBottom: "0.5rem" }}>
                    Get {tool.name} →
                  </a>
                  {tool.affiliateNote && (
                    <p style={{ color: "rgba(230,230,230,0.3)", fontFamily: "'Inter', sans-serif", fontSize: "0.65rem", fontStyle: "italic" }}>{tool.affiliateNote}</p>
                  )}
                </>
              ) : (
                <div style={{ background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 6, padding: "0.65rem 0.875rem" }}>
                  <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.75rem", fontStyle: "italic" }}>
                    Ask DeAnna about GHL during your diagnostic session.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Suggest a Tool */}
        <div style={{ marginTop: "1.5rem", textAlign: "center", padding: "1.25rem", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(212,175,55,0.15)", borderRadius: 10 }}>
          <p style={{ color: "rgba(230,230,230,0.4)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem" }}>More tools being added regularly. Have a tool you'd like DeAnna to review?</p>
          <a href="mailto:info@druaiconsulting.com" style={{ display: "inline-block", marginTop: "0.5rem", color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none" }}>
            Suggest a Tool →
          </a>
        </div>

      </main>

      <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
