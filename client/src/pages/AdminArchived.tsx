import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import AdminLayout from "../components/AdminLayout";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

type ApprovalStatus = "pending" | "approved" | "rejected" | "edited" | "ready_to_use" | "read";
type Priority       = "URGENT" | "HIGH" | "NORMAL";

interface Approval {
  id: string; created_at: string; agent_name: string; agent_role: string;
  division: string; task_brief: string; output: string; edited_output: string | null;
  status: ApprovalStatus; priority: Priority; category: string;
  platform: string | null; source: string; archived: boolean;
}

const DIVISION_COLORS: Record<string, string> = {
  "Revenue, Growth & Sales":"#D4AF37", "Content & Brand":"#C2185B", "Marketing":"#163D6E",
  "Legal & Finance":"#8A6E1A", "AI Governance":"#7A0F38", "HR":"#2E6DAB",
  "Client Delivery":"#A68920", "Customer Support":"#C2185B",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  URGENT:"#C2185B", HIGH:"#D4AF37", NORMAL:"rgba(10,35,66,0.3)",
};

const CATEGORY_LABELS: Record<string, string> = {
  daily_briefing:"Daily Briefing", revenue_growth:"Revenue & Growth",
  content_brand:"Content & Brand", marketing:"Marketing",
  legal_finance:"Legal & Finance", ai_governance:"AI Governance",
  hr:"HR", client_delivery:"Client Delivery", customer_support:"Customer Support",
  social:"Social Media", email:"Email", proposal:"Proposal", content:"Content",
  grants:"Grants", other:"Other",
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
    <p key={i} style={{ margin:'0 0 0.75rem 0', fontFamily:"'Inter', sans-serif", color:'rgba(10,35,66,0.65)', fontSize:'0.75rem', lineHeight:1.6 }}>
      {para.replace(/\n/g, ' ')}
    </p>
  ));
}

function getBadgeInfo(approval: Approval): { text: string; color: string } {
  if (approval.division && DIVISION_COLORS[approval.division]) return { text: approval.division, color: DIVISION_COLORS[approval.division] };
  if (approval.category === "grants") return { text: "Grants", color: "#8A6E1A" };
  if (approval.category === "daily_briefing") return { text: "Daily Briefing", color: "#D4AF37" };
  return { text: approval.category, color: "#0A2342" };
}

