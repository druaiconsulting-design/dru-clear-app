import NavBar from "../components/NavBar";

export default function Portal() {
  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/portal" />

      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 680, margin: "0 auto", width: "100%" }}>

        {/* Welcome header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Your AI Transformation Hub</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.75rem" }}>Welcome Back</h1>
          <p style={{ color: "rgba(230,230,230,0.7)", fontFamily: "'Inter', sans-serif", fontSize: "0.9rem", lineHeight: 1.7 }}>
            Everything you need to accelerate your AI leadership journey — in one place.
          </p>
        </div>

        {/* Quick actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
          {[
            { icon: "📋", label: "My Assessment", sub: "View your results", href: "/" },
            { icon: "📅", label: "Book a Session", sub: "Schedule time with DeAnna", href: "https://link.druaiconsulting.com/widget/bookings/dru-clear-ai-readiness-consultation" },
            { icon: "📚", label: "Resources", sub: "Guides & downloads", href: "/resources" },
            { icon: "⚡", label: "Daily Connection", sub: "Today's insight", href: "/daily" },
          ].map((item) => (
            <a key={item.label} href={item.href} style={{ textDecoration: "none" }}>
              <div style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(212,175,55,0.2)",
                borderRadius: 10,
                padding: "1.25rem 1rem",
                cursor: "pointer",
                transition: "border-color 0.2s, background 0.2s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(212,175,55,0.5)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(212,175,55,0.06)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(212,175,55,0.2)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
              >
                <div style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>{item.icon}</div>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.04em", marginBottom: "0.2rem" }}>{item.label}</p>
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.72rem" }}>{item.sub}</p>
              </div>
            </a>
          ))}
        </div>

        {/* Transformation pathway */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 10, padding: "1.5rem", marginBottom: "1.5rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>Your Transformation Pathway</p>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", overflowX: "auto", paddingBottom: "0.5rem" }}>
            {["Discover", "Diagnose", "Design", "Deploy", "Dominate"].map((stage, i) => (
              <div key={stage} style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                <div style={{
                  background: i === 0 ? "#C2185B" : i === 1 ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${i === 0 ? "#C2185B" : i === 1 ? "rgba(212,175,55,0.4)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 6,
                  padding: "0.4rem 0.75rem",
                  textAlign: "center",
                }}>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: i === 0 ? "#FFFFFF" : i === 1 ? "#D4AF37" : "rgba(255,255,255,0.35)", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.06em" }}>{stage}</p>
                </div>
                {i < 4 && <span style={{ color: "rgba(212,175,55,0.4)", fontSize: "0.8rem" }}>→</span>}
              </div>
            ))}
          </div>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.7rem", marginTop: "0.75rem", fontStyle: "italic" }}>You are in the Discover stage. Your diagnostic unlocks the next step.</p>
        </div>

        {/* Explore frameworks CTA */}
        <a href="/frameworks" style={{ textDecoration: "none", display: "block" }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(194,24,91,0.15) 0%, rgba(212,175,55,0.08) 100%)",
            border: "1px solid rgba(194,24,91,0.3)",
            borderRadius: 10,
            padding: "1.25rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.04em", marginBottom: "0.25rem" }}>Explore the DRU AI Ecosystem™</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.6)", fontSize: "0.75rem" }}>4 flagship frameworks designed to transform your leadership</p>
            </div>
            <span style={{ color: "#C2185B", fontSize: "1.2rem" }}>→</span>
          </div>
        </a>

      </main>

      <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
