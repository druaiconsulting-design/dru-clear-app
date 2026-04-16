import NavBar from "../components/NavBar";

const STAT_CARDS = [
  { label: "Assessments Completed", value: "—", sub: "Connect GHL to see live data", icon: "📋", color: "#D4AF37" },
  { label: "Leads Captured", value: "—", sub: "Total in funnel", icon: "👤", color: "#C2185B" },
  { label: "Diagnostics Sold", value: "—", sub: "Strategic + Executive", icon: "💰", color: "#43A047" },
  { label: "Sessions Booked", value: "—", sub: "Upcoming calls", icon: "📅", color: "#1E88E5" },
];

const QUICK_LINKS = [å
  { label: "GHL Dashboard", href: "https://app.gohighlevel.com", icon: "🔗" },
  { label: "Strategic Payment Link", href: "https://link.druaiconsulting.com/payment-link/69dc8f8d557558e89e51f222", icon: "💳" },
  { label: "Executive Payment Link", href: "https://link.druaiconsulting.com/payment-link/69dc91c480425dc02fbc7645", icon: "💳" },
  { label: "Booking Calendar", href: "https://link.druaiconsulting.com/widget/bookings/dru-clear-ai-readiness-consultation", icon: "📅" },
  { label: "Live Assessment App", href: "https://assessment.druaiconsulting.com", icon: "🚀" },
  { label: "GitHub Repo", href: "https://github.com/druaiconsulting-design/dru-clear-app", icon: "💻" },
];

const PENDING_ITEMS = [
  "Update SD/ED card bullet copy",
  "Fix subtitle wording on Diagnose screen",
  "Change Strategic button color to magenta",
  "Correct session time to 90-min (Strategic) / 120-min (Executive)",
  "Fix 404 transformation link → druaiconsulting.com/appointment",
  "Add your real affiliate links to /affiliate page",
  "Populate Resource Hub with first PDF downloads",
];

export default function Admin() {
  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/admin" />

      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 720, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Admin Access Only</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.25rem" }}>Command Center</h1>
          <p style={{ color: "rgba(230,230,230,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem" }}>DRU AI Consulting · DeAnna R. Upshaw</p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem", marginBottom: "2rem" }}>
          {STAT_CARDS.map((stat) => (
            <div key={stat.label} style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(212,175,55,0.15)",
              borderRadius: 10,
              padding: "1.1rem 1rem",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "1.1rem" }}>{stat.icon}</span>
                <p style={{ fontFamily: "'Playfair Display', serif", color: stat.color, fontWeight: 700, fontSize: "1.4rem" }}>{stat.value}</p>
              </div>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.04em", marginBottom: "0.2rem" }}>{stat.label}</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.35)", fontSize: "0.65rem" }}>{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>Quick Links</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
            {QUICK_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(212,175,55,0.15)",
                  borderRadius: 8,
                  padding: "0.75rem 1rem",
                  textDecoration: "none",
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(212,175,55,0.4)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(212,175,55,0.15)"; }}
              >
                <span style={{ fontSize: "1rem" }}>{link.icon}</span>
                <span style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.8)", fontWeight: 600, fontSize: "0.72rem", letterSpacing: "0.04em" }}>{link.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Pending items */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 10, padding: "1.25rem 1.5rem", marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>Pending Refinements</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {PENDING_ITEMS.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
                <div style={{ width: 16, height: 16, border: "1.5px solid rgba(212,175,55,0.4)", borderRadius: 3, flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.7)", fontSize: "0.78rem", lineHeight: 1.5 }}>{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sprint status */}
        <div style={{ background: "rgba(194,24,91,0.06)", border: "1px solid rgba(194,24,91,0.2)", borderRadius: 10, padding: "1.25rem 1.5rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.75rem" }}>Sprint Status</p>
          {[
            { sprint: "Sprint 1 — Assessment + GHL", status: "✅ Live", color: "#43A047" },
            { sprint: "Sprint 2 — Portal, Frameworks, Resources, ROI, Admin", status: "🔄 In Progress", color: "#D4AF37" },
            { sprint: "Sprint 3 — ROI + Affiliate + Daily AI content", status: "⏳ Next", color: "rgba(255,255,255,0.3)" },
            { sprint: "Sprint 4 — Mini Courses + Community", status: "⏳ Planned", color: "rgba(255,255,255,0.3)" },
          ].map((s) => (
            <div key={s.sprint} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.7)", fontSize: "0.78rem" }}>{s.sprint}</p>
              <span style={{ fontFamily: "'Montserrat', sans-serif", color: s.color, fontSize: "0.7rem", fontWeight: 700, flexShrink: 0, marginLeft: "1rem" }}>{s.status}</span>
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