export default function AdminArchived() {
  const [approvals, setApprovals]       = useState<Approval[]>([]);
  const [loading, setLoading]           = useState(true);
  const [restoring, setRestoring]       = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [expandedIds, setExpandedIds]   = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId]         = useState<string | null>(null);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editText, setEditText]         = useState("");
  const [saving, setSaving]             = useState<string | null>(null);
  const [archivedOpen, setArchivedOpen]   = useState(false);
  const [rejectedOpen, setRejectedOpen]   = useState(false);
  const [grantsOpen, setGrantsOpen]       = useState(false);

  const fetchArchived = async () => {
    const { data, error } = await supabase
      .from("approvals")
      .select("*")
      .eq("archived", true)
      .in("status", ["ready_to_use", "read", "rejected", "needs_your_input"])
      .order("created_at", { ascending: false });
    if (error) console.error("Failed to fetch archived:", error);
    else setApprovals((data as Approval[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchArchived(); }, []);

  // Grant Application Drafts get their own bucket by category, not status --
  // Sept 1, 2026 fix. A grant card can carry a status this page never knew
  // about (needs_your_input) and previously had nowhere to render at all once
  // archived. Grouping by category instead means any grant card, whatever its
  // status, always has a real, findable home. Excluded from readItems/
  // rejectedItems below so a grant card never shows twice.
  const readyToUse    = approvals.filter(a => a.status === "ready_to_use");
  const readItems     = approvals.filter(a => a.status === "read" && a.category !== "grant_applications");
  const rejectedItems = approvals.filter(a => a.status === "rejected" && a.category !== "grant_applications");
  const grantItems    = approvals.filter(a => a.category === "grant_applications");

  // Restoring a grant card must not drop it into generic "pending" -- that
  // status belongs to the old whole-division question picker (built long
  // before this work, for cards where several RGS agents contributed), which
  // has nothing to do with a stuck grant draft. A grant card's real, working
  // state is needs_your_input -- that's what shows the actual "Give Kwame
  // what he needs" box. Restoring puts it back exactly there, so it's usable
  // immediately, not reset into a different feature entirely.
  const handleRestore = async (id: string, category?: string) => {
    setRestoring(id);
    const status = category === "grant_applications" ? "needs_your_input" : "pending";
    await supabase.from("approvals").update({ archived: false, status }).eq("id", id);
    setApprovals(prev => prev.filter(a => a.id !== id));
    setRestoring(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCopy = async (approval: Approval) => {
    const text = approval.edited_output || approval.output;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(approval.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleEditStart = (approval: Approval) => {
    setEditingId(approval.id);
    setEditText(approval.edited_output || approval.output);
    setExpandedIds(prev => new Set(prev).add(approval.id));
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleEditSave = async (id: string) => {
    setSaving(id);
    const { error } = await supabase.from("approvals").update({ edited_output: editText }).eq("id", id);
    if (!error) {
      setApprovals(prev => prev.map(a => a.id === id ? { ...a, edited_output: editText } : a));
      setEditingId(null);
      setEditText("");
    } else {
      console.error("Save failed:", error);
    }
    setSaving(null);
  };

  const SOCIAL_MEDIA_PLATFORMS = new Set(['LinkedIn','Facebook','Instagram','X','TikTok','YouTube','Social','Email','Press','Localization','Outreach']);

  const getFiltered = () => {
    if (activeFilter === "all")              return readyToUse;
    if (activeFilter === "social_media")     return readyToUse.filter(a => a.category === "social" && SOCIAL_MEDIA_PLATFORMS.has(a.platform ?? ''));
    if (activeFilter === "design")           return readyToUse.filter(a => a.platform === "Design");
    if (activeFilter === "copy")             return readyToUse.filter(a => a.platform === "Copy");
    if (activeFilter === "course")           return readyToUse.filter(a => a.platform === "Course");
    if (activeFilter === "video")            return readyToUse.filter(a => a.platform === "Video");
    if (activeFilter === "proposal")         return readyToUse.filter(a => a.platform === "Proposal");
    if (activeFilter === "client_delivery")  return readyToUse.filter(a => a.category === "client_delivery" || (a.category === "content_review" && a.division === "Client Delivery"));
    if (activeFilter === "customer_support") return readyToUse.filter(a => a.category === "customer_support");
    if (activeFilter === "marketing")        return readyToUse.filter(a => a.category === "marketing" || (a.category === "content_review" && a.division === "Marketing"));
    if (activeFilter === "content_brand")    return readyToUse.filter(a => a.category === "content_brand");
    if (activeFilter === "grants")           return readyToUse.filter(a => a.category === "grants");
    return readyToUse;
  };
  const filtered = getFiltered();

  const tabStyle = (active: boolean) => ({
    fontFamily:"'Montserrat', sans-serif", fontSize:"0.65rem", fontWeight:700,
    letterSpacing:"0.08em", textTransform:"uppercase" as const,
    padding:"0.4rem 0.875rem", borderRadius:20, cursor:"pointer", border:"none",
    background: active ? "#D4AF37" : "rgba(10,35,66,0.06)",
    color: active ? "#0A2342" : "rgba(10,35,66,0.6)",
    transition:"all 0.15s ease",
  });

  const renderCard = (approval: Approval) => {
    const badge = getBadgeInfo(approval);
    return (
      <div key={approval.id} style={{ borderRadius:12, overflow:"hidden", border:"1px solid rgba(10,35,66,0.1)", borderLeft:"3px solid #D4AF37", background:"rgba(10,35,66,0.02)" }}>
        <div style={{ background:"#071A2E", padding:"0.65rem 1rem", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap" as const, gap:"0.5rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", flexWrap:"wrap" as const }}>
            <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.58rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:badge.color, color:"#FFFFFF" }}>{badge.text}</span>
            <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.55rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:"transparent", border:`1px solid ${PRIORITY_COLORS[approval.priority] ?? PRIORITY_COLORS.NORMAL}`, color:PRIORITY_COLORS[approval.priority] ?? PRIORITY_COLORS.NORMAL }}>{approval.priority || "NORMAL"}</span>
            <span style={{ fontFamily:"'Inter', sans-serif", color:"rgba(212,175,55,0.7)", fontSize:"0.62rem" }}>{approval.agent_name} · {approval.agent_role}</span>
          </div>
          <span style={{ fontFamily:"'Inter', sans-serif", color:"rgba(255,255,255,0.3)", fontSize:"0.6rem" }}>{timeAgo(approval.created_at)}</span>
        </div>
        <div style={{ padding:"0.875rem 1rem" }}>
          {approval.task_brief && (
            <p style={{ fontFamily:"'Montserrat', sans-serif", color:"rgba(212,175,55,0.7)", fontSize:"0.58rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:"0.5rem" }}>{approval.task_brief}</p>
          )}
          {editingId === approval.id ? (
            <textarea value={editText} onChange={e => setEditText(e.target.value)}
              style={{ width:"100%", minHeight:120, background:"#FFFFFF", border:"1px solid rgba(212,175,55,0.4)", borderRadius:6, color:"#0A2342", fontFamily:"'Inter', sans-serif", fontSize:"0.75rem", padding:"0.5rem", lineHeight:1.6, resize:"vertical" as const, boxSizing:"border-box" as const, outline:"none" }} />
          ) : (() => {
            const fullText = approval.edited_output || approval.output;
            const isExpanded = expandedIds.has(approval.id);
            const needsTruncation = fullText.length > 500;
            const shown = isExpanded || !needsTruncation ? fullText : fullText.slice(0, 500) + '...';
            return (
              <>
                <div>{renderDraft(shown)}</div>
                {needsTruncation && (
                  <button onClick={() => toggleExpand(approval.id)}
                    style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem", fontWeight:700, color:"#D4AF37", background:"none", border:"none", cursor:"pointer", padding:0, marginTop:"0.25rem", letterSpacing:"0.06em" }}>
                    {isExpanded ? "Show Less ↑" : "View Full ↓"}
                  </button>
                )}
              </>
            );
          })()}
        </div>
        <div style={{ padding:"0 1rem 0.875rem", display:"flex", justifyContent:"flex-end", gap:"0.5rem" }}>
          {editingId === approval.id ? (
            <>
              <button onClick={handleEditCancel}
                style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(10,35,66,0.2)", background:"transparent", color:"rgba(10,35,66,0.5)", letterSpacing:"0.06em" }}>
                Cancel
              </button>
              <button onClick={() => handleEditSave(approval.id)} disabled={saving === approval.id}
                style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"none", background:"#D4AF37", color:"#0A2342", letterSpacing:"0.06em", opacity:saving === approval.id ? 0.6 : 1 }}>
                {saving === approval.id ? "Saving..." : "Save"}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => handleEditStart(approval)}
                style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(212,175,55,0.4)", background:"transparent", color:"#D4AF37", letterSpacing:"0.06em" }}>
                Edit
              </button>
              <button onClick={() => handleCopy(approval)}
                style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(10,35,66,0.2)", background:copiedId === approval.id ? "rgba(76,175,80,0.1)" : "transparent", color:copiedId === approval.id ? "#4CAF50" : "rgba(10,35,66,0.6)", letterSpacing:"0.06em" }}>
                {copiedId === approval.id ? "✓ Copied" : "Copy"}
              </button>
              <button onClick={() => handleRestore(approval.id, approval.category)} disabled={restoring === approval.id}
                style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(10,35,66,0.15)", background:"transparent", color:"rgba(10,35,66,0.4)", letterSpacing:"0.06em", opacity:restoring === approval.id ? 0.5 : 1 }}>
                {restoring === approval.id ? "Restoring..." : "Restore to Queue"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ flex:1, padding:"2rem 1.5rem", maxWidth:1100, margin:"0 auto", width:"100%" }}>

        {/* Header */}
        <div style={{ marginBottom:"1.5rem", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap" as const, gap:"1rem" }}>
          <div>
            <h1 style={{ fontFamily:"'Playfair Display', serif", color:"#0A2342", fontSize:"1.75rem", fontWeight:700, lineHeight:1.2, marginBottom:"0.2rem" }}>Archived Queue</h1>
            <p style={{ color:"rgba(10,35,66,0.45)", fontFamily:"'Inter', sans-serif", fontSize:"0.75rem" }}>
              {readyToUse.length} items ready to use — restore any item to move it back to the active queue
            </p>
          </div>
          <div onClick={() => window.location.href = "/admin-approvals"}
            style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.72rem", fontWeight:700, color:"#D4AF37", border:"1px solid rgba(212,175,55,0.35)", borderRadius:8, padding:"0.6rem 1.25rem", letterSpacing:"0.06em", cursor:"pointer" }}>
            ← Back to Intelligence Dashboard
          </div>
        </div>

        {/* Stat — Ready to Use only */}
        <div style={{ marginBottom:"1.5rem" }}>
          <div style={{ background:"#FFFFFF", border:"1px solid rgba(10,35,66,0.1)", borderRadius:10, padding:"0.875rem 1rem", display:"inline-block", minWidth:160 }}>
            <p style={{ fontFamily:"'Playfair Display', serif", color:"#D4AF37", fontSize:"1.75rem", fontWeight:700, margin:0 }}>{readyToUse.length}</p>
            <p style={{ fontFamily:"'Montserrat', sans-serif", color:"rgba(10,35,66,0.45)", fontSize:"0.62rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, margin:"4px 0 0" }}>Ready to Use</p>
          </div>
        </div>

        {/* Filter Pills — Ready to Use items only */}
        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.25rem", flexWrap:"wrap" as const }}>
          {[
            { key:"client_delivery",  label:"Client Delivery",  count: readyToUse.filter(a => a.category === "client_delivery" || (a.category === "content_review" && a.division === "Client Delivery")).length },
            { key:"customer_support", label:"Customer Support", count: readyToUse.filter(a => a.category === "customer_support").length },
            { key:"marketing",        label:"Marketing",        count: readyToUse.filter(a => a.category === "marketing" || (a.category === "content_review" && a.division === "Marketing")).length },
            { key:"content_brand",    label:"Content & Brand",  count: readyToUse.filter(a => a.category === "content_brand").length },
            { key:"grants",           label:"Grants",           count: readyToUse.filter(a => a.category === "grants").length },
            { key:"social_media",     label:"Social Media",     count: readyToUse.filter(a => a.category === "social" && SOCIAL_MEDIA_PLATFORMS.has(a.platform ?? '')).length },
            { key:"design",           label:"Design",           count: readyToUse.filter(a => a.platform === "Design").length },
            { key:"copy",             label:"Copy",             count: readyToUse.filter(a => a.platform === "Copy").length },
            { key:"course",           label:"Course",           count: readyToUse.filter(a => a.platform === "Course").length },
            { key:"video",            label:"Video",            count: readyToUse.filter(a => a.platform === "Video").length },
            { key:"proposal",         label:"Proposal",         count: readyToUse.filter(a => a.platform === "Proposal").length },
          ].filter(pill => pill.count > 0).map(pill => (
            <button key={pill.key} onClick={() => setActiveFilter(prev => prev === pill.key ? "all" : pill.key)} style={tabStyle(activeFilter === pill.key)}>
              {pill.label} ({pill.count})
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign:"center" as const, padding:"3rem", color:"rgba(10,35,66,0.4)", fontFamily:"'Montserrat', sans-serif", fontSize:"0.75rem" }}>
            LOADING ARCHIVE...
          </div>
        )}

        {/* Grant Application Drafts — own section by category, not status, so
            any grant card (whatever its status) always has a real home here. */}
        {!loading && grantItems.length > 0 && (
          <div style={{ marginBottom:"1.25rem" }}>
            <button
              onClick={() => setGrantsOpen(prev => !prev)}
              style={{ width:"100%", background:"rgba(212,175,55,0.06)", border:"1px solid rgba(212,175,55,0.25)", borderRadius:10, padding:"1rem 1.25rem", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", fontFamily:"'Montserrat', sans-serif" }}>
              <span style={{ fontSize:"0.72rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, color:"#8A6E1A" }}>
                Grant Application Drafts ({grantItems.length})
              </span>
              <span style={{ color:"rgba(212,175,55,0.6)", fontSize:"0.75rem" }}>{grantsOpen ? "▲" : "▼"}</span>
            </button>
            {grantsOpen && (
              <div style={{ display:"flex", flexDirection:"column" as const, gap:"0.75rem", marginTop:"0.75rem" }}>
                {grantItems.map(approval => renderCard(approval))}
              </div>
            )}
          </div>
        )}

        {/* Archived section — read items, collapsible */}
        {!loading && readItems.length > 0 && (
          <div style={{ marginBottom:"1.25rem" }}>
            <button
              onClick={() => setArchivedOpen(prev => !prev)}
              style={{ width:"100%", background:"rgba(10,35,66,0.04)", border:"1px solid rgba(10,35,66,0.1)", borderRadius:10, padding:"1rem 1.25rem", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", fontFamily:"'Montserrat', sans-serif" }}>
              <span style={{ fontSize:"0.72rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, color:"rgba(10,35,66,0.5)" }}>
                Archived ({readItems.length})
              </span>
              <span style={{ color:"rgba(10,35,66,0.4)", fontSize:"0.75rem" }}>{archivedOpen ? "▲" : "▼"}</span>
            </button>
            {archivedOpen && (
              <div style={{ display:"flex", flexDirection:"column" as const, gap:"0.75rem", marginTop:"0.75rem" }}>
                {readItems.map(approval => renderCard(approval))}
              </div>
            )}
          </div>
        )}

        {/* Ready to Use items */}
        {!loading && (
          <div style={{ display:"flex", flexDirection:"column" as const, gap:"0.75rem", marginBottom:"2rem" }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign:"center" as const, padding:"3rem", color:"rgba(10,35,66,0.3)", fontFamily:"'Inter', sans-serif", fontSize:"0.85rem" }}>
                {activeFilter === "all" ? "No items ready to use" : `No items in ${CATEGORY_LABELS[activeFilter] ?? activeFilter}`}
              </div>
            ) : (
              filtered.map(approval => renderCard(approval))
            )}
          </div>
        )}

        {/* Rejected section — collapsible */}
        {!loading && rejectedItems.length > 0 && (
          <div style={{ marginBottom:"2rem" }}>
            <button
              onClick={() => setRejectedOpen(prev => !prev)}
              style={{ width:"100%", background:"rgba(194,24,91,0.04)", border:"1px solid rgba(194,24,91,0.15)", borderRadius:10, padding:"1rem 1.25rem", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", fontFamily:"'Montserrat', sans-serif" }}>
              <span style={{ fontSize:"0.72rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, color:"rgba(194,24,91,0.6)" }}>
                Rejected ({rejectedItems.length})
              </span>
              <span style={{ color:"rgba(194,24,91,0.4)", fontSize:"0.75rem" }}>{rejectedOpen ? "▲" : "▼"}</span>
            </button>
            {rejectedOpen && (
              <div style={{ display:"flex", flexDirection:"column" as const, gap:"0.75rem", marginTop:"0.75rem" }}>
                {rejectedItems.map(approval => renderCard(approval))}
              </div>
            )}
          </div>
        )}

        <footer style={{ textAlign:"center" as const, padding:"1.5rem 0 0.5rem", color:"rgba(10,35,66,0.3)", fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem" }}>
          © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
        </footer>
      </main>
    </AdminLayout>
  );
}
