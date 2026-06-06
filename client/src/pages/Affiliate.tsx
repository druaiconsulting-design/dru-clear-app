import AdminLayout from "../components/AdminLayout";

const TOOLS = [
  {
    name: "Manus AI",
    category: "AI Agent Platform",
    description: "The most capable AI agent platform for complex, multi-step tasks. Build, deploy, and automate workflows that used to require a team.",
    badge: "DeAnna Actively Uses",
    badgeColor: "#C2185B",
    badgeBg: "rgba(194,24,91,0.1)",
    badgeBorder: "rgba(194,24,91,0.25)",
    href: "https://manus.im/invitation/KJTBXETXGVNB?utm_source=invitation&utm_medium=social&utm_campaign=copy_link",
    showButton: true,
    affiliateNote: "",
  },
  {
    name: "Lovable",
    category: "AI App Builder",
    description: "Build full-stack web apps with plain English prompts. The fastest way for non-developers to bring digital products to life.",
    badge: "DeAnna Actively Uses",
    badgeColor: "#C2185B",
    badgeBg: "rgba(194,24,91,0.1)",
    badgeBorder: "rgba(194,24,91,0.25)",
    href: "https://lovable.dev/invite/FXZHFT4",
    showButton: true,
    affiliateNote: "",
  },
  {
    name: "GoHighLevel (GHL)",
    category: "CRM & Automation",
    description: "The all-in-one platform for CRM, funnels, automations, calendars, and email. The backbone of the DRU AI Consulting ecosystem.",
    badge: "DRU Ecosystem Powered By",
    badgeColor: "#D4AF37",
    badgeBg: "rgba(212,175,55,0.08)",
    badgeBorder: "rgba(212,175,55,0.25)",
    href: "#",
    showButton: false,
    affiliateNote: "",
  },
];

export default function Affiliate() {
  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 680, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "0.5rem" }}>Curated by DeAnna R. Upshaw</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.75rem" }}>Leadership & AI Tools</h1>
          <p style={{ color: "rgba(10,35,66,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.88rem", lineHeight: 1.7 }}>
            Each tool listed below has been individually vetted and trusted by DeAnna within the DRU AI Consulting ecosystem. When you succeed, our collective success is achieved.
          </p>
        </div>

        {/* Disclosure */}
        <div style={{ background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8, padding: "0.875rem 1rem", marginBottom: "2rem" }}>
          <p style={{ color: "rgba(10,35,66,0.55)", fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", lineHeight: 1.6 }}>
            <span style={{ color: "#D4AF37", fontWeight: 700 }}>Affiliate disclosure:</span> Links on this page are affiliate links. If you purchase through these links, you and DeAnna win! She only recommends tools she actively uses and trusts.
          </p>
        </div>

        {/* Tool cards */}
        <div style={{ display: "flex", flexDirection: "column" as const, gap: "1.25rem" }}>
          {TOOLS.map((tool) => (
            <div key={tool.name} style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.1)", borderRadius: 12, padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "0.6rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.3rem", flexWrap: "wrap" as const }}>
                    <h3 style={{ fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontWeight: 700, fontSize: "1rem" }}>{tool.name}</h3>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: tool.badgeColor, background: tool.badgeBg, border: `1px solid ${tool.badgeBorder}`, borderRadius: 4, padding: "0.15rem 0.45rem" }}>{tool.badge}</span>
                  </div>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.65rem", letterSpacing: "0.08em" }}>{tool.category}</p>
                </div>
              </div>
              <p style={{ color: "rgba(10,35,66,0.7)", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", lineHeight: 1.7, marginBottom: "1rem" }}>{tool.description}</p>
              {tool.showButton ? (
                <a href={tool.href} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", background: "rgba(212,175,55,0.1)", color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase" as const, textDecoration: "none", padding: "0.6rem 1rem", borderRadius: 6, border: "1px solid rgba(212,175,55,0.3)" }}>
                  Get {tool.name} →
                </a>
              ) : (
                <div style={{ background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 6, padding: "0.65rem 0.875rem" }}>
                  <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.5)", fontSize: "0.75rem", fontStyle: "italic" }}>
                    Ask DeAnna about GHL during your diagnostic session for a great value.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Suggest a Tool */}
        <div style={{ marginTop: "1.5rem", textAlign: "center" as const, padding: "1.25rem", background: "rgba(10,35,66,0.02)", border: "1px dashed rgba(10,35,66,0.15)", borderRadius: 10 }}>
          <p style={{ color: "rgba(10,35,66,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem" }}>More tools being added regularly. Have a tool you'd like DeAnna to review?</p>
          <a href="mailto:info@druaiconsulting.com" style={{ display: "inline-block", marginTop: "0.5rem", color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase" as const, textDecoration: "none" }}>
            Suggest a Tool →
          </a>
        </div>

        <footer style={{ textAlign: "center" as const, padding: "1rem 0 0.5rem", color: "rgba(10,35,66,0.3)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
          © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
        </footer>
      </main>
    </AdminLayout>
  );
}
