// client/src/pages/AdminArchived.tsx
// Admin · Archived Approvals

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import NavBar from "../components/NavBar";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

type ApprovalStatus   = "pending" | "approved" | "rejected" | "edited";
type Platform         = "LinkedIn" | "Instagram" | "Facebook" | "Email" | "General";
type Priority         = "URGENT" | "HIGH" | "NORMAL";

interface Approval {
  id:               string;
  created_at:       string;
  agent_name:       string;
  agent_role:       string;
  output:           string;
  edited_output:    string | null;
  status:           ApprovalStatus;
  priority:         Priority;
  category:         string;
  platform:         Platform;
  source:           string;
  archived:         boolean;
}

const PLATFORM_COLORS: Record<string, string> = {
  LinkedIn:  "#0077B5",
  Instagram: "#C2185B",
  Facebook:  "#1877F2",
  Email:     "#D4AF37",
  General:   "#0A2342",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  URGENT: "#C2185B",
  HIGH:   "#D4AF37",
  NORMAL: "rgba(255,255,255,0.3)",
};

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

export default function AdminArchived() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading]     = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  const fetchArchived = async () => {
    const { data, error } = await supabase
      .from("approvals")
      .select("*")
      .eq("archived", true)
      .order("created_at", { ascending: false });
    if (error) { console.error("Failed to fetch archived:", error); }
    else        { setApprovals((data as Approval[]) || []); }
    setLoading(false);
  };

  useEffect(() => { fetchArchived(); }, []);

  const handleRestore = async (id: string) => {
    setRestoring(id);
    await supabase.from("approvals").update({ archived: false, status: "pending" }).eq("id", id);
    setApprovals(prev => prev.filter(a => a.id !== id));
    setRestoring(null);
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/admin-approvals" />

      <main style={{ flex: 1, padding: "2rem 1.5rem", maxWidth: 1100, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "1rem" }}>
          <div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "0.4rem" }}>
              Admin · Archived · Confidential
            </p>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.2rem" }}>
              Archived Queue
            </h1>
            <p style={{ color: "rgba(230,230,230,0.5)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem" }}>
              {approvals.length} archived items — restore any item to move it back to the active queue
            </p>
          </div>
          <div
            onClick={() => window.location.href = "/admin-approvals"}
            style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#D4AF37", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 8, padding: "0.6rem 1.25rem", letterSpacing: "0.06em", cursor: "pointer" }}
          >
            ← Back to Approvals
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center" as const, padding: "3rem", color: "rgba(212,175,55,0.6)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.75rem", letterSpacing: "0.08em" }}>
            LOADING ARCHIVE...
          </div>
        )}

        {!loading && approvals.length === 0 && (
          <div style={{ textAlign: "center" as const, padding: "3rem", color: "rgba(255,255,255,0.3)", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem" }}>
            No archived items
          </div>
        )}

        {!loading && (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.75rem" }}>
            {approvals.map(approval => (
              <div
                key={approval.id}
                style={{
                  borderRadius: 12, overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.02)",
                  opacity: 0.7,
                }}
              >
                {/* Card Header */}
                <div style={{ background: "#071A2E", padding: "0.65rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" as const }}>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.58rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, letterSpacing: "0.06em", background: PLATFORM_COLORS[approval.platform] || "#0A2342", color: "#FFFFFF" }}>
                      {approval.platform}
                    </span>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.55rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, letterSpacing: "0.06em", background: "transparent", border: `1px solid ${PRIORITY_COLORS[approval.priority]}`, color: PRIORITY_COLORS[approval.priority] }}>
                      {approval.priority}
                    </span>
                    <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(212,175,55,0.7)", fontSize: "0.62rem" }}>
                      {approval.agent_name} · {approval.agent_role}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: approval.status === "approved" ? "#4CAF50" : approval.status === "rejected" ? "#C2185B" : "rgba(255,255,255,0.4)" }}>
                      {approval.status}
                    </span>
                    <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.25)", fontSize: "0.6rem" }}>
                      {timeAgo(approval.created_at)}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: "0.875rem 1rem" }}>
                  <div>{renderDraft((approval.edited_output || approval.output).slice(0, 400) + ((approval.edited_output || approval.output).length > 400 ? '...' : ''))}</div>
                </div>

                {/* Restore Button */}
                <div style={{ padding: "0 1rem 0.875rem", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => handleRestore(approval.id)}
                    disabled={restoring === approval.id}
                    style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, padding: "0.45rem 1rem", borderRadius: 6, cursor: "pointer", border: "1px solid rgba(212,175,55,0.3)", background: "transparent", color: "#D4AF37", letterSpacing: "0.06em", opacity: restoring === approval.id ? 0.5 : 1 }}
                  >
                    {restoring === approval.id ? "Restoring..." : "Restore to Queue"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      <footer style={{ textAlign: "center" as const, padding: "0.75rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
