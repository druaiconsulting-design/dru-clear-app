import NavBar from "../components/NavBar";

const LOGO_CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/dru-clear-logo-transparent_fdbc9d32.png";

const NEXT_STEPS = [
  "DeAnna will personally contact you within 24 hours to arrange your 45-minute intake session",
  "You'll receive a confirmation email with your Zoom link once scheduled",
  "Review your scorecard results — they become the foundation of your 3-month roadmap",
  "Come prepared with your top organizational priorities and vision",
  "Your transformation officially begins at your intake session",
];

const FRAMEWORKS = [
  { name: "DRU CLEAR™", role: "Flagship Anchor · Connects all 4 frameworks", color: "#D4AF37" },
  { name: "5D Leadership™", role: "5 Dimensions of transformational leadership", color: "#1E88E5" },
  { name: "5C Cultural DNA™", role: "Culture transformation from the inside out", color: "#C2185B" },
  { name: "AI Sales Mastery™", role: "DISC + AI revenue acceleration", color: "#C2185B" },
];

export default function ThankYouFullEcosystem() {
  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/frameworks" />

      <main style={{ flex: 1, padding: "2.5rem 1.5rem 3rem", maxWidth: 520, margin: "0 auto", width: "100%" }}>

        {/* Logo */}
        <div style={{ marginBottom: "1.75rem" }}>
          <img src={LOGO_CDN} alt="DRU CLEAR™" style={{ height: 48, width: "auto", objectFit: "contain" }} />
        </div>

        {/* Gold checkmark */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", border: "2px solid #D4AF37", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(212,175,55,0.08)", boxShadow: "0 0 0 8px rgba(212,175,55,0.05), 0 0 0 14px rgba(212,175,55,0.03)" }}>
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
              <path d="M6 16L13 23L26 9" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Badge */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
          <span style={{ background: "#C2185B", color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", padding: "3px 16px", borderRadius: 20, textTransform: "uppercase" }}>
            Full Ecosystem — All 4 · Best Value
          </span>
        </div>

        {/* Title */}
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.85rem", fontWeight: 700, color: "#D4AF37", marginBottom: "0.5rem", lineHeight: 1.2, textAlign: "center" }}>
          Thank You. Payment Confirmed.
        </h1>

        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "1rem", color: "#FFFFFF", textAlign: "center", marginBottom: "0.5rem", fontWeight: 500 }}>
          The Full DRU AI Leadership Ecosystem™
        </p>

        <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.65rem", letterSpacing: "0.08em", textAlign: "center", marginBottom: "1.75rem" }}>
          3 months · 4 sessions/month · 90 min · 12 sessions total
        </p>

        <div style={{ height: "0.5px", background: "rgba(212,175,55,0.25)", marginBottom: "1.75rem" }} />

        {/* Signing payment note */}
        <div style={{ background: "rgba(212,175,55,0.07)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.75rem", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#D4AF37" />
            </svg>
          </div>
          <div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>Payment Confirmation</p>
            <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.85)", fontSize: "0.78rem", lineHeight: 1.7, margin: 0 }}>
              Today's payment of <strong style={{ color: "#D4AF37" }}>$13,000</strong> is your signing investment. Your final investment of <strong style={{ color: "#D4AF37" }}>$13,000</strong> will be due upon completion of your 3-month transformation.
            </p>
          </div>
        </div>

        {/* DeAnna's Personal Commitment */}
        <div style={{ background: "rgba(194,24,91,0.08)", border: "1px solid rgba(194,24,91,0.3)", borderRadius: 10, padding: "1.1rem 1.25rem", marginBottom: "1.75rem", display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(194,24,91,0.15)", border: "1px solid rgba(194,24,91,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#C2185B" strokeWidth="1.75" />
              <path d="M12 7v5.5l3 3" stroke="#C2185B" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>DeAnna's Personal Commitment</p>
            <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.85)", fontSize: "0.8rem", lineHeight: 1.7, margin: 0 }}>
              You have made a significant commitment to your transformation. DeAnna will personally contact you within 24 hours to arrange your 45-minute intake session and commence designing your future pathway.
            </p>
          </div>
        </div>

        {/* What Happens Next */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.18)", borderRadius: 10, padding: "1.25rem 1.5rem", marginBottom: "1.75rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: "1rem" }}>
            What Happens Next
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {NEXT_STEPS.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                <span style={{ background: i === 0 ? "#C2185B" : "#D4AF37", color: "#FFFFFF", fontSize: "0.58rem", fontWeight: 700, width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                <span style={{ fontFamily: "'Inter', sans-serif", color: i === 0 ? "#FFFFFF" : "rgba(230,230,230,0.85)", fontSize: "0.8rem", lineHeight: 1.6, fontWeight: i === 0 ? 600 : 400 }}>{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 3-Month Journey */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 10, padding: "1.25rem 1.5rem", marginBottom: "1.75rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: "1rem" }}>
            Your 3-Month Transformation Journey
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
            {[
              { month: "Month 1", focus: "Foundation — DRU CLEAR™ activation and ecosystem alignment" },
              { month: "Month 2", focus: "Depth — Deep dive into your two highest-priority frameworks" },
              { month: "Month 3", focus: "Integration — Full ecosystem activation and domination strategy" },
            ].map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
                <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.06em", whiteSpace: "nowrap", marginTop: 1, minWidth: 60 }}>{m.month}</span>
                <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.75)", fontSize: "0.78rem", lineHeight: 1.6 }}>{m.focus}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid rgba(212,175,55,0.12)", paddingTop: "0.875rem" }}>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.6rem" }}>
              All 4 Frameworks Included
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {FRAMEWORKS.map((fw) => (
                <div key={fw.name} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: fw.color, flexShrink: 0, marginTop: 5 }} />
                  <div>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontSize: "0.75rem", fontWeight: 700 }}>{fw.name}</span>
                    <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.72rem" }}> · {fw.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Investment summary */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
            <div>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Total Investment</p>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "0.9rem", fontWeight: 600, margin: 0 }}>Full Ecosystem — All 4</p>
            </div>
            <p style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>$26,000</p>
          </div>
          <div style={{ borderTop: "1px solid rgba(212,175,55,0.12)", paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {[
              { label: "Sessions", value: "12 total · 4/month · 90 min each" },
              { label: "Duration", value: "3 months · Virtual via Zoom" },
              { label: "Signing Payment", value: "$13,000 — paid today" },
              { label: "Final Payment", value: "$13,000 — due at completion" },
            ].map((row, i) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "0.5px solid rgba(212,175,55,0.08)", paddingTop: "0.35rem" }}>
                <span style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.62rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>{row.label}</span>
                <span style={{ fontFamily: "'Inter', sans-serif", color: i >= 2 ? "#D4AF37" : "rgba(230,230,230,0.75)", fontSize: "0.72rem", fontWeight: i >= 2 ? 600 : 400 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Warm closing */}
        <p style={{ fontFamily: "'Playfair Display', serif", color: "rgba(230,230,230,0.65)", fontSize: "0.88rem", lineHeight: 1.75, textAlign: "center", fontStyle: "italic", marginBottom: "1.75rem" }}>
          This is not just an investment in frameworks —<br />it is an investment in the future of your organization.
        </p>

        <div style={{ height: "0.5px", background: "rgba(212,175,55,0.1)", marginBottom: "1.5rem" }} />

        <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.4)", fontSize: "0.68rem", textAlign: "center", lineHeight: 1.6 }}>
          Questions?{" "}
          <a href="mailto:support@druaiconsulting.com" style={{ color: "#D4AF37", textDecoration: "underline" }}>
            support@druaiconsulting.com
          </a>
        </p>

      </main>

      <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
