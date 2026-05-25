import { useState } from "react";
import NavBar from "../components/NavBar";
import { useAuth } from "../contexts/AuthContext";

interface Resource {
  title: string;
  subtitle: string;
  url: string;
  free: boolean;
}

interface ResourceCategory {
  label: string;
  icon: string;
  description: string;
  comingSoon: boolean;
  freeLimit: number;
  resources: Resource[];
}

const RESOURCE_CATEGORIES: ResourceCategory[] = [
  {
    label: "AI Leadership Guides",
    icon: "🧠",
    description: "Strategic frameworks and playbooks for leading with AI",
    comingSoon: false,
    freeLimit: 1,
    resources: [
      {
        title: "DRU CLEAR™ AI Leadership Manual 101",
        subtitle: "The AI Revolution & Why Leaders Can't Afford to Wait",
        url: "https://dsflijqygsegonwxauce.supabase.co/storage/v1/object/public/resources/DRU-CLEAR-AI-Leadership-Manual-101.pdf",
        free: true,
      },
    ],
  },
  {
    label: "White Papers",
    icon: "📄",
    description: "In-depth research and thought leadership from DRU AI Consulting",
    comingSoon: true,
    freeLimit: 0,
    resources: [],
  },
  {
    label: "Notion Templates",
    icon: "📐",
    description: "Ready-to-use planning and strategy templates",
    comingSoon: true,
    freeLimit: 0,
    resources: [],
  },
  {
    label: "Case Studies",
    icon: "📊",
    description: "Real transformation stories from clients in the DRU ecosystem",
    comingSoon: true,
    freeLimit: 0,
    resources: [],
  },
];

const NEW_THIS_WEEK: string | null = "DRU CLEAR™ AI Leadership Manual 101 — The AI Revolution & Why Leaders Can't Afford to Wait";

const ASSESSMENT_URL = "https://assessment.druaiconsulting.com";

function LockedResource({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "0.75rem 1rem", opacity: 0.6 }}>
      <div style={{ filter: "blur(2px)", flex: 1 }}>
        <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.78rem", marginBottom: "0.2rem" }}>{title}</p>
        <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.55)", fontSize: "0.7rem", lineHeight: 1.5 }}>{subtitle}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="11" width="18" height="11" rx="2" stroke="rgba(212,175,55,0.5)" strokeWidth="1.75"/>
          <path d="M7 11V7a5 5 0 0110 0v4" stroke="rgba(212,175,55,0.5)" strokeWidth="1.75" strokeLinecap="round"/>
        </svg>
        <span style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(212,175,55,0.5)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Locked</span>
      </div>
    </div>
  );
}

export default function Resources() {
  const { isPaid } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(ASSESSMENT_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/resources" />

      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 680, margin: "0 auto", width: "100%" }}>

        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Knowledge Vault</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.75rem" }}>Resource Hub</h1>
          <p style={{ color: "rgba(230,230,230,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.88rem", lineHeight: 1.7 }}>
            Curated guides, frameworks, and tools to accelerate your AI leadership journey. Resources added weekly.
          </p>
        </div>

        {NEW_THIS_WEEK && (
          <div style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.4)", borderRadius: 10, padding: "0.875rem 1.25rem", marginBottom: "1.75rem", display: "flex", alignItems: "center", gap: "0.875rem" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#D4AF37", flexShrink: 0 }} />
            <div>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>New This Week</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.85)", fontSize: "0.8rem", lineHeight: 1.5 }}>{NEW_THIS_WEEK}</p>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
          {RESOURCE_CATEGORIES.map((cat) => (
            <div key={cat.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 10, padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", flex: 1 }}>
                  <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>{cat.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.04em", marginBottom: "0.3rem" }}>{cat.label}</p>
                    <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.55)", fontSize: "0.75rem", lineHeight: 1.6, marginBottom: cat.resources && cat.resources.length > 0 ? "0.875rem" : 0 }}>{cat.description}</p>

                    {cat.resources && cat.resources.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {cat.resources.map((resource, idx) => {
                          const isAccessible = resource.free || isPaid;
                          if (isAccessible) {
                            return (
                              <a
                                key={resource.title}
                                href={resource.url}
                                download
                                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8, padding: "0.75rem 1rem", textDecoration: "none" }}
                              >
                                <div>
                                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.03em", marginBottom: "0.2rem" }}>{resource.title}</p>
                                  <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.55)", fontSize: "0.7rem", lineHeight: 1.5 }}>{resource.subtitle}</p>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
                                  <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Download</span>
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5.5L6 8.5L9 5.5M1.5 10.5h9" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </div>
                              </a>
                            );
                          }
                          return <LockedResource key={resource.title} title={resource.title} subtitle={resource.subtitle} />;
                        })}
                      </div>
                    )}
                  </div>
                </div>
                {cat.comingSoon && (
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#D4AF37", background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 4, padding: "0.2rem 0.5rem", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
                    Coming Soon
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", padding: "1rem 0", marginBottom: "1rem" }}>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.3)", fontSize: "0.75rem", fontStyle: "italic" }}>
            New resources are added weekly. Check back often.
          </p>
        </div>

        {/* Share footer */}
        <div style={{ background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 8, padding: "1rem 1.25rem", textAlign: "center" as const }}>
          <p style={{ color: "rgba(230,230,230,0.55)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", lineHeight: 1.6, marginBottom: "0.875rem" }}>
            Do you know a leader who could benefit from the DRU CLEAR™ Assessment? Kindly share the link below and initiate a conversation.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.625rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 6, padding: "0.55rem 0.875rem", maxWidth: 420, margin: "0 auto" }}>
            <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.72rem", flex: 1, textAlign: "left" as const, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{ASSESSMENT_URL}</span>
            <button
              onClick={handleCopy}
              style={{ background: copied ? "rgba(212,175,55,0.15)" : "transparent", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 4, color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "0.3rem 0.7rem", cursor: "pointer", whiteSpace: "nowrap" as const, transition: "all 0.2s ease", flexShrink: 0 }}
            >
              {copied ? "✓ Copied!" : "Copy Link"}
            </button>
          </div>
        </div>

      </main>

      <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
