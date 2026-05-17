// client/src/pages/AdminArchived.tsx
// Admin · Archived Approvals
// UPDATED: Same category filters and division colors as Approval Queue

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import NavBar from "../components/NavBar";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

type ApprovalStatus = "pending" | "approved" | "rejected" | "edited";
type Priority       = "URGENT" | "HIGH" | "NORMAL";

interface Approval {
  id:            string;
  created_at:    string;
  agent_name:    string;
  agent_role:    string;
  division:      string;
  task_brief:    string;
  output:        string;
  edited_output: string | null;
  status:        ApprovalStatus;
  priority:      Priority;
  category:      string;
  platform:      string | null;
  source:        string;
  archived:      boolean;
}

// ─── Platform badge colors ────────────────────────────────────
const PLATFORM_COLORS: Record<string, string> = {
  LinkedIn:     "#0077B5",
  Instagram:    "#C2185B",
  Facebook:     "#1877F2",
  Email:        "#D4AF37",
  General:      "#0A2342",
  X:            "#14171A",
  TikTok:       "#010101",
  YouTube:      "#FF0000",
  Pinterest:    "#E60023",
  Content:      "#163D6E",
  Press:        "#8A6E1A",
  Design:       "#7A0F38",
  Localization: "#A68920",
  Copy:         "#E0527E",
  Outreach:     "#2E6DAB",
};

// ─── Division badge colors (DRU brand tints/shades) ───────────
const DIVISION_COLORS: Record<string, string> = {
  "Revenue & Growth":  "#D4AF37",
  "Content & Brand":   "#C2185B",
  "Marketing":         "#163D6E",
  "Legal & Finance":   "#8A6E1A",
  "AI Governance":     "#7A0F38",
  "HR":                "#2E6DAB",
  "Client Delivery":   "#A68920",
  "Customer Support":  "#C2185B",
  "Command":           "#0A2342",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  URGENT: "#C2185B",
  HIGH:   "#D4AF37",
  NORMAL: "rgba(255,255,255,0.3)",
};

const CATEGORY_LABELS: Record<string, string> = {
  daily_briefing:   "Daily Briefing",
  revenue_growth:   "Revenue & Growth",
  content_brand:    "Content & Brand",
  marketing:        "Marketing",
  legal_finance:    "Legal & Finance",
  ai_governance:    "AI Governance",
  hr:               "HR",
  client_delivery:  "Client Delivery",
  customer_support: "Customer Support",
  social:           "Social Media",
  email:            "Email",
  proposal:         "Proposal",
  content:          "Content",
  other:            "Other",
};

