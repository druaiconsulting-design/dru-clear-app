import NavBar from "../components/NavBar";

const LOGO_CDN = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512997684/NJTJspnSktvZQJaw.png";

interface FrameworkThankYouProps {
  badgeLabel: string;
  badgeColor: string;
  badgeBg: string;
  frameworkName: string;
  tagline: string;
  sessionCount: number;
  price: string;
}

function FrameworkThankYouPage({
  badgeLabel,
  badgeColor,
  badgeBg,
  frameworkName,
  tagline,
  sessionCount,
  price,
}: FrameworkThankYouProps) {
  const nextSteps = [
    "DeAnna will reach out within 24 hours to schedule your intake session",
    "You'll receive a confirmation email with your Zoom link once scheduled",
    "Review your scorecard results before your first session",
    "Come prepared with your top priorities — we'll build from there",
    `Your ${sessionCount} sessions will be scheduled to fit your pace and calendar`,
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/frameworks" />

      <main style={{ flex: 1, padding: "2.5rem 1.5rem 3rem", maxWidth: 520, margin: "0 auto", width: "100%" }}>

        {/* Logo */}
        <div style={{ marginBottom: "1.75rem" }}>
          <img src={LOGO_CDN} alt="DRU CLEAR™" style={{ height: 120, width: "auto", objectFit: "contain" }} />
        </div>

        {/* Gold checkmark */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", border: "2px solid #D4AF37", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(212,175,55,0.08)", boxShadow: "0 0 0 6px rgba(212,175,55,0.06)" }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 16L13 23L26 9" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Framework badge */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
          <span style={{ background: badgeBg, color: badgeColor, fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", padding: "3px 16px", borderRadius: 20, textTransform: "uppercase", border: `1px solid ${badgeColor}50` }}>
            {badgeLabel}
          </span>
        </div>

        {/* Title */}
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.75rem", fontWeight: 700, color: "#D4AF37", marginBottom: "0.5rem", lineHeight: 1.2, textAlign: "center" }}>
          Thank You. Payment Confirmed.
        </h1>

        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "1rem", color: "#FFFFFF", textAlign: "center", marginBottom: "0.75rem", fontWeight: 500 }}>
          {frameworkName}
        </p>

        <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.65rem", letterSpacing: "0.08em", textAlign: "center", marginBottom: "1.75rem" }}>
          {tagline}
        </p>

        <div style={{ height: "0.5px", background: "rgba(212,175,55,0.25)", marginBottom: "1.75rem" }} />

        {/* DeAnna's Personal Commitment — on top */}
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
            {nextSteps.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                <span style={{ background: i === 0 ? "#C2185B" : "#D4AF37", color: "#FFFFFF", fontSize: "0.58rem", fontWeight: 700, width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                <span style={{ fontFamily: "'Inter', sans-serif", color: i === 0 ? "#FFFFFF" : "rgba(230,230,230,0.85)", fontSize: "0.8rem", lineHeight: 1.6, fontWeight: i === 0 ? 600 : 400 }}>{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Investment summary */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Your Investment</p>
            <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "0.9rem", fontWeight: 600, margin: 0 }}>{frameworkName}</p>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.62rem", marginTop: 2 }}>{sessionCount} sessions · 90 min · Virtual</p>
          </div>
          <p style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>{price}</p>
        </div>

        {/* Warm closing */}
        <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.55)", fontSize: "0.78rem", lineHeight: 1.7, textAlign: "center", fontStyle: "italic", marginBottom: "1.75rem" }}>
          We look forward to partnering with you and adding value.
        </p>

        <div style={{ height: "0.5px", background: "rgba(212,175,55,0.1)", marginBottom: "1.5rem" }} />

        {/* Support */}
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

// ─── Four Individual Exports ──────────────────────────────────────────────────

export function ThankYouDruClear() {
  return (
    <FrameworkThankYouPage
      badgeLabel="Flagship · The Connector"
      badgeColor="#D4AF37"
      badgeBg="rgba(212,175,55,0.12)"
      frameworkName="DRU CLEAR™"
      tagline="Align for AI Execution · Connects all 4 frameworks"
      sessionCount={3}
      price="$7,500"
    />
  );
}

export function ThankYou5D() {
  return (
    <FrameworkThankYouPage
      badgeLabel="Leadership"
      badgeColor="#1E88E5"
      badgeBg="rgba(30,136,229,0.1)"
      frameworkName="5D Leadership™"
      tagline="Transformational Leadership Across Five Critical Dimensions"
      sessionCount={3}
      price="$6,500"
    />
  );
}

export function ThankYou5C() {
  return (
    <FrameworkThankYouPage
      badgeLabel="Culture"
      badgeColor="#C2185B"
      badgeBg="rgba(194,24,91,0.1)"
      frameworkName="5C Cultural DNA™"
      tagline="Communication · Connection · Collaboration · Coaching · Culture Transformation"
      sessionCount={3}
      price="$6,000"
    />
  );
}

export function ThankYouAISales() {
  return (
    <FrameworkThankYouPage
      badgeLabel="Sales"
      badgeColor="#C2185B"
      badgeBg="rgba(194,24,91,0.1)"
      frameworkName="AI Sales Mastery™"
      tagline="DISC Behavioral Insights + AI for Revenue Acceleration"
      sessionCount={3}
      price="$6,000"
    />
  );
}
