import { useState, useRef } from "react";
import { DruLogo } from "./Utility";
import { getTier } from "../utils";
import type { LeadData, Scores } from "../types";

export default function Diagnose({ lead, scores, onSelectStrategic, onSelectExecutive, onSkipToTransformation }: {
  lead: LeadData; scores: Scores;
  onSelectStrategic: () => void; onSelectExecutive: () => void; onSkipToTransformation: () => void;
}) {
  const total       = Object.values(scores).reduce((a, b) => a + b, 0);
  const tier        = getTier(total);
  const scaledScore = Math.round((total / 75) * 100);
  const [selected, setSelected] = useState<"strategic" | "executive" | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={topRef} className="screen-enter flex flex-col" style={{ minHeight: "100dvh", background: "#0A2342", padding: "2rem 1.5rem 3rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <DruLogo height={120} className="mb-4" />
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 700, color: "#D4AF37", marginBottom: "0.5rem", lineHeight: 1.2 }}>Your Results Are In.</h2>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", color: "#FFFFFF", marginBottom: "0.75rem" }}>Now It's Time to Turn Insight Into Action.</p>
        <p style={{ color: "rgba(230,230,230,0.75)", fontSize: "0.78rem", lineHeight: 1.65, maxWidth: 360, margin: "0 auto" }}>Your scorecard revealed important signals across leadership, alignment, execution, and AI readiness. The next step is to go deeper, identify what is slowing progress, and build the right path forward.</p>
      </div>
      <div className="gold-divider" style={{ marginBottom: "1.25rem" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", marginBottom: "1.25rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.18)", borderRadius: 8, padding: "0.75rem 1rem" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "rgba(230,230,230,0.5)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Your Score</p>
          <p style={{ color: "#D4AF37", fontSize: "1.5rem", fontWeight: 700, fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>{scaledScore}<span style={{ fontSize: "0.9rem", color: "rgba(212,175,55,0.5)" }}>/100</span></p>
        </div>
        <div style={{ width: 1, height: 40, background: "rgba(212,175,55,0.2)" }} />
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "rgba(230,230,230,0.5)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Tier</p>
          <p style={{ color: tier.color, fontSize: "0.9rem", fontWeight: 700, letterSpacing: "0.08em" }}>{tier.label}</p>
        </div>
      </div>
      <div style={{ marginBottom: "1.25rem" }}>
        <p style={{ color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.5rem", fontFamily: "'Montserrat', sans-serif" }}>What Your Score Really Means</p>
        <p style={{ color: "rgba(230,230,230,0.75)", fontSize: "0.78rem", lineHeight: 1.65 }}>This free scorecard is designed to reveal patterns, not solve them. True transformation requires a deeper look at your leadership alignment, decision readiness, team execution, and business opportunities.</p>
        <p style={{ color: "rgba(230,230,230,0.55)", fontSize: "0.72rem", lineHeight: 1.6, marginTop: "0.5rem", fontStyle: "italic" }}>Without a deeper diagnostic, most organizations stay aware of the gaps but never address the root causes behind them.</p>
      </div>
      <div className="gold-divider" style={{ marginBottom: "1.25rem" }} />
      <p style={{ color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.35rem", fontFamily: "'Montserrat', sans-serif" }}>Choose Your Next Step</p>
      <p style={{ color: "rgba(230,230,230,0.6)", fontSize: "0.75rem", lineHeight: 1.6, marginBottom: "1rem" }}>Both options help you move beyond general insight into strategic clarity.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.25rem" }}>
        {/* Executive */}
        <div onClick={() => setSelected("executive")} style={{ background: selected === "executive" ? "rgba(212,175,55,0.08)" : "rgba(255,255,255,0.04)", border: `2px solid ${selected === "executive" ? "#D4AF37" : "rgba(212,175,55,0.3)"}`, borderRadius: 10, padding: "1.25rem", cursor: "pointer", position: "relative", transition: "all 0.2s" }}>
          <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#C2185B", color: "#FFFFFF", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", padding: "3px 14px", borderRadius: 20, fontFamily: "'Montserrat', sans-serif", whiteSpace: "nowrap" }}>BEST VALUE</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem", marginTop: "0.25rem" }}>
            <p style={{ color: "#FFFFFF", fontWeight: 700, fontSize: "0.9rem", fontFamily: "'Montserrat', sans-serif" }}>Executive Diagnostic</p>
            <p style={{ color: "#D4AF37", fontSize: "1.4rem", fontWeight: 700, fontFamily: "'Playfair Display', serif" }}>$4,997</p>
          </div>
          <p style={{ color: "rgba(230,230,230,0.75)", fontSize: "0.72rem", lineHeight: 1.65, marginBottom: "0.75rem" }}>A premium executive-level diagnostic designed for leaders prepared to implement clarity, complemented by a 90-day AI Roadmap, facilitated with DRU AI Transformation Pathway™ to progression.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "0.75rem" }}>
            {["Full executive diagnostic (25–35 additional deeper-level Qs)","Review of The DRU AI Leadership Ecosystem™ Four Frameworks","Executive AI Alignment Report (boardroom-ready)","Comprehensive gap analysis, including risk assessment","120-min Zoom executive briefing","Executive-level recommendations + sequencing"].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ color: "#D4AF37", fontSize: "0.7rem", marginTop: 1, flexShrink: 0 }}>✓</span>
                <span style={{ color: "#E6E6E6", fontSize: "0.7rem", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
          <button className="btn-magenta" onClick={(e) => { e.stopPropagation(); onSelectExecutive(); }} style={{ fontSize: "0.82rem" }}>Choose Executive Diagnostic →</button>
        </div>
        {/* Strategic */}
        <div onClick={() => setSelected("strategic")} style={{ background: selected === "strategic" ? "rgba(212,175,55,0.06)" : "rgba(255,255,255,0.03)", border: `1.5px solid ${selected === "strategic" ? "rgba(212,175,55,0.6)" : "rgba(212,175,55,0.2)"}`, borderRadius: 10, padding: "1.25rem", cursor: "pointer", transition: "all 0.2s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
            <p style={{ color: "#FFFFFF", fontWeight: 700, fontSize: "0.9rem", fontFamily: "'Montserrat', sans-serif" }}>Strategic Diagnostic</p>
            <p style={{ color: "#D4AF37", fontSize: "1.4rem", fontWeight: 700, fontFamily: "'Playfair Display', serif" }}>$3,497</p>
          </div>
          <p style={{ color: "rgba(230,230,230,0.7)", fontSize: "0.72rem", lineHeight: 1.65, marginBottom: "0.75rem" }}>Strategic clarity, leadership, and AI choices. A thorough diagnostic designed to help leaders identify the fundamental gaps that affect alignment and execution.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "0.75rem" }}>
            {["Expanded diagnostic (20–25 additional deeper-level Qs)","Review of The DRU AI Leadership Ecosystem™ Two Frameworks","Strategic AI Insight Report","Top five gaps and priority ranking","90-min Zoom strategy session","Priority findings and strategic direction"].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ color: "rgba(212,175,55,0.7)", fontSize: "0.7rem", marginTop: 1, flexShrink: 0 }}>✓</span>
                <span style={{ color: "rgba(230,230,230,0.8)", fontSize: "0.7rem", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
          <button className="btn-magenta" onClick={(e) => { e.stopPropagation(); onSelectStrategic(); }} style={{ fontSize: "0.82rem" }}>Choose Strategic Diagnostic →</button>
        </div>
      </div>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 8, padding: "0.875rem", marginBottom: "1.25rem" }}>
        <p style={{ color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.4rem", fontFamily: "'Montserrat', sans-serif" }}>Why Upgrade From the Free Scorecard?</p>
        <p style={{ color: "rgba(230,230,230,0.7)", fontSize: "0.72rem", lineHeight: 1.65 }}>The free scorecard highlights <em>what</em> may be happening. The diagnostic identifies <em>why</em> it is happening, what it is costing you, and what to do next.</p>
      </div>
      <div style={{ textAlign: "center", marginBottom: "1rem" }}>
        <button onClick={onSkipToTransformation} style={{ background: "none", border: "none", color: "rgba(212,175,55,0.65)", fontSize: "0.75rem", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>→ Not ready yet? Continue to Share Your Results</button>
      </div>
    </div>
  );
}
