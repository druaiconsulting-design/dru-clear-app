import { DruLogo } from "./Utility";
import type { LeadData } from "../types";

// ── Payment ───────────────────────────────────────────────────────────────────

export function Payment({ tier, price, paymentUrl, onBack }: {
  tier: "strategic" | "executive"; price: string; paymentUrl: string; onBack: () => void;
}) {
  const isExecutive = tier === "executive";
  return (
    <div className="screen-enter flex flex-col" style={{ minHeight: "100dvh", background: "#0A2342", padding: "2rem 1.5rem 3rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(212,175,55,0.7)", fontSize: "0.78rem", cursor: "pointer", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, textAlign: "left", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>← Back to Options</button>
      <DruLogo height={120} className="mb-4" />
      <div style={{ background: "rgba(255,255,255,0.04)", border: `1.5px solid ${isExecutive ? "#D4AF37" : "rgba(212,175,55,0.3)"}`, borderRadius: 8, padding: "1rem", marginBottom: "1.25rem" }}>
        {isExecutive && <div style={{ background: "#C2185B", color: "#FFFFFF", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", padding: "3px 10px", borderRadius: 20, fontFamily: "'Montserrat', sans-serif", display: "inline-block", marginBottom: "0.5rem" }}>BEST VALUE</div>}
        <p style={{ color: "#FFFFFF", fontWeight: 700, fontSize: "0.95rem", fontFamily: "'Montserrat', sans-serif", marginBottom: "0.25rem" }}>{isExecutive ? "Executive Diagnostic + 90-Day AI Roadmap" : "Strategic Diagnostic"}</p>
        <p style={{ color: "#D4AF37", fontSize: "1.5rem", fontWeight: 700, fontFamily: "'Playfair Display', serif", marginBottom: "0.75rem" }}>{price}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {(isExecutive
            ? ["Full executive diagnostic (25–35 Qs)","Full ecosystem review","Executive AI Alignment Report","Custom 90-Day AI Roadmap","90-min executive briefing"]
            : ["Expanded diagnostic (20–25 Qs)","Strategic Insight Report","Top 5 priority gaps","90-min strategy session"]
          ).map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "#D4AF37", fontSize: "0.7rem", flexShrink: 0 }}>✓</span>
              <span style={{ color: "rgba(230,230,230,0.8)", fontSize: "0.72rem" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
      <p style={{ color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.75rem", fontFamily: "'Montserrat', sans-serif" }}>Complete Your Payment</p>
      <iframe src={paymentUrl} style={{ width: "100%", minHeight: 600, border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8, background: "#FFFFFF", marginBottom: "1rem" }} title="Secure Payment" allow="payment" />
      <p style={{ color: "rgba(230,230,230,0.4)", fontSize: "0.65rem", textAlign: "center", lineHeight: 1.5 }}>🔒 Secure payment powered by Stripe. Your information is encrypted and protected.</p>
    </div>
  );
}

// ── ThankYouPurchase ──────────────────────────────────────────────────────────

export function ThankYouPurchase({ lead, tier, calendarUrl, onContinue }: {
  lead: LeadData; tier: "strategic" | "executive"; calendarUrl: string; onContinue: () => void;
}) {
  const isExecutive = tier === "executive";
  const nextSteps = isExecutive ? [
    "Book your session using the calendar below",
    "You'll receive a confirmation email with your Zoom link",
    "Review your scorecard results before the call",
    "You'll receive a brief pre-session questionnaire to maximize on our time together",
    "Receive your custom 90-Day AI Roadmap within 48 hours after your session",
  ] : [
    "Book your session using the calendar below",
    "You'll receive a confirmation email with your Zoom link",
    "Review your scorecard results before the call",
    "You'll receive a brief pre-session questionnaire to maximize on our time together",
    "Receive your Strategic Insight Report within 48 hours after your session",
  ];
  return (
    <div className="screen-enter flex flex-col" style={{ minHeight: "100dvh", background: "#0A2342", padding: "2rem 1.5rem 3rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <div style={{ marginBottom: "1.75rem" }}><DruLogo height={120} /></div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.25rem" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", border: "2px solid #D4AF37", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(212,175,55,0.08)", boxShadow: "0 0 0 4px rgba(212,175,55,0.08)" }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M6 16L13 23L26 9" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 700, color: "#D4AF37", marginBottom: "0.75rem", lineHeight: 1.2, textAlign: "center" }}>Thank You, Payment Confirmed</h2>
      <p style={{ color: "#E6E6E6", fontSize: "0.82rem", lineHeight: 1.7, maxWidth: 340, margin: "0 auto 1.5rem", textAlign: "center" }}>
        {isExecutive ? "You are one step closer towards your vision. Book your 120-minute executive briefing below and we'll begin to design your future." : "You are one step closer towards your vision. Book your 90-minute strategy session below and we'll begin to design your future."}
      </p>
      <div className="gold-divider" style={{ marginBottom: "1.25rem" }} />
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.18)", borderRadius: 8, padding: "1rem", marginBottom: "1.25rem" }}>
        <p style={{ color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.75rem", fontFamily: "'Montserrat', sans-serif" }}>What Happens Next</p>
        {nextSteps.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem", marginBottom: "0.6rem" }}>
            <span style={{ background: "#D4AF37", color: "#0A2342", fontSize: "0.55rem", fontWeight: 700, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
            <span style={{ color: "rgba(230,230,230,0.85)", fontSize: "0.75rem", lineHeight: 1.55 }}>{item}</span>
          </div>
        ))}
      </div>
      <p style={{ color: "rgba(230,230,230,0.6)", fontSize: "0.75rem", lineHeight: 1.65, textAlign: "center", fontStyle: "italic", marginBottom: "1.5rem" }}>We look forward to partnering with you and adding value.</p>
      <div className="gold-divider" style={{ marginBottom: "1.25rem" }} />
      <p style={{ color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.75rem", fontFamily: "'Montserrat', sans-serif" }}>Book Your Session</p>
      <iframe src={calendarUrl} style={{ width: "100%", minHeight: 580, border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8, background: "#FFFFFF", marginBottom: "0.75rem" }} title="Book Your Session" />
      <p style={{ color: "rgba(230,230,230,0.4)", fontSize: "0.65rem", marginBottom: "1.5rem", lineHeight: 1.5, textAlign: "center" }}>
        Having trouble? <a href={calendarUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#D4AF37", textDecoration: "underline" }}>Open booking page</a>
      </p>
      <button onClick={onContinue} style={{ background: "transparent", border: "none", color: "rgba(212,175,55,0.7)", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.75rem", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", marginBottom: "1.5rem", display: "block", margin: "0 auto 1.5rem" }}>
        Continue to Share Your Results →
      </button>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "rgba(230,230,230,0.4)", fontSize: "0.65rem" }}>Questions? <a href="mailto:support@replies.druaiconsulting.com" style={{ color: "#D4AF37" }}>support@replies.druaiconsulting.com</a></p>
      </div>
    </div>
  );
}
