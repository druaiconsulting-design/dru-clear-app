/**
 * DRU CLEAR™ AI Readiness Assessment
 * screens/Payment.tsx
 */

import { DruLogo } from "../types";

export function PaymentScreen({
  tier, price, paymentUrl, onBack,
}: {
  tier: "strategic" | "executive";
  price: string;
  paymentUrl: string;
  onBack: () => void;
}) {
  const isExecutive = tier === "executive";

  const executiveItems = [
    "Full executive diagnostic (25–35 Qs)",
    "Full ecosystem review",
    "Executive AI Alignment Report",
    "Custom 90-Day AI Roadmap",
    "90-min executive briefing",
  ];
  const strategicItems = [
    "Expanded diagnostic (20–25 Qs)",
    "Strategic Insight Report",
    "Top 5 priority gaps",
    "90-min strategy session",
  ];

  return (
    <div
      className="screen-enter flex flex-col"
      style={{ minHeight: "100dvh", background: "#0A2342", padding: "2rem 1.5rem 3rem", maxWidth: 480, margin: "0 auto", width: "100%" }}
    >
      <button
        onClick={onBack}
        style={{ background: "none", border: "none", color: "rgba(212,175,55,0.7)", fontSize: "0.78rem", cursor: "pointer", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, textAlign: "left", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.35rem" }}
      >
        ← Back to Options
      </button>

      <DruLogo height={120} className="mb-4" />

      {/* Summary Card */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: `1.5px solid ${isExecutive ? "#D4AF37" : "rgba(212,175,55,0.3)"}`, borderRadius: 8, padding: "1rem", marginBottom: "1.25rem" }}>
        {isExecutive && (
          <div style={{ background: "#C2185B", color: "#FFFFFF", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", padding: "3px 10px", borderRadius: 20, fontFamily: "'Montserrat', sans-serif", display: "inline-block", marginBottom: "0.5rem" }}>BEST VALUE</div>
        )}
        <p style={{ color: "#FFFFFF", fontWeight: 700, fontSize: "0.95rem", fontFamily: "'Montserrat', sans-serif", marginBottom: "0.25rem" }}>
          {isExecutive ? "Executive Diagnostic + 90-Day AI Roadmap" : "Strategic Diagnostic"}
        </p>
        <p style={{ color: "#D4AF37", fontSize: "1.5rem", fontWeight: 700, fontFamily: "'Playfair Display', serif", marginBottom: "0.75rem" }}>{price}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {(isExecutive ? executiveItems : strategicItems).map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "#D4AF37", fontSize: "0.7rem", flexShrink: 0 }}>✓</span>
              <span style={{ color: "rgba(230,230,230,0.8)", fontSize: "0.72rem" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <p style={{ color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.75rem", fontFamily: "'Montserrat', sans-serif" }}>
        Complete Your Payment
      </p>

      <iframe
        src={paymentUrl}
        style={{ width: "100%", minHeight: 600, border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8, background: "#FFFFFF", marginBottom: "1rem" }}
        title="Secure Payment"
        allow="payment"
      />

      <p style={{ color: "rgba(230,230,230,0.4)", fontSize: "0.65rem", textAlign: "center", lineHeight: 1.5 }}>
        🔒 Secure payment powered by Stripe. Your information is encrypted and protected.
      </p>
    </div>
  );
}
