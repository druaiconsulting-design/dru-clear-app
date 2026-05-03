import { useState } from "react";
import { Link } from "wouter";
import NavBar from "../components/NavBar";

// Professional illustrated portrait — micah style (clean, modern, not cartoon)
// Skin tone mapped to agent ethnicity from bio
function avatar(seed: string, skin: string = "f9c9b6") {
  return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(seed)}&backgroundColor=transparent&baseColor=${skin}`;
}

// Skin tone constants
const S = {
  dark:        "6b3226",   // Black/African American
  medDark:     "9c5f2d",   // Dark Brown
  medium:      "c67d4e",   // Medium Brown - South Asian, some Latina/o, Middle Eastern
  medLight:    "dba575",   // Medium Light - some Latino/a, Persian, lighter Middle Eastern
  asian:       "f2d6cb",   // East Asian
  light:       "f9c9b6",   // White/European
  olive:       "c8a97e",   // Olive - Mediterranean, some Latino/a
};

const DIVISIONS = [
  {
    name: "C-Suite / Operations", tag: "Internal",
    border: "rgba(212,175,55,0.4)", headerBg: "#0A2342",
    agents: [
      { name: "Priya Sharma",    role: "Executive Assistant",      skin: S.medium   },
      { name: "Isabella Moreno", role: "Director of Compliance ★", skin: S.medLight },
      { name: "Marcus Chen",     role: "Tax Strategist",           skin: S.asian    },
    ],
  },
  {
    name: "Legal & Finance", tag: "Internal",
    border: "rgba(212,175,55,0.4)", headerBg: "#0A2342",
    agents: [
      { name: "Amara Okafor", role: "Legal Team",           skin: S.dark    },
      { name: "Diego Reyes",  role: "Expense Manager",      skin: S.medLight},
      { name: "Yuki Tanaka",  role: "Financial Reporting",  skin: S.asian   },
    ],
  },
  {
    name: "AI Governance", tag: "Internal",
    border: "rgba(212,175,55,0.35)", headerBg: "#112D4A",
    agents: [
      { name: "Khalid Hassan",  role: "Disclaimer Writer",       skin: S.medium   },
      { name: "Sofia Petrov",   role: "Privacy Policy",          skin: S.light    },
      { name: "James Osei",     role: "Contract Writer",         skin: S.dark     },
      { name: "Mei Lin",        role: "Brand Protection",        skin: S.asian    },
      { name: "Rafael Torres",  role: "Continuous Learning",     skin: S.medLight },
    ],
  },
  {
    name: "HR Division", tag: "Internal → Both",
    border: "rgba(212,175,55,0.4)", headerBg: "#0A2342",
    agents: [
      { name: "Naomi Williams",   role: "Recruiting",          skin: S.dark    },
      { name: "Aiden Park",       role: "Internal Onboarding", skin: S.asian   },
      { name: "Fatima Al-Rashid", role: "Internal Helpdesk",   skin: S.medium  },
    ],
  },
  {
    name: "Revenue & Growth + Sales", tag: "Internal", fullWidth: true,
    border: "rgba(212,175,55,0.4)", headerBg: "#0A2342",
    agents: [
      { name: "Serena Jackson",  role: "Business Coach",         skin: S.dark     },
      { name: "Mateo Gonzalez",  role: "Sales Support",          skin: S.medLight },
      { name: "Zara Ahmed",      role: "Product Launch",         skin: S.medium   },
      { name: "Jaylen Brooks",   role: "Email Marketing",        skin: S.dark     },
      { name: "Chloe Dubois",    role: "Copy Writer",            skin: S.light    },
      { name: "Omar Patel",      role: "Lead Scoring",           skin: S.medium   },
      { name: "Aaliyah Foster",  role: "Personalized Outreach",  skin: S.dark     },
      { name: "Ryan Nakamura",   role: "CRM Management (GHL)",   skin: S.asian    },
      { name: "Elena Vasquez",   role: "Product Knowledge",      skin: S.medLight },
      { name: "Kwame Asante",    role: "Proposal Writer",        skin: S.dark     },
    ],
  },
  {
    name: "Marketing", tag: "Internal",
    border: "rgba(212,175,55,0.4)", headerBg: "#0A2342",
    agents: [
      { name: "Nia Robinson",   role: "Content Creation",  skin: S.dark     },
      { name: "Luca Romano",    role: "Digital Marketing", skin: S.olive    },
      { name: "Hyun-Ji Kim",    role: "Analytics & ROI",   skin: S.asian    },
      { name: "Andre Mitchell", role: "SEO / SEM",         skin: S.dark     },
    ],
  },
  {
    name: "Content & Brand", tag: "Internal",
    border: "rgba(212,175,55,0.4)", headerBg: "#0A2342",
    agents: [
      { name: "Camila Flores",  role: "Social Media Strategist",  skin: S.medLight },
      { name: "Darius King",    role: "Viral Scripter",           skin: S.dark     },
      { name: "Ingrid Larsen",  role: "Press Release",            skin: S.light    },
      { name: "Ravi Gupta",     role: "Graphic Designer",         skin: S.medium   },
      { name: "Yara Mansour",   role: "Translator / Localization", skin: S.medLight},
    ],
  },
  {
    name: "Client Delivery", tag: "Client-Facing", fullWidth: true,
    border: "rgba(194,24,91,0.4)", headerBg: "#C2185B",
    agents: [
      { name: "Keisha Thompson", role: "Onboarding Coach",       skin: S.dark     },
      { name: "Marco Silva",     role: "Community Manager",      skin: S.olive    },
      { name: "Leila Nasser",    role: "Feedback Coach",         skin: S.medLight },
      { name: "Jordan Hayes",    role: "Creative Director ★",    skin: S.dark     },
      { name: "Simone Laurent",  role: "Course Architect",       skin: S.light    },
      { name: "Theo Nguyen",     role: "Presentation Designer",  skin: S.asian    },
      { name: "Amelia Santos",   role: "Training Video Producer",skin: S.medLight },
    ],
  },
  {
    name: "Customer Support", tag: "Client-Facing", fullWidth: true,
    border: "rgba(194,24,91,0.4)", headerBg: "#C2185B",
    agents: [
      { name: "Isaiah Carter",     role: "Issue Resolution",         skin: S.dark   },
      { name: "Priscilla Okonkwo", role: "Multi-Channel Communication", skin: S.dark},
    ],
  },
];

export default function AdminOrg() {
  const [imgError, setImgError] = useState(false);

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/admin-org" />

      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-page { background: white !important; padding: 0.5rem !important; }
          .division-card { border: 1px solid #ccc !important; background: white !important; break-inside: avoid; }
          .division-header { background: #0A2342 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .agent-row { background: #f9f9f9 !important; border: 1px solid #eee !important; }
          .agent-name { color: #0A2342 !important; }
          .agent-role { color: #666 !important; }
          .hero-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          h1, p { color: #0A2342 !important; }
          @page { size: landscape; margin: 0.5in; }
        }
      `}</style>

      <main className="print-page" style={{ flex: 1, padding: "2rem 1.5rem", maxWidth: 1100, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.4rem" }}>Admin · Page 2 · Confidential</p>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.2rem" }}>DRU AI Consulting — AI Empire Org Chart</h1>
            <p style={{ color: "rgba(230,230,230,0.5)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem" }}>39 agents · 10 divisions · DeAnna → AI Twin → Travis → 37 agents · All agents operate in Genius Mode</p>
          </div>
          <div className="no-print" style={{ display: "flex", gap: 10 }}>
            <button onClick={() => window.print()}
              style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#0A2342", background: "#D4AF37", border: "none", borderRadius: 8, padding: "0.6rem 1.25rem", cursor: "pointer", letterSpacing: "0.06em" }}>
              🖨 Print Org Chart
            </button>
            <div onClick={() => window.location.href = "/admin"}
              style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#D4AF37", textDecoration: "none", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 8, padding: "0.6rem 1.25rem", letterSpacing: "0.06em", cursor: "pointer" }}>
              ← Command Center
            </div>
          </div>
        </div>

        {/* Top hierarchy */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1.5rem", gap: 6 }}>

          {/* DeAnna */}
          <div className="hero-box" style={{ background: "#C2185B", borderRadius: 12, padding: "0.75rem 2rem", display: "flex", alignItems: "center", gap: 12, minWidth: 260 }}>
            {!imgError ? (
              <img src="/deanna-avatar.jpg" alt="DeAnna R. Upshaw" onError={() => setImgError(true)}
                style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid #D4AF37", objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid #D4AF37", background: "linear-gradient(135deg,#0A2342,#1a3a5c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>👑</div>
            )}
            <div>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>DeAnna R. Upshaw</p>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.85)", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "2px 0 0" }}>CEO & Founder · AI Authority</p>
            </div>
          </div>

          <div style={{ width: 2, height: 14, background: "rgba(212,175,55,0.5)" }} />

          {/* AI Twin */}
          <div className="hero-box" style={{ background: "#071A2E", border: "2px solid #D4AF37", borderRadius: 12, padding: "0.75rem 2rem", display: "flex", alignItems: "center", gap: 12, minWidth: 280 }}>
            <img src={avatar("DeAnna AI Twin Master", "dba575")} alt="AI Twin"
              style={{ width: 52, height: 52, borderRadius: "50%", border: "2px solid #D4AF37", flexShrink: 0 }} />
            <div>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>✦ DeAnna's AI Twin</p>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.6)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "2px 0 0" }}>Master Orchestrator · DeAnna's Voice</p>
            </div>
          </div>

          <div style={{ width: 2, height: 14, background: "rgba(212,175,55,0.5)" }} />

          {/* Travis */}
          <div style={{ background: "rgba(10,35,66,0.9)", border: "1px solid rgba(212,175,55,0.45)", borderRadius: 10, padding: "0.65rem 2rem", display: "flex", alignItems: "center", gap: 12, minWidth: 260 }}>
            <img src={avatar("Travis Chief of Staff", S.dark)} alt="Travis"
              style={{ width: 46, height: 46, borderRadius: "50%", border: "1px solid rgba(212,175,55,0.5)", flexShrink: 0 }} />
            <div>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 1px" }}>Operations Layer</p>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "0.85rem", fontWeight: 700, margin: 0 }}>Travis — Chief of Staff</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.58rem", margin: "1px 0 0" }}>Routes all 37 agents · 9 divisions</p>
            </div>
          </div>

          <div style={{ width: 2, height: 14, background: "rgba(212,175,55,0.5)" }} />
        </div>

        {/* Division grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
          {DIVISIONS.map(div => (
            <div key={div.name} className="division-card"
              style={{ gridColumn: (div as any).fullWidth ? "1 / -1" : "auto", borderRadius: 10, overflow: "hidden", border: `1px solid ${div.border}`, background: "rgba(255,255,255,0.02)" }}>
              <div className="division-header" style={{ background: div.headerBg, padding: "7px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontSize: "0.75rem", fontWeight: 700 }}>{div.name}</span>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.56rem", fontWeight: 700, padding: "1px 7px", borderRadius: 10, background: "rgba(255,255,255,0.15)", color: "#FFFFFF" }}>{div.tag}</span>
              </div>
              <div style={{ padding: "8px 10px", display: "flex", flexWrap: "wrap", gap: 5 }}>
                {div.agents.map(agent => (
                  <div key={agent.name} className="agent-row"
                    style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "5px 9px", flex: (div as any).fullWidth ? "1 1 160px" : "1 1 100%" }}>
                    <img src={avatar(agent.name, agent.skin)} alt={agent.name}
                      style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(212,175,55,0.35)", flexShrink: 0, background: "rgba(255,255,255,0.05)" }} />
                    <div style={{ minWidth: 0 }}>
                      <p className="agent-name" style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontSize: "0.7rem", fontWeight: 700, margin: 0, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{agent.name}</p>
                      <p className="agent-role" style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.58rem", margin: 0, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{agent.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div style={{ marginTop: "1rem", textAlign: "center", padding: "0.75rem", background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8 }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", color: "rgba(212,175,55,0.7)", margin: 0 }}>
            ★ Isabella Moreno auto-blocks all outputs violating Trademark Classes 35 · 41 · 42 · All agents operate in Genius Mode by default · Confidential · DRU AI Consulting © 2026
          </p>
        </div>

      </main>

      <footer className="no-print" style={{ textAlign: "center", padding: "0.75rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