const CATEGORY_ORDER = [
  "daily_briefing","revenue_growth","content_brand","marketing",
  "legal_finance","ai_governance","hr","client_delivery","customer_support",
  "social","email","proposal","content","other",
];

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function renderDraft(text: string) {
  return text.split('\n\n').map((para, i) => (
    <p key={i} style={{ margin: '0 0 0.75rem 0', fontFamily: "'Inter', sans-serif", color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', lineHeight: 1.6 }}>
      {para.replace(/\n/g, ' ')}
    </p>
  ));
}

function getBadgeInfo(approval: Approval): { text: string; color: string } {
  if (approval.category === "social") {
    const platform = approval.platform ?? "Social";
    return { text: platform, color: PLATFORM_COLORS[platform] ?? "#0A2342" };
  }
  if (approval.division && DIVISION_COLORS[approval.division]) {
    return { text: approval.division, color: DIVISION_COLORS[approval.division] };
  }
  if (approval.category === "daily_briefing") return { text: "Daily Briefing", color: "#D4AF37" };
  return { text: approval.category, color: "#0A2342" };
}

export default function AdminArchived() {
  const [approvals, setApprovals]     = useState<Approval[]>([]);
  const [loading, setLoading]         = useState(true);
  const [restoring, setRestoring]     = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const fetchArchived = async () => {
    const { data, error } = await supabase
      .from("approvals").select("*").eq("archived", true).order("created_at", { ascending: false });
    if (error) console.error("Failed to fetch archived:", error);
    else setApprovals((data as Approval[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchArchived(); }, []);

  const handleRestore = async (id: string) => {
    setRestoring(id);
    await supabase.from("approvals").update({ archived: false, status: "pending" }).eq("id", id);
    setApprovals(prev => prev.filter(a => a.id !== id));
    setRestoring(null);
  };

  // ── Filter tabs ──────────────────────────────────────────────
  const presentCategories = [...new Set(approvals.map(a => a.category))];
  const orderedCategories = CATEGORY_ORDER.filter(c => presentCategories.includes(c));
  const remainingCategories = presentCategories.filter(c => !CATEGORY_ORDER.includes(c));
  const allCategories = [...orderedCategories, ...remainingCategories];

  const filtered = activeFilter === "all" ? approvals : approvals.filter(a => a.category === activeFilter);

  const tabStyle = (active: boolean) => ({
    fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", fontWeight: 700,
    letterSpacing: "0.08em", textTransform: "uppercase" as const,
    padding: "0.4rem 0.875rem", borderRadius: 20, cursor: "pointer", border: "none",
    background: active ? "#D4AF37" : "rgba(255,255,255,0.06)",
    color: active ? "#0A2342" : "rgba(255,255,255,0.6)",
    transition: "all 0.15s ease",
  });

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/admin-approvals" />

      <main style={{ flex: 1, padding: "2rem 1.5rem", maxWidth: 1100, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "1rem" }}>
          <div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "0.4rem" }}>Admin · Archived · Confidential</p>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.2rem" }}>Archived Queue</h1>
            <p style={{ color: "rgba(230,230,230,0.5)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem" }}>
              {approvals.length} archived items — restore any item to move it back to the active queue
            </p>
          </div>
          <div onClick={() => window.location.href = "/admin-approvals"}
            style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#D4AF37", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 8, padding: "0.6rem 1.25rem", letterSpacing: "0.06em", cursor: "pointer" }}>
            ← Back to Approvals
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Total Archived",   value: approvals.length,                                                         color: "rgba(255,255,255,0.6)" },
            { label: "Approved",         value: approvals.filter(a => a.status === "approved").length,                    color: "#4CAF50" },
            { label: "Rejected",         value: approvals.filter(a => a.status === "rejected").length,                    color: "#C2185B" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "0.875rem 1rem" }}>
              <p style={{ fontFamily: "'Playfair Display', serif", color: s.color, fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>{s.value}</p>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "4px 0 0" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" as const }}>
          <button onClick={() => setActiveFilter("all")} style={tabStyle(activeFilter === "all")}>
            All ({approvals.length})
          </button>
          {allCategories.map(cat => (
            <button key={cat} onClick={() => setActiveFilter(cat)} style={tabStyle(activeFilter === cat)}>
              {CATEGORY_LABELS[cat] || cat} ({approvals.filter(a => a.category === cat).length})
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign: "center" as const, padding: "3rem", color: "rgba(212,175,55,0.6)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.75rem" }}>LOADING ARCHIVE...</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center" as const, padding: "3rem", color: "rgba(255,255,255,0.3)", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem" }}>
            {activeFilter === "all" ? "No archived items" : `No archived items in ${CATEGORY_LABELS[activeFilter] ?? activeFilter}`}
          </div>
        )}

        {!loading && (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.75rem" }}>
            {filtered.map(approval => {
              const badge      = getBadgeInfo(approval);
              const isBriefing = approval.category !== "social";

              return (
                <div key={approval.id} style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", opacity: 0.75 }}>

                  {/* Card Header */}
                  <div style={{ background: "#071A2E", padding: "0.65rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" as const }}>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.58rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: badge.color, color: "#FFFFFF" }}>{badge.text}</span>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.55rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "transparent", border: `1px solid ${PRIORITY_COLORS[approval.priority] ?? PRIORITY_COLORS.NORMAL}`, color: PRIORITY_COLORS[approval.priority] ?? PRIORITY_COLORS.NORMAL }}>{approval.priority || "NORMAL"}</span>
                      <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(212,175,55,0.7)", fontSize: "0.62rem" }}>
                        {isBriefing ? `${approval.division} Division` : `${approval.agent_name} · ${approval.agent_role}`}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: approval.status === "approved" ? "#4CAF50" : approval.status === "rejected" ? "#C2185B" : "rgba(255,255,255,0.4)" }}>{approval.status}</span>
                      <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.25)", fontSize: "0.6rem" }}>{timeAgo(approval.created_at)}</span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: "0.875rem 1rem" }}>
                    {isBriefing && approval.task_brief && (
                      <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(212,175,55,0.5)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: "0.5rem" }}>
                        {approval.task_brief}
                      </p>
                    )}
                    <div>
                      {renderDraft((approval.edited_output || approval.output).slice(0, 500) + ((approval.edited_output || approval.output).length > 500 ? '...' : ''))}
                    </div>
                  </div>

                  {/* Restore Button */}
                  <div style={{ padding: "0 1rem 0.875rem", display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={() => handleRestore(approval.id)} disabled={restoring === approval.id}
                      style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, padding: "0.45rem 1rem", borderRadius: 6, cursor: "pointer", border: "1px solid rgba(212,175,55,0.3)", background: "transparent", color: "#D4AF37", letterSpacing: "0.06em", opacity: restoring === approval.id ? 0.5 : 1 }}>
                      {restoring === approval.id ? "Restoring..." : "Restore to Queue"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>
      <footer style={{ textAlign: "center" as const, padding: "0.75rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
