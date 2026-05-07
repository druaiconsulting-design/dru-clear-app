import NavBar from "../components/NavBar";

const TERMS = [
  { title: "Services", body: "All diagnostic, framework, and ecosystem engagements are delivered virtually via Zoom unless otherwise agreed in writing. Session scheduling begins upon receipt of full or initial payment." },
  { title: "Payment", body: "Full payment is required before services commence, except for the Full Ecosystem engagement which requires 50% at signing and 50% at completion. All prices are in USD." },
  { title: "Non-Refundable Policy", body: "All payments are non-refundable. By completing your purchase you acknowledge that you have reviewed the service description, understand the scope of your selected engagement, and are committing to your transformation pathway. No refunds will be issued for any reason including unused sessions, scheduling conflicts, or change of mind." },
  { title: "Rescheduling", body: "Sessions may be rescheduled with a minimum of 48 hours notice. Sessions cancelled with less than 48 hours notice are forfeited." },
  { title: "Intellectual Property", body: "All frameworks, materials, and methodologies — including DRU CLEAR™, 5C Cultural DNA™, 5D Leadership™, and AI Sales Mastery™ — are the proprietary intellectual property of DRU AI Consulting. Materials shared during engagements are for client use only and may not be reproduced or redistributed." },
  { title: "Agreement", body: "Completing payment constitutes your agreement to these terms." },
];

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 620, margin: "0 auto", width: "100%" }}>

        {/* Brand logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <img
            src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663512997684/PPrwKSVlySJjkhTX.png"
            alt="DRU CLEAR™"
            style={{ height: 120, width: "auto", display: "inline-block" }}
          />
        </div>

        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.62rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>DRU AI Consulting</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.25, marginBottom: "0.75rem" }}>Terms of Engagement</h1>
          <div style={{ height: "0.5px", background: "rgba(212,175,55,0.25)", marginBottom: "0.75rem" }} />
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", color: "rgba(230,230,230,0.5)", lineHeight: 1.6 }}>
            Last updated: April 2026 · Effective for all engagements with DRU AI Consulting (DBA of Dimensional Solns, LLC)
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          {TERMS.map((section) => (
            <div key={section.title} style={{ borderLeft: "2px solid rgba(212,175,55,0.3)", paddingLeft: "1.25rem" }}>
              <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#D4AF37", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{section.title}</p>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", color: "rgba(230,230,230,0.75)", lineHeight: 1.8 }}>{section.body}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "2.5rem", padding: "1.25rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 10 }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 700, color: "#D4AF37", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Questions?</p>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", color: "rgba(230,230,230,0.6)", lineHeight: 1.7, marginBottom: 6 }}>
            Contact DRU AI Consulting prior to completing your purchase with any questions regarding these terms.
          </p>
          <a href="mailto:support@druaiconsulting.com" style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.75rem", fontWeight: 700, color: "#D4AF37", letterSpacing: "0.04em", textDecoration: "none" }}>
            support@druaiconsulting.com
          </a>
        </div>

      </main>

      <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
