/**
 * DRU CLEAR™ AI Readiness Assessment
 * screens/Welcome.tsx
 */

import { DruLogo, HEADSHOT_CDN } from "../types";

export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div
      className="screen-enter flex flex-col"
      style={{
        minHeight: "100dvh", background: "#0A2342",
        padding: "2.5rem 1.5rem 2rem", maxWidth: 480, margin: "0 auto", width: "100%",
      }}
    >
      <div className="flex flex-col items-center mb-6">
        <DruLogo height={120} className="mb-4" />
        <div
          style={{
            width: 120, height: 120, borderRadius: "50%",
            border: "2.5px solid #D4AF37",
            boxShadow: "0 0 0 4px rgba(212,175,55,0.15), 0 4px 20px rgba(0,0,0,0.4)",
            overflow: "hidden", marginBottom: "1.25rem", flexShrink: 0,
          }}
        >
          <img
            src={HEADSHOT_CDN}
            alt="DeAnna R. Upshaw"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }}
          />
        </div>
        <h1
          className="text-3xl font-bold text-center mb-1"
          style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37" }}
        >
          DeAnna R. Upshaw
        </h1>
        <p className="text-lg font-medium text-center mb-1" style={{ color: "#FFFFFF" }}>AI Authority</p>
        <p className="text-sm text-center" style={{ color: "#E6E6E6" }}>CEO DRU AI Consulting</p>
      </div>

      <div className="gold-divider mb-6" />

      <p
        className="text-center text-sm mb-6 italic"
        style={{ color: "#E6E6E6", fontFamily: "'Playfair Display', serif" }}
      >
        Your Trusted Strategist &amp; Partner
      </p>

      <p className="text-sm leading-relaxed mb-8" style={{ color: "#E6E6E6" }}>
        How ready is your organization for the AI era? Take the free{" "}
        <strong style={{ color: "#D4AF37" }}>DRU CLEAR™ AI Readiness Assessment</strong> and find
        out in 3 minutes.
      </p>

      <button className="btn-gold" onClick={onStart}>
        Start Your Assessment →
      </button>
    </div>
  );
}
