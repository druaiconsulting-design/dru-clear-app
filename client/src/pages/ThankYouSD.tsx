import NavBar from "../components/NavBar";

const CALENDAR_STRATEGIC_URL = "https://link.druaiconsulting.com/widget/bookings/dru-clear-ai-readiness-consultation?embed=1";
const LOGO_CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/dru-clear-logo-transparent_fdbc9d32.png";

const NEXT_STEPS = [
  "Book your 90-min strategy session using the calendar below",
  "You'll receive a confirmation email with your Zoom link",
  "Review your scorecard results before the call",
  "You'll receive a brief pre-session questionnaire to maximize our time together",
  "Receive your Strategic AI Insight Report within 48 hours after your session",
];

export default function ThankYouSD() {
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
          <div style={{ width: 72, height: 72, borderRadius: "50%", border: "2px solid #D4AF37", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(212,175,55,0.08)", boxShadow: "0 0 0 6px rgba(212,175,55,0.06)" }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 16L13 23L26 9" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Badge */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
          <span style={{ background: "rgba(212,175,55,0.15)", color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", padding: "3px 16px", borderRadius: 20, textTransform: "uppercase", border: "1px solid rgba(212,175,55,0.35)" }}>
            Strategic Diagnostic
          </span>
        </div>

        {/* Title */}
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.75rem", fontWeight: 700, color: "#D4AF37", marginBottom: "0.875rem", lineHeight: 1.2, textAlign: "center" }}>
          Thank You. Payment Confirmed.
        </h1>

        {/* Warm message */}
        <p style={{ fontFamily: "'Inter', sans-serif", color: "#E6E6E6", fontSize: "0.85rem", lineHeight: 1.75, maxWidth: 400, margin: "0 auto 1.75rem", textAlign: "center" }}>
          You are one step closer towards your vision. Book your 90-minute strategy session below and we'll begin to design your future.
        </p>

        <div style={{ height: "0.5px", background: "rgba(212,175,55,0.25)", marginBottom: "1.75rem" }} />

        {/* What Happens Next */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.18)", borderRadius: 10, padding: "1.25rem 1.5rem", marginBottom: "1.75rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: "1rem" }}>
            What Happens Next
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {NEXT_STEPS.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                <span style={{ background: "#D4AF37", color: "#0A2342", fontSize: "0.58rem", fontWeight: 700, width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.85)", fontSize: "0.8rem", lineHeight: 1.6 }}>{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Warm closing */}
        <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.55)", fontSize: "0.78rem", lineHeight: 1.7, textAlign: "center", fontStyle: "italic", marginBottom: "1.75rem" }}>
          We look forward to partnering with you and adding value.
        </p>

        <div style={{ height: "0.5px", background: "rgba(212,175,55,0.25)", marginBottom: "1.75rem" }} />

        {/* Calendar */}
        <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: "1rem" }}>
          Book Your 90-Min Strategy Session
        </p>

        <iframe
          src={CALENDAR_STRATEGIC_URL}
          title="Book Your Strategic Diagnostic Session"
          style={{ width: "100%", minHeight: 600, border: "1px solid rgba(212,175,55,0.2)", borderRadius: 10, background: "#FFFFFF", marginBottom: "0.75rem", display: "block" }}
        />

        <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.4)", fontSize: "0.65rem", textAlign: "center", marginBottom: "2rem", lineHeight: 1.6 }}>
          Having trouble?{" "}
          <button
            onClick={() => { window.location.href = CALENDAR_STRATEGIC_URL; }}
            style={{ background: "none", border: "none", color: "#D4AF37", textDecoration: "underline", cursor: "pointer", fontSize: "0.65rem", fontFamily: "'Inter', sans-serif", padding: 0 }}
          >
            Open booking page
          </button>
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
