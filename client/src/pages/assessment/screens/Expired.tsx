/**
 * DRU CLEAR™ AI Readiness Assessment
 * screens/Expired.tsx
 */

import { DruLogo } from "../types";

export function ExpiredScreen({ onRetake }: { onRetake: () => void }) {
  return (
    <div
      className="screen-enter flex flex-col items-center justify-center"
      style={{ minHeight: "100dvh", background: "#0A2342", padding: "2.5rem 1.5rem", textAlign: "center" }}
    >
      <div style={{ width: 72, height: 72, borderRadius: "50%", border: "2px solid rgba(212,175,55,0.4)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem", background: "rgba(212,175,55,0.06)" }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="11" stroke="#D4AF37" strokeWidth="2" strokeOpacity="0.6" />
          <path d="M16 9v8l4 4" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.8" />
        </svg>
      </div>

      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.75rem", fontWeight: 700, color: "#D4AF37", marginBottom: "1rem", lineHeight: 1.2 }}>
        Your Results Have Expired
      </h2>
      <p style={{ color: "#E6E6E6", fontSize: "0.85rem", lineHeight: 1.7, maxWidth: 320, marginBottom: "0.75rem" }}>
        Your AI Readiness score is only valid for 48 hours to ensure accuracy and relevance.
      </p>
      <p style={{ color: "rgba(230,230,230,0.6)", fontSize: "0.78rem", lineHeight: 1.6, maxWidth: 300, marginBottom: "2rem", fontStyle: "italic" }}>
        To get your most accurate and current results, take the assessment again — it only takes 3 minutes.
      </p>

      <button className="btn-gold" onClick={onRetake} style={{ maxWidth: 320 }}>
        Retake My Assessment →
      </button>

      <div style={{ marginTop: "2rem" }}>
        <DruLogo height={120} />
      </div>
    </div>
  );
}
