import { useState } from "react";
import NavBar from "../components/NavBar";

function photo(gender: "men" | "women", num: number) {
  return `https://randomuser.me/api/portraits/${gender}/${num}.jpg`;
}

// NOTE: Swap these URLs with custom headshots when available
// Raymond Holloway: Black male, 40–55, bald, close-cut beard
// Travis Weston: Black male, early 20s
const RAYMOND_PHOTO = photo("men", 83); // bald with close-cut beard — original Travis photo
const TRAVIS_PHOTO  = photo("men", 16);

const DIVISIONS = [
  {
    name: "C-Suite / Operations", tag: "Internal",
    border: "rgba(212,175,55,0.4)", headerBg: "#0A2342",
    agents: [
      { name: "Priya Sharma",    role: "Executive Assistant",      src: photo("women", 44) },
      { name: "Isabella Moreno", role: "Director of Compliance ★", src: photo("women", 26) },
      { name: "Marcus Chen",     role: "Tax Strategist",           src: photo("men",   65) },
    ],
  },
  {
    name: "Legal & Finance", tag: "Internal",
    border: "rgba(212,175,55,0.4)", headerBg: "#0A2342",
    agents: [
      { name: "Amara Okafor", role: "Legal Team",          src: photo("women", 31) },
      { name: "Diego Reyes",  role: "Expense Manager",     src: photo("men",    5) },
      { name: "Yuki Tanaka",  role: "Financial Reporting", src: photo("women", 48) },
    ],
  },
  {
    name: "AI Governance", tag: "Internal",
    border: "rgba(212,175,55,0.35)", headerBg: "#112D4A",
    agents: [
      { name: "Khalid Hassan",  role: "Disclaimer Writer",   src: photo("men",   55) },
      { name: "Sofia Petrov",   role: "Privacy Policy",      src: photo("women",  5) },
      { name: "James Osei",     role: "Contract Writer",     src: photo("men",   42) },
      { name: "Mei Lin",        role: "Brand Protection",    src: photo("women", 49) },
      { name: "Rafael Torres",  role: "Continuous Learning", src: photo("men",    7) },
    ],
  },
  {
    name: "HR Division", tag: "Internal → Both",
    border: "rgba(212,175,55,0.4)", headerBg: "#0A2342",
    agents: [
      { name: "Naomi Williams",   role: "Recruiting",          src: photo("women", 36) },
      { name: "Aiden Park",       role: "Internal Onboarding", src: photo("men",   63) },
      { name: "Fatima Al-Rashid", role: "Internal Helpdesk",   src: photo("women", 56) },
    ],
  },
  {
    name: "Revenue & Growth + Sales", tag: "Internal", fullWidth: true,
    border: "rgba(212,175,55,0.4)", headerBg: "#0A2342",
    agents: [
      { name: "Serena Jackson",  role: "Business Coach",        src: photo("women", 32) },
      { name: "Mateo Gonzalez",  role: "Sales Support",         src: photo("men",    6) },
      { name: "Zara Ahmed",      role: "Product Launch",        src: photo("women", 43) },
      { name: "Jaylen Brooks",   role: "Email Marketing",       src: photo("men",   38) },
      { name: "Chloe Dubois",    role: "Copy Writer",           src: photo("women",  2) },
      { name: "Omar Patel",      role: "Lead Scoring",          src: photo("men",   71) },
      { name: "Aaliyah Foster",  role: "Personalized Outreach", src: photo("women", 33) },
      { name: "Ryan Nakamura",   role: "CRM Management (GHL)",  src: photo("men",   60) },
      { name: "Elena Vasquez",   role: "Product Knowledge",     src: photo("women", 41) },
      { name: "Kwame Asante",    role: "Proposal Writer",       src: photo("men",   46) },
    ],
  },
  {
    name: "Marketing", tag: "Internal",
    border: "rgba(212,175,55,0.4)", headerBg: "#0A2342",
    agents: [
      { name: "Nia Robinson",   role: "Content Creation",  src: photo("women", 35) },
      { name: "Luca Romano",    role: "Digital Marketing", src: photo("men",   18) },
      { name: "Hyun-Ji Kim",    role: "Analytics & ROI",   src: photo("women", 50) },
      { name: "Andre Mitchell", role: "SEO / SEM",         src: photo("men",   40) },
    ],
  },
  {
    name: "Content & Brand", tag: "Internal",
    border: "rgba(212,175,55,0.4)", headerBg: "#0A2342",
    agents: [
      { name: "Camila Flores",  role: "Social Media Strategist",   src: photo("women", 25) },
      { name: "Darius King",    role: "Viral Scripter",            src: photo("men",   43) },
      { name: "Ingrid Larsen",  role: "Press Release",             src: photo("women",  8) },
      { name: "Ravi Gupta",     role: "Graphic Designer",          src: photo("men",   69) },
      { name: "Yara Mansour",   role: "Translator / Localization", src: photo("women", 57) },
    ],
  },
  {
    name: "Client Delivery", tag: "Client-Facing", fullWidth: true,
    border: "rgba(194,24,91,0.4)", headerBg: "#C2185B",
    agents: [
      { name: "Keisha Thompson", role: "Onboarding Coach",        src: photo("women", 34) },
      { name: "Marco Silva",     role: "Community Manager",       src: photo("men",   10) },
      { name: "Leila Nasser",    role: "Feedback Coach",          src: photo("women", 37) },
      { name: "Jordan Hayes",    role: "Creative Director ★",     src: photo("men",   80) },
      { name: "Simone Laurent",  role: "Course Architect",        src: photo("women", 10) },
      { name: "Theo Nguyen",     role: "Presentation Designer",   src: photo("men",   59) },
      { name: "Amelia Santos",   role: "Training Video Producer", src: photo("women", 40) },
    ],
  },
  {
    name: "Customer Support", tag: "Client-Facing", fullWidth: true,
    border: "rgba(194,24,91,0.4)", headerBg: "#C2185B",
    agents: [
      { name: "Isaiah Carter",     role: "Issue Resolution",            src: photo("men",   45) },
      { name: "Priscilla Okonkwo", role: "Multi-Channel Communication", src: photo("women", 29) },
    ],
  },
];

