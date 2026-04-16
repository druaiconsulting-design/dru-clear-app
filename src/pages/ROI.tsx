import { useState } from "react";
import NavBar from "../components/NavBar";

const CALENDAR_URL = "https://link.druaiconsulting.com/widget/bookings/dru-clear-ai-readiness-consultation";
const WEBHOOK_LEAD_URL = "https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/21253f6d-4eea-4781-8b9b-8ab28cb3b046";

export default function ROI() {
  const [teamSize, setTeamSize] = useState(10);
  const [avgSalary, setAvgSalary] = useState(75000);
  const [manualHours, setManualHours] = useState(10);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ROI calculation
  const hourlyRate = avgSalary / 2080;
  const weeklyWaste = teamSize * manualHours * hourlyRate;
  const annualWaste = weeklyWaste * 52;
  const aiSavings = annualWaste * 0.65; // 65% recovery estimate
  const fiveYearValue = aiSavings * 5;

  const fmt = (n: number) => "$" + Math.round(n).toLocaleString();

  const handleCapture = async () => {
    if (!email || !firstName) return;
    setSubmitting(true);
    try {
      const params = new URLSearchParams({
        event_type: "roi_calculator_lead",
        tags: "ROI-Calculator-Lead",
        first_name: firstName,
        email,
        team_size: String(teamSize),
        avg_salary: String(avgSalary),
        manual_hours: String(manualHours),
        annual_waste: String(Math.round(annualWaste)),
        ai_savings: String(Math.round(aiSavings)),
        timestamp: new Date().toISOString(),
      });
      await fetch(`${WEBHOOK_LEAD_URL}?${params.toString()}`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: "" });
    } catch {}
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/roi" />

      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 680, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Business Case Builder</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.75rem" }}>AI ROI Calculator</h1>
          <p style={{ color: "rgba(230,230,230,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.88rem", lineHeight: 1.7 }}>
            Discover how much time and money your organization could recover by leading with AI. Adjust the inputs below to see your numbers.
          </p>
        </div>

        {/* Inputs */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.18)", borderRadius: 12, padding: "1.5rem", marginBottom: "1.5rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1.25rem" }}>Your Organization</p>

          {[
            { label: "Team size (people)", value: teamSize, setter: setTeamSize, min: 1, max: 500, step: 1, display: `${teamSize} people` },
            { label: "Average annual salary per person", value: avgSalary, setter: setAvgSalary, min: 30000, max: 300000, step: 5000, display: `$${avgSalary.toLocaleString()}` },
            { label: "Hours per week spent on manual/repetitive tasks", value: manualHours, setter: setManualHours, min: 1, max: 40, step: 1, display: `${manualHours} hrs/week` },
          ].map((input) => (
            <div key={input.label} style={{ marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <label style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.8)", fontSize: "0.8rem" }}>{input.label}</label>
                <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontWeight: 700, fontSize: "0.82rem" }}>{input.display}</span>
              </div>
              <input
                type="range"
                min={input.min}
                max={input.max}
                step={input.step}
                value={input.value}
                onChange={(e) => input.setter(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#C2185B" }}
              />
            </div>
          ))}
        </div>

        {/* Results */}
        <div style={{ background: "linear-gradient(135deg, rgba(194,24,91,0.12) 0%, rgba(212,175,55,0.07) 100%)", border: "1px solid rgba(194,24,91,0.25)", borderRadius: 12, padding: "1.5rem", marginBottom: "1.5rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1.25rem" }}>Your Numbers</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            {[
              { label: "Annual cost of manual work", value: fmt(annualWaste), sub: "Hours × salary × team", color: "rgba(230,80,80,0.8)" },
              { label: "Estimated AI savings / year", value: fmt(aiSavings), sub: "65% recovery rate", color: "#43A047" },
              { label: "5-year value of AI adoption", value: fmt(fiveYearValue), sub: "Compounded impact", color: "#D4AF37" },
              { label: "ROI on a $3,497 diagnostic", value: `${Math.round(aiSavings / 3497)}×`, sub: "First-year return", color: "#C2185B" },
            ].map((stat) => (
              <div key={stat.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "1rem 0.875rem" }}>
                <p style={{ fontFamily: "'Playfair Display', serif", color: stat.color, fontWeight: 700, fontSize: "1.4rem", marginBottom: "0.2rem" }}>{stat.value}</p>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.68rem", letterSpacing: "0.04em", marginBottom: "0.2rem" }}>{stat.label}</p>
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.4)", fontSize: "0.65rem" }}>{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Lead capture */}
        {!submitted ? (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 12, padding: "1.5rem", marginBottom: "1.5rem" }}>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Get Your Full Report</p>
            <p style={{ color: "rgba(230,230,230,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", lineHeight: 1.65, marginBottom: "1rem" }}>
              Enter your info to receive a personalized AI ROI breakdown with strategic recommendations for your organization.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <input type="text" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 6, padding: "0.65rem 0.875rem", color: "#FFFFFF", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", outline: "none" }} />
              <input type="email" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 6, padding: "0.65rem 0.875rem", color: "#FFFFFF", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", outline: "none" }} />
              <button onClick={handleCapture} disabled={submitting || !email || !firstName} style={{ background: "#C2185B", color: "#FFFFFF", border: "none", borderRadius: 6, padding: "0.75rem 1rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em", cursor: email && firstName ? "pointer" : "not-allowed", opacity: email && firstName ? 1 : 0.5 }}>
                {submitting ? "Sending..." : "Send My ROI Report →"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background: "rgba(67,160,71,0.08)", border: "1px solid rgba(67,160,71,0.3)", borderRadius: 12, padding: "1.5rem", marginBottom: "1.5rem", textAlign: "center" }}>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#43A047", fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.5rem" }}>✓ Your ROI report is on the way!</p>
            <p style={{ color: "rgba(230,230,230,0.6)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem" }}>Check your inbox. Ready to turn these numbers into a real strategy?</p>
          </div>
        )}

        {/* Book CTA */}
        <a href={CALENDAR_URL} target="_blank" rel="noopener noreferrer" style={{
          display: "block",
          background: "#C2185B",
          color: "#FFFFFF",
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 700,
          fontSize: "0.85rem",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textDecoration: "none",
          textAlign: "center",
          padding: "1rem 1.5rem",
          borderRadius: 8,
        }}>
          Book a Strategy Session — Turn This Into a Plan →
        </a>

      </main>

      <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
