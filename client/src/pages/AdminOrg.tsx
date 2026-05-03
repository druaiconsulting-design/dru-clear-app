import { useState } from "react";
import { Link } from "react-router-dom";
import NavBar from "../components/NavBar";

function avatar(seed: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&radius=50&size=48`;
}

const DIVISIONS = [
  {
    name: "Revenue & Growth",
    tag: "Internal",
    border: "rgba(212,175,55,0.35)",
    headerBg: "#0A2342",
    agents: [
      { name: "Serena Jackson",  role: "Business Coach" },
      { name: "Mateo Gonzalez",  role: "Sales Support" },
      { name: "Zara Ahmed",      role: "Product Launch" },
      { name: "Jaylen Brooks",   role: "Email Marketing" },
      { name: "Chloe Dubois",    role: "Copy Writer" },
      { name: "Omar Patel",      role: "Lead Scoring" },
      { name: "Aaliyah Foster",  role: "Personalized Outreach" },
      { name: "Ryan Nakamura",   role: "CRM / GHL" },
      { name: "Elena Vasquez",   role: "Product Knowledge" },
      { name: "Kwame Asante",    role: "Proposal Writer" },
    ],
  },
  {
    name: "Marketing",
    tag: "Internal",
    border: "rgba(212,175,55,0.35)",
    headerBg: "#0A2342",
    agents: [
      { name: "Nia Robinson",  role: "Content Creation" },
      { name: "Luca Romano",   role: "Digital Marketing" },
      { name: "Hyun-Ji Kim",   role: "Analytics & ROI" },
      { name: "Andre Mitchell",role: "SEO / SEM" },
    ],
  },
  {
    name: "Content & Brand",
    tag: "Internal",
    border: "rgba(212,175,55,0.35)",
    headerBg: "#0A2342",
    agents: [
      { name: "Camila Flores",  role: "Social Media" },
      { name: "Darius King",    role: "Viral Scripter" },
      { name: "Ingrid Larsen",  role: "Press Release" },
      { name: "Ravi Gupta",     role: "Graphic Designer" },
      { name: "Yara Mansour",   role: "Translator" },
    ],
  },
  {
    name: "Client Delivery",
    tag: "Client-Facing",
    border: "rgba(194,24,91,0.35)",
    headerBg: "#C2185B",
    agents: [
      { name: "Keisha Thompson", role: "Onboarding Coach" },
      { name: "Marco Silva",     role: "Community Manager" },
      { name: "Leila Nasser",    role: "Feedback Coach" },
      { name: "Jordan Hayes",    role: "Creative Director ★" },
      { name: "Simone Laurent",  role: "Course Architect" },
      { name: "Theo Nguyen",     role: "Presentation Designer" },
      { name: "Amelia Santos",   role: "Training Video" },
    ],
  },
  {
    name: "Customer Support",
    tag: "Client-Facing",
    border: "rgba(194,24,91,0.35)",
    headerBg: "#C2185B",
    agents: [
      { name: "Isaiah Carter",     role: "Issue Resolution" },
      { name: "Priscilla Okonkwo", role: "Multi-Channel Comms" },
    ],
  },
  {
    name: "C-Suite / Operations",
    tag: "Internal",
    border: "rgba(212,175,55,0.35)",
    headerBg: "#0A2342",
    agents: [
      { name: "Priya Sharma",    role: "Executive Assistant" },
      { name: "Isabella Moreno", role: "Director of Compliance ★" },
      { name: "Marcus Chen",     role: "Tax Strategist" },
    ],
  },
  {
    name: "Legal & Finance",
    tag: "Internal",
    border: "rgba(212,175,55,0.35)",
    headerBg: "#0A2342",
    agents: [
      { name: "Amara Okafor", role: "Legal Team" },
      { name: "Diego Reyes",  role: "Expense Manager" },
      { name: "Yuki Tanaka",  role: "Financial Reporting" },
    ],
  },
  {
    name: "AI Governance",
    tag: "Internal",
    border: "rgba(212,175,55,0.3)",
    headerBg: "#112D4A",
    agents: [
      { name: "Khalid Hassan",  role: "Disclaimer Writer" },
      { name: "Sofia Petrov",   role: "Privacy Policy" },
      { name: "James Osei",     role: "Contract Writer" },
      { name: "Mei Lin",        role: "Brand Protection" },
      { name: "Rafael Torres",  role: "Continuous Learning" },
    ],
  },
  {
    name: "HR Division",
    tag: "Internal → Both",
    border: "rgba(212,175,55,0.35)",
    headerBg: "#0A2342",
    agents: [
      { name: "Naomi Williams",    role: "Recruiting" },
      { name: "Aiden Park",        role: "Internal Onboarding" },
      { name: "Fatima Al-Rashid",  role: "Internal Helpdesk" },
    ],
  },
];

const connector = (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, margin: "4px 0" }}>
    <div style={{ width: 2, height: 16, background: "rgba(212,175,55,0.4)" }} />
    <div style={{ color: "rgba(212,175,55,0.6)", fontSize: "0.8rem", lineHeight: 1 }}>↓</div>
  </div>
);

export default function AdminOrg() {
  const [imgError, setImgError] = useState(false);

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/admin-org" />
      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 960, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Admin · Page 2</p>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.25rem" }}>AI Empire Org Chart</h1>
            <p style={{ color: "rgba(230,230,230,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem" }}>39 agents · 10 divisions · 1 empire</p>
          </div>
          <Link to="/admin" style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#D4AF37", textDecoration: "none", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 8, padding: "0.6rem 1.25rem", letterSpacing: "0.06em" }}>
            ← Back to Command Center
          </Link>
        </div>

        {/* Hierarchy */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "2.5rem" }}>

          {/* DeAnna */}
          <div style={{ background: "#C2185B", border: "2px solid #C2185B", borderRadius: 14, padding: "1rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 200 }}>
            {!imgError ? (
              <img src="/deanna-avatar.jpg" alt="DeAnna R. Upshaw" onError={() => setImgError(true)}
                style={{ width: 72, height: 72, borderRadius: "50%", border: "3px solid #D4AF37", objectFit: "cover" }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: "50%", border: "3px solid #D4AF37", background: "linear-gradient(135deg,#0A2342,#1a3a5c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem" }}>👑</div>
            )}
            <div>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>DeAnna R. Upshaw</p>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.8)", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "2px 0 0" }}>CEO & Founder · AI Authority</p>
            </div>
          </div>

          {connector}

          {/* AI Twin */}
          <div style={{ background: "#071A2E", border: "2px solid #D4AF37", borderRadius: 14, padding: "1rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 220 }}>
            <img src={avatar("DeAnna AI Twin Master Orchestrator")} alt="AI Twin"
              style={{ width: 64, height: 64, borderRadius: "50%", border: "2px solid #D4AF37" }} />
            <div>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>✦ DeAnna's AI Twin</p>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.6)", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "2px 0 0" }}>Master Orchestrator</p>
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
              {["DeAnna's Voice", "Persistent Memory", "Routes All Agents"].map(b => (
                <span key={b} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.55rem", fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.35)", color: "#D4AF37" }}>{b}</span>
              ))}
            </div>
          </div>

          {connector}

          {/* Travis */}
          <div style={{ background: "rgba(10,35,66,0.8)", border: "1px solid rgba(212,175,55,0.4)", borderRadius: 12, padding: "0.875rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 200 }}>
            <img src={avatar("Travis Chief of Staff Operations")} alt="Travis"
              style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid rgba(212,175,55,0.5)" }} />
            <div>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 2px" }}>Operations Layer</p>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>Travis — Chief of Staff</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.6rem", margin: "2px 0 0" }}>Routes all 37 agents across 9 divisions</p>
            </div>
          </div>

          {connector}

          {/* Divisions Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem", width: "100%", marginTop: 4 }}>
            {DIVISIONS.map(div => (
              <div key={div.name} style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${div.border}`, background: "rgba(255,255,255,0.02)" }}>
                <div style={{ background: div.headerBg, padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontSize: "0.75rem", fontWeight: 700 }}>{div.name}</span>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.58rem", fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "rgba(255,255,255,0.15)", color: "#FFFFFF" }}>{div.tag}</span>
                </div>
                <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {div.agents.map(agent => (
                    <div key={agent.name} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 7, padding: "6px 10px" }}>
                      <img src={avatar(agent.name)} alt={agent.name}
                        style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(212,175,55,0.3)", flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontSize: "0.72rem", fontWeight: 600, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{agent.name}</p>
                        <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.6rem", margin: 0 }}>{agent.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Footer note */}
        <div style={{ textAlign: "center", padding: "1rem", background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8, marginBottom: "1.5rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", color: "rgba(212,175,55,0.7)", margin: 0, letterSpacing: "0.04em" }}>
            ★ Isabella Moreno auto-blocks trademark violations · Classes 35 · 41 · 42 · All agents operate in Genius Mode by default
          </p>
        </div>

        <div style={{ textAlign: "center" }}>
          <Link to="/admin" style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#D4AF37", textDecoration: "none", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 8, padding: "0.75rem 2rem", letterSpacing: "0.06em" }}>
            ← Back to Command Center
          </Link>
        </div>

      </main>
      <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