export default function AdminOrg() {
  const [deAnnaErr, setDeAnnaErr]     = useState(false);
  const [raymondErr, setRaymondErr]   = useState(false);
  const [travisErr,  setTravisErr]    = useState(false);

  const circleStyle = (size: number, border = "#D4AF37"): React.CSSProperties => ({
    width: size, height: size, borderRadius: "50%",
    border: `2px solid ${border}`,
    objectFit: "cover" as const,
    flexShrink: 0,
    background: "rgba(10,35,66,0.5)",
  });

  const fallback = (label: string, size: number, bg = "#0A2342"): React.CSSProperties => ({
    ...circleStyle(size),
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.35, background: bg,
  });

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/admin-org" />

      <main style={{ flex: 1, padding: "2rem 1.5rem", maxWidth: 1100, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "1rem" }}>
          <div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "0.4rem" }}>Admin · Page 2 · Confidential</p>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.2rem" }}>DRU AI Consulting — AI Empire Org Chart</h1>
            <p style={{ color: "rgba(230,230,230,0.5)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem" }}>39 agents · 10 divisions · DeAnna → AI Twin → Raymond → Travis → 37 agents · All agents operate in Genius Mode</p>
          </div>
          <div onClick={() => window.location.href = "/admin"}
            style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#D4AF37", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 8, padding: "0.6rem 1.25rem", letterSpacing: "0.06em", cursor: "pointer" }}>
            ← Command Center
          </div>
        </div>

        {/* Hierarchy */}
        <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", marginBottom: "1.5rem", gap: 6 }}>

          {/* DeAnna */}
          <div style={{ background: "#C2185B", borderRadius: 12, padding: "0.75rem 2rem", display: "flex", alignItems: "center", gap: 12, minWidth: 270 }}>
            {!deAnnaErr ? (
              <img src="/deanna-avatar.jpg" alt="DeAnna R. Upshaw" onError={() => setDeAnnaErr(true)} style={circleStyle(56)} />
            ) : (
              <div style={fallback("👑", 56, "#0A2342")}>👑</div>
            )}
            <div>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>DeAnna R. Upshaw</p>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.85)", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "2px 0 0" }}>CEO & Founder · AI Authority</p>
            </div>
          </div>

          <div style={{ width: 2, height: 14, background: "rgba(212,175,55,0.5)" }} />

          {/* AI Twin */}
          <div style={{ background: "#071A2E", border: "2px solid #D4AF37", borderRadius: 12, padding: "0.75rem 2rem", display: "flex", alignItems: "center", gap: 12, minWidth: 300 }}>
            <img src="/deanna-professional.png" alt="DeAnna's AI Twin" style={circleStyle(52)} />
            <div>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>✦ DeAnna's AI Twin</p>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.6)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "2px 0 0" }}>Master Orchestrator · DeAnna's Voice</p>
              <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" as const }}>
                {["DeAnna's Voice", "Persistent Memory", "Routes All Agents"].map(b => (
                  <span key={b} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.52rem", fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.3)", color: "#D4AF37" }}>{b}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ width: 2, height: 14, background: "rgba(212,175,55,0.5)" }} />

          {/* Raymond Holloway — Chief of Staff */}
          <div style={{ background: "rgba(10,35,66,0.95)", border: "2px solid rgba(212,175,55,0.7)", borderRadius: 12, padding: "0.75rem 2rem", display: "flex", alignItems: "center", gap: 12, minWidth: 300 }}>
            {!raymondErr ? (
              <img src={RAYMOND_PHOTO} alt="Raymond Holloway"
                onError={() => setRaymondErr(true)}
                style={{ ...circleStyle(54), border: "2px solid #D4AF37" }} />
            ) : (
              <div style={fallback("RH", 54)}>RH</div>
            )}
            <div>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 1px" }}>Chief of Staff</p>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>Raymond Holloway</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.58rem", margin: "1px 0 0" }}>Oversees all operations · 9 divisions · 37 agents</p>
              <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" as const }}>
                {["Strategic Oversight", "Final Authority", "Operations Command"].map(b => (
                  <span key={b} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.5rem", fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.25)", color: "#D4AF37" }}>{b}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ width: 2, height: 14, background: "rgba(212,175,55,0.5)" }} />

          {/* Travis Weston — Assistant Chief of Staff */}
          <div style={{ background: "rgba(10,35,66,0.75)", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 10, padding: "0.65rem 2rem", display: "flex", alignItems: "center", gap: 12, minWidth: 270 }}>
            {!travisErr ? (
              <img src={TRAVIS_PHOTO} alt="Travis Weston"
                onError={() => setTravisErr(true)}
                style={{ ...circleStyle(48), border: "1px solid rgba(212,175,55,0.5)" }} />
            ) : (
              <div style={fallback("TW", 48)}>TW</div>
            )}
            <div>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 1px" }}>Assistant Chief of Staff</p>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "0.85rem", fontWeight: 700, margin: 0 }}>Travis Weston</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.58rem", margin: "1px 0 0" }}>Assistant to Raymond Holloway · 9 divisions · 37 agents</p>
            </div>
          </div>

          <div style={{ width: 2, height: 14, background: "rgba(212,175,55,0.5)" }} />
        </div>

        {/* Division grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
          {DIVISIONS.map(div => (
            <div key={div.name}
              style={{ gridColumn: (div as any).fullWidth ? "1 / -1" : "auto", borderRadius: 10, overflow: "hidden", border: `1px solid ${div.border}`, background: "rgba(255,255,255,0.02)" }}>
              <div style={{ background: div.headerBg, padding: "7px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontSize: "0.75rem", fontWeight: 700 }}>{div.name}</span>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.56rem", fontWeight: 700, padding: "1px 7px", borderRadius: 10, background: "rgba(255,255,255,0.15)", color: "#FFFFFF" }}>{div.tag}</span>
              </div>
              <div style={{ padding: "8px 10px", display: "flex", flexWrap: "wrap" as const, gap: 5 }}>
                {div.agents.map(agent => (
                  <div key={agent.name}
                    style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "5px 9px", flex: (div as any).fullWidth ? "1 1 160px" : "1 1 100%" }}>
                    <img src={agent.src} alt={agent.name}
                      style={{ width: 54, height: 54, borderRadius: "50%", border: "1px solid rgba(212,175,55,0.35)", objectFit: "cover" as const, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontSize: "0.7rem", fontWeight: 700, margin: 0, lineHeight: 1.2, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{agent.name}</p>
                      <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.58rem", margin: 0, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{agent.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: "1rem", textAlign: "center" as const, padding: "0.75rem", background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8 }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", color: "rgba(212,175,75,0.7)", margin: 0 }}>
            ★ Isabella Moreno auto-blocks all outputs violating Trademark Classes 35 · 41 · 42 · All agents operate in Genius Mode · Confidential · DRU AI Consulting © 2026
          </p>
        </div>

      </main>

      <footer style={{ textAlign: "center" as const, padding: "0.75rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
