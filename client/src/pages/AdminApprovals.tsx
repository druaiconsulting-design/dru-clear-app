
// client/src/pages/AdminApprovals.tsx
// Admin · Page 3 · Approval Queue
// UPDATED: Approve on social posts calls Vercel api/social-publisher

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import NavBar from "../components/NavBar";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

type ApprovalStatus   = "pending" | "approved" | "rejected" | "edited";
type ApprovalCategory = "social" | "email" | "proposal" | "content" | "other";
type Platform         = "LinkedIn" | "Instagram" | "Facebook" | "Email" | "General";
type Priority         = "URGENT" | "HIGH" | "NORMAL";

interface Approval {
  id:               string;
  created_at:       string;
  source:           string;
  trigger_type:     string;
  agent_name:       string;
  agent_role:       string;
  division:         string;
  task_brief:       string;
  original_content: string;
  output:           string;
  edited_output:    string | null;
  status:           ApprovalStatus;
  ghl_contact_id:   string | null;
  notify_deanna:    boolean;
  priority:         Priority;
  category:         ApprovalCategory;
  platform:         Platform;
  context:          string | null;
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

const CATEGORY_LABELS: Record<string, string> = {
  social:   "Social Media",
  email:    "Email",
  proposal: "Proposal",
  content:  "Content",
  other:    "Other",
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminApprovals() {
  const [approvals, setApprovals]         = useState<Approval[]>([]);
  const [loading, setLoading]             = useState(true);
  const [activeFilter, setActiveFilter]   = useState<"all" | ApprovalCategory>("all");
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [editText, setEditText]           = useState("");
  const [saving, setSaving]               = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<Record<string, "posting" | "posted" | "failed">>({});

  const fetchApprovals = async () => {
    const { data, error } = await supabase
      .from("approvals")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { console.error("Failed to fetch approvals:", error); }
    else        { setApprovals((data as Approval[]) || []); }
    setLoading(false);
  };

  useEffect(() => {
    fetchApprovals();
    const channel = supabase
      .channel("approvals-realtime")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "approvals" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setApprovals((prev) => [payload.new as Approval, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setApprovals((prev) =>
              prev.map((a) => a.id === payload.new.id ? (payload.new as Approval) : a)
            );
          } else if (payload.eventType === "DELETE") {
            setApprovals((prev) => prev.filter((a) => a.id !== payload.old.id));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Approve — calls Vercel social-publisher for social posts ──────────────
  const handleApprove = async (id: string) => {
    setSaving(id);

    const { error } = await supabase
      .from("approvals")
      .update({ status: "approved" })
      .eq("id", id);

    if (error) {
      console.error("Approve failed:", error);
      setSaving(null);
      return;
    }

    const approval = approvals.find((a) => a.id === id);
    console.log("DEBUG category:", approval?.category, "id:", id);
    if (approval?.category === "social") {
      setPublishStatus((prev) => ({ ...prev, [id]: "posting" }));
      try {
        const res = await fetch("/api/social-publisher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content:     approval.edited_output || approval.output,
            platform:    approval.platform,
            approval_id: id,
          }),
        });
        if (res.ok) {
  const data = await res.json();
  console.log("GHL response:", JSON.stringify(data));
  setPublishStatus((prev) => ({ ...prev, [id]: "posted" }));
}
        else {
          const err = await res.json();
          console.error("Publish failed:", err);
          setPublishStatus((prev) => ({ ...prev, [id]: "failed" }));
        }
      } catch (err) {
        console.error("Publisher error:", err);
        setPublishStatus((prev) => ({ ...prev, [id]: "failed" }));
      }
    }

    setSaving(null);
  };

  const handleReject = async (id: string) => {
    setSaving(id);
    const { error } = await supabase
      .from("approvals")
      .update({ status: "rejected" })
      .eq("id", id);
    if (error) console.error("Reject failed:", error);
    setSaving(null);
  };

  const handleEditStart = (approval: Approval) => {
    setEditingId(approval.id);
    setEditText(approval.edited_output || approval.output);
  };

  const handleEditSave = async (id: string) => {
    setSaving(id);
    const { error } = await supabase
      .from("approvals")
      .update({ edited_output: editText, status: "edited" })
      .eq("id", id);
    if (error) { console.error("Edit save failed:", error); }
    else        { setEditingId(null); }
    setSaving(null);
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const pending = approvals.filter(a => a.status === "pending").length;
  const approvedToday = approvals.filter(a => {
    const today = new Date().toDateString();
    return a.status === "approved" && new Date(a.created_at).toDateString() === today;
  }).length;

  const categories = [...new Set(approvals.map(a => a.category))] as ApprovalCategory[];
  const filtered = activeFilter === "all"
    ? approvals
    : approvals.filter(a => a.category === activeFilter);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/admin-approvals" />

      <main style={{ flex: 1, padding: "2rem 1.5rem", maxWidth: 1100, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "1rem" }}>
          <div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "0.4rem" }}>
              Admin · Page 3 · Confidential
            </p>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.2rem" }}>
              Approval Queue
            </h1>
            <p style={{ color: "rgba(230,230,230,0.5)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem" }}>
              Review and approve agent-drafted responses before they go live
            </p>
          </div>
          <div
            onClick={() => window.location.href = "/admin"}
            style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#D4AF37", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 8, padding: "0.6rem 1.25rem", letterSpacing: "0.06em", cursor: "pointer" }}
          >
            ← Command Center
          </div>
        </div>

        {/* Stats Bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Awaiting Approval", value: pending,          color: "#D4AF37" },
            { label: "Approved Today",    value: approvedToday,    color: "#4CAF50" },
            { label: "Total in Queue",    value: approvals.length, color: "rgba(255,255,255,0.6)" },
          ].map(stat => (
            <div key={stat.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "0.875rem 1rem" }}>
              <p style={{ fontFamily: "'Playfair Display', serif", color: stat.color, fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>{stat.value}</p>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "4px 0 0" }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" as const }}>
          {(["all", ...categories] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              style={{
                fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase" as const,
                padding: "0.4rem 0.875rem", borderRadius: 20, cursor: "pointer", border: "none",
                background: activeFilter === cat ? "#D4AF37" : "rgba(255,255,255,0.06)",
                color: activeFilter === cat ? "#0A2342" : "rgba(255,255,255,0.6)",
                transition: "all 0.15s ease",
              }}
            >
              {cat === "all"
                ? `All (${approvals.length})`
                : `${CATEGORY_LABELS[cat] || cat} (${approvals.filter(a => a.category === cat).length})`}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: "center" as const, padding: "3rem", color: "rgba(212,175,55,0.6)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.75rem", letterSpacing: "0.08em" }}>
            LOADING QUEUE...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center" as const, padding: "3rem", color: "rgba(255,255,255,0.3)", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem" }}>
            {activeFilter === "all" ? "No items in queue — agents are standing by" : "No items in this category"}
          </div>
        )}

        {/* Approval Cards */}
        {!loading && (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "1rem" }}>
            {filtered.map(approval => (
              <div
                key={approval.id}
                style={{
                  borderRadius: 12, overflow: "hidden",
                  border: `1px solid ${approval.status === "pending" ? "rgba(212,175,55,0.3)" : "rgba(255,255,255,0.08)"}`,
                  background: approval.status !== "pending" ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
                  opacity: approval.status !== "pending" ? 0.6 : 1,
                  transition: "opacity 0.2s ease",
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
                    <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(212,175,55,0.8)", fontSize: "0.62rem" }}>
                      {approval.agent_name} · {approval.agent_role}
                    </span>
                    {approval.source && (
                      <span style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.25)", fontSize: "0.55rem", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
                        via {approval.source}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    {/* Publish status indicator */}
                    {publishStatus[approval.id] && (
                      <span style={{
                        fontFamily: "'Montserrat', sans-serif", fontSize: "0.55rem", fontWeight: 700,
                        letterSpacing: "0.08em", textTransform: "uppercase" as const,
                        color: publishStatus[approval.id] === "posted"  ? "#4CAF50"
                             : publishStatus[approval.id] === "posting" ? "#D4AF37"
                             : "#C2185B",
                      }}>
                        {publishStatus[approval.id] === "posted"  ? "✓ Posted"
                       : publishStatus[approval.id] === "posting" ? "Posting..."
                       : "⚠ Post Failed"}
                      </span>
                    )}
                    {approval.status !== "pending" && !publishStatus[approval.id] && (
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: approval.status === "approved" ? "#4CAF50" : approval.status === "edited" ? "#D4AF37" : "#C2185B" }}>
                        {approval.status}
                      </span>
                    )}
                    <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.3)", fontSize: "0.6rem" }}>
                      {timeAgo(approval.created_at)}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(212,175,55,0.7)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "0.5rem" }}>
                      Original
                    </p>
                    {approval.context && (
                      <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.3)", fontSize: "0.6rem", marginBottom: "0.35rem", fontStyle: "italic" }}>
                        {approval.context}
                      </p>
                    )}
                    <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", lineHeight: 1.6, margin: 0 }}>
                      {approval.original_content ? `"${approval.original_content}"` : <em style={{ color: "rgba(255,255,255,0.3)" }}>No original content</em>}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(212,175,55,0.7)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "0.5rem" }}>
                      {approval.agent_name}'s Draft
                    </p>
                    {editingId === approval.id ? (
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        style={{ width: "100%", minHeight: 100, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(212,175,55,0.4)", borderRadius: 6, color: "#FFFFFF", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", padding: "0.5rem", lineHeight: 1.6, resize: "vertical" as const, boxSizing: "border-box" as const, outline: "none" }}
                      />
                    ) : (
                      <p style={{ fontFamily: "'Inter', sans-serif", color: "#FFFFFF", fontSize: "0.75rem", lineHeight: 1.6, margin: 0 }}>
                        {approval.edited_output || approval.output}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                {approval.status === "pending" && (
                  <div style={{ padding: "0 1rem 1rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    {editingId === approval.id ? (
                      <>
                        <button onClick={() => setEditingId(null)} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, padding: "0.45rem 1rem", borderRadius: 6, cursor: "pointer", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em" }}>
                          Cancel
                        </button>
                        <button onClick={() => handleEditSave(approval.id)} disabled={saving === approval.id} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, padding: "0.45rem 1rem", borderRadius: 6, cursor: "pointer", border: "none", background: "#D4AF37", color: "#0A2342", letterSpacing: "0.06em", opacity: saving === approval.id ? 0.6 : 1 }}>
                          {saving === approval.id ? "Saving..." : "Save & Approve"}
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleReject(approval.id)} disabled={saving === approval.id} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, padding: "0.45rem 1rem", borderRadius: 6, cursor: "pointer", border: "1px solid rgba(194,24,91,0.5)", background: "transparent", color: "#C2185B", letterSpacing: "0.06em" }}>
                          Reject
                        </button>
                        <button onClick={() => handleEditStart(approval)} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, padding: "0.45rem 1rem", borderRadius: 6, cursor: "pointer", border: "1px solid rgba(212,175,55,0.4)", background: "transparent", color: "#D4AF37", letterSpacing: "0.06em" }}>
                          Edit
                        </button>
                        <button onClick={() => handleApprove(approval.id)} disabled={saving === approval.id} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, padding: "0.45rem 1.25rem", borderRadius: 6, cursor: "pointer", border: "none", background: "#D4AF37", color: "#0A2342", letterSpacing: "0.06em", opacity: saving === approval.id ? 0.6 : 1 }}>
                          {saving === approval.id ? "..." : "Approve ✓"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: "1rem", textAlign: "center" as const, padding: "0.75rem", background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8 }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", color: "rgba(212,175,55,0.7)", margin: 0 }}>
            All responses reviewed and approved by DeAnna R. Upshaw before posting · DRU AI Consulting © 2026
          </p>
        </div>

      </main>

      <footer style={{ textAlign: "center" as const, padding: "0.75rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
