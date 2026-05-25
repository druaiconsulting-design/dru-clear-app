import { useState, useEffect } from "react";
import NavBar from "../components/NavBar";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface WeeklyPdf {
  id: string;
  title: string;
  week_of: string;
  pdf_url: string;
  is_active: boolean;
  created_at: string;
}

interface ResourceCategory {
  label: string;
  icon: string;
  description: string;
  comingSoon: boolean;
  resources: { title: string; subtitle: string; url: string }[];
}

const RESOURCE_CATEGORIES: ResourceCategory[] = [
  {
    label: "White Papers",
    icon: "📄",
    description: "In-depth research and thought leadership from DRU AI Consulting",
    comingSoon: true,
    resources: [],
  },
  {
    label: "Notion Templates",
    icon: "📐",
    description: "Ready-to-use planning and strategy templates",
    comingSoon: true,
    resources: [],
  },
  {
    label: "Case Studies",
    icon: "📊",
    description: "Real transformation stories from clients in the DRU ecosystem",
    comingSoon: true,
    resources: [],
  },
];

const ASSESSMENT_URL = "https://assessment.druaiconsulting.com";

export default function Resources() {
  const { isPaid } = useAuth();
  const [copied, setCopied] = useState(false);
  const [currentPdf, setCurrentPdf] = useState<WeeklyPdf | null>(null);
  const [archivePdfs, setArchivePdfs] = useState<WeeklyPdf[]>([]);
  const [loadingPdfs, setLoadingPdfs] = useState(true);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // ── Fetch PDFs ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchPdfs() {
      try {
        const { data } = await supabase
          .from("weekly_pdfs")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (data && data.length > 0) {
          setCurrentPdf(data[0]);
          setArchivePdfs(data.slice(1));
        }
      } catch {
        // silent fail
      } finally {
        setLoadingPdfs(false);
      }
    }
    fetchPdfs();
  }, []);

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

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Knowledge Vault</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.75rem" }}>Resource Hub</h1>
          <p style={{ color: "rgba(230,230,230,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.88rem", lineHeight: 1.7 }}>
            Curated guides, frameworks, and tools to accelerate your AI leadership journey. Resources added weekly.
          </p>
        </div>

        {/* ── AI Leadership Guides — dynamic from weekly_pdfs ── */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 10, padding: "1.25rem 1.5rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
            <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>🧠</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.04em", marginBottom: "0.3rem" }}>AI Leadership Guides</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.55)", fontSize: "0.75rem", lineHeight: 1.6, marginBottom: "0.875rem" }}>Strategic frameworks and playbooks for leading with AI</p>

              {loadingPdfs ? (
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, height: 64 }} />
              ) : currentPdf ? (
                <>
                  {/* Current / featured PDF */}
                  <a
                    href={currentPdf.pdf_url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8, padding: "0.75rem 1rem", textDecoration: "none", marginBottom: archivePdfs.length > 0 ? "0.5rem" : 0 }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#0A2342", background: "#D4AF37", borderRadius: 3, padding: "1px 6px" }}>Current</span>
                        <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.03em", margin: 0 }}>{currentPdf.title}</p>
                      </div>
                      <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.68rem" }}>Week of {currentPdf.week_of}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Download</span>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5.5L6 8.5L9 5.5M1.5 10.5h9" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </a>

                  {/* Archive */}
                  {archivePdfs.length > 0 && (
                    <div>
                      <button
                        onClick={() => setArchiveOpen(!archiveOpen)}
                        style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0", marginBottom: archiveOpen ? "0.5rem" : 0 }}
                      >
                        <span style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(212,175,55,0.6)", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
                          {archiveOpen ? "▾" : "▸"} Archive ({archivePdfs.length})
                        </span>
                      </button>
                      {archiveOpen && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                          {archivePdfs.map((pdf) => (
                            <a
                              key={pdf.id}
                              href={pdf.pdf_url}
                              download
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "0.65rem 1rem", textDecoration: "none" }}
                            >
                              <div>
                                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.7)", fontWeight: 600, fontSize: "0.75rem", margin: "0 0 0.15rem" }}>{pdf.title}</p>
                                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.4)", fontSize: "0.65rem" }}>Week of {pdf.week_of}</p>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
                                <span style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(212,175,55,0.5)", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Download</span>
                                <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5.5L6 8.5L9 5.5M1.5 10.5h9" stroke="rgba(212,175,55,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.35)", fontSize: "0.75rem", fontStyle: "italic" }}>No resources published yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Coming Soon categories */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
          {RESOURCE_CATEGORIES.map((cat) => (
            <div key={cat.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 10, padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", flex: 1 }}>
                  <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>{cat.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.04em", marginBottom: "0.3rem" }}>{cat.label}</p>
                    <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.55)", fontSize: "0.75rem", lineHeight: 1.6 }}>{cat.description}</p>
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
