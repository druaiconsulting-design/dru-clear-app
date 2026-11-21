import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import AdminLayout from "../components/AdminLayout";
import SdReportCard from "../components/SdReportCard";

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
  platform: string | null; source: string; archived: boolean; context: string | null;
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
  daily_briefing:"Daily Briefing", business_outlook_corrections:"Business Outlook Corrections", revenue_growth:"Revenue & Growth",
  content_brand:"Content & Brand", marketing:"Marketing",
  legal_finance:"Legal & Finance", ai_governance:"AI Governance",
  hr:"HR", client_delivery:"Client Delivery", customer_support:"Customer Support",
  social:"Social Media", email:"Email", proposal:"Proposal", content:"Content",
  grants:"Grants", other:"Other",
};

// Support Tickets closed on the Support Tickets page land here.
interface ClosedTicket { id: string; created_at: string; member_name: string | null; member_email: string | null; question: string | null; source_address: string | null; }
interface TicketCard {
  id: string; status: string; source: string | null; output: string; edited_output: string | null; context: string | null;
  agent_name: string | null; agent_role: string | null; division: string | null; title: string | null;
  task_brief: string | null; original_content: string | null; ghl_contact_id: string | null;
}

function ticketIdFromCard(card: TicketCard): string {
  try { return String(JSON.parse(card.context ?? "{}").support_request_id ?? ""); } catch { return ""; }
}

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
  if (approval.category === "business_outlook_corrections") return { text: "Business Outlook Corrections", color: "#D4AF37" };
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
  const [readyToUseOpen, setReadyToUseOpen] = useState(false);
  const [reportsOpen, setReportsOpen]     = useState(false);
  const [ticketsOpen, setTicketsOpen]     = useState(false);
  const [closedTickets, setClosedTickets] = useState<ClosedTicket[]>([]);
  const [ticketCards, setTicketCards]     = useState<TicketCard[]>([]);
  const [openTicketIds, setOpenTicketIds] = useState<Set<string>>(new Set());
  const [agentPhotoByName, setAgentPhotoByName] = useState<Record<string, string>>({});

  const fetchArchived = async () => {
    const { data, error } = await supabase
      .from("approvals")
      .select("*")
      .eq("archived", true)
      .or("category.is.null,category.neq.support_reply")
      .or("status.in.(ready_to_use,read,rejected,needs_your_input),category.eq.sd_report")
      .order("created_at", { ascending: false });
    if (error) console.error("Failed to fetch archived:", error);
    else setApprovals((data as Approval[]) || []);
    setLoading(false);
  };

  // Agent photos come live from the agents table (same source the active queue uses).
  const fetchAgentPhotos = async () => {
    const { data, error } = await supabase.from("agents").select("name, photo_url");
    if (error || !data) return;
    const byName: Record<string, string> = {};
    data.forEach((a: any) => { if (a.photo_url && a.name) byName[a.name] = a.photo_url; });
    setAgentPhotoByName(byName);
  };

  const fetchClosedTickets = async () => {
    const [t, c] = await Promise.all([
      supabase.from("support_requests").select("id,created_at,member_name,member_email,question,source_address").eq("category", "email").eq("status", "closed").order("created_at", { ascending: false }).limit(300),
      supabase.from("approvals").select("id,status,source,output,edited_output,context,agent_name,agent_role,division,title,task_brief,original_content,ghl_contact_id").eq("category", "support_reply").order("created_at", { ascending: false }).limit(600),
    ]);
    if (!t.error) setClosedTickets((t.data as ClosedTicket[]) ?? []);
    if (!c.error) setTicketCards((c.data as TicketCard[]) ?? []);
  };

  useEffect(() => { fetchArchived(); fetchAgentPhotos(); fetchClosedTickets(); }, []);

  // Grant Application Drafts get their own bucket by category, not status --
  // Sept 1, 2026 fix. A grant card can carry a status this page never knew
  // about (needs_your_input) and previously had nowhere to render at all once
  // archived. Grouping by category instead means any grant card, whatever its
  // status, always has a real, findable home. Excluded from readItems/
  // rejectedItems below so a grant card never shows twice.
  // SD/ED Reports get their own banner by category too (Oct 27, 2026): a sent
  // report's card is archived by the database the moment its status becomes
  // "sent", and it is excluded from the other lists so it never shows twice.
  const readyToUse    = approvals.filter(a => a.status === "ready_to_use" && a.category !== "sd_report");
  const readItems     = approvals.filter(a => a.status === "read" && a.category !== "grant_applications" && a.category !== "sd_report");
  const rejectedItems = approvals.filter(a => a.status === "rejected" && a.category !== "grant_applications" && a.category !== "sd_report");
  const grantItems    = approvals.filter(a => a.category === "grant_applications");
  const reportItems   = approvals.filter(a => a.category === "sd_report");

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

  // Restoring a ticket always puts it back in Waiting on you. A reply that was already sent comes back as a
  // new draft holding that same reply (marked as restored), so it can be edited and sent as a follow-up.
  // The sent reply stays on record. A draft that was waiting returns as it was; a ticket with no reply returns empty.
  const restoreTicket = async (ticket: ClosedTicket) => {
    setRestoring(ticket.id);
    const card = ticketCards.find(c => ticketIdFromCard(c) === ticket.id);
    let status = "open";
    if (card?.status === "approved") {
      let ctx: Record<string, unknown> = {};
      try { ctx = JSON.parse(card.context ?? "{}"); } catch { /* keep empty */ }
      const { error } = await supabase.from("approvals").insert({
        source: "support_email",
        trigger_type: "support_email_reply",
        agent_name: card.agent_name,
        agent_role: card.agent_role,
        division: card.division,
        task_brief: card.task_brief,
        original_content: card.original_content,
        output: card.edited_output || card.output,
        status: "pending",
        notify_deanna: false,
        priority: "high",
        category: "support_reply",
        platform: null,
        title: card.title,
        ghl_contact_id: card.ghl_contact_id,
        context: JSON.stringify({ ...ctx, correction_note: null, restored_from: card.id }),
      });
      if (error) { console.error("Restore could not make the draft:", error); setRestoring(null); return; }
      status = "awaiting_approval";
    } else if (card?.status === "closed") {
      await supabase.from("approvals").update({ status: "pending" }).eq("id", card.id);
      status = "awaiting_approval";
    }
    await supabase.from("support_requests").update({ status }).eq("id", ticket.id);
    setClosedTickets(prev => prev.filter(t => t.id !== ticket.id));
    setRestoring(null);
    window.dispatchEvent(new Event("support-tickets-changed"));
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

        {/* Support Tickets — tickets closed on the Support Tickets page. */}
        {!loading && closedTickets.length > 0 && (
          <div style={{ marginBottom:"1.25rem" }}>
            <button
              onClick={() => setTicketsOpen(prev => !prev)}
              style={{ width:"100%", background:"rgba(212,175,55,0.06)", border:"1px solid rgba(212,175,55,0.25)", borderRadius:10, padding:"1rem 1.25rem", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", fontFamily:"'Montserrat', sans-serif" }}>
              <span style={{ fontSize:"0.72rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, color:"#8A6E1A" }}>
                Support Tickets ({closedTickets.length})
              </span>
              <span style={{ color:"rgba(212,175,55,0.6)", fontSize:"0.75rem" }}>{ticketsOpen ? "▲" : "▼"}</span>
            </button>
            {ticketsOpen && (
              <div style={{ display:"flex", flexDirection:"column" as const, gap:"0.75rem", marginTop:"0.75rem" }}>
                {closedTickets.map(ticket => {
                  const q = ticket.question ?? "";
                  const m = q.match(/^Subject:\s*(.*)\n/);
                  const subject = (m?.[1] ?? "").trim() || "(no subject)";
                  const message = m ? q.slice(m[0].length).trim() : q.trim();
                  const sender = ticket.member_name ? `${ticket.member_name} <${ticket.member_email}>` : (ticket.member_email ?? "");
                  const card = ticketCards.find(c => ticketIdFromCard(c) === ticket.id);
                  const reply = card && card.status === "approved" ? (card.edited_output || card.output) : null;
                  const open = openTicketIds.has(ticket.id);
                  return (
                    <div key={ticket.id} style={{ background:"#FFFFFF", border:"1px solid rgba(10,35,66,0.12)", borderLeft:"4px solid rgba(10,35,66,0.25)", borderRadius:10, padding:"0.9rem 1.1rem" }}>
                      <div onClick={() => setOpenTicketIds(prev => { const next = new Set(prev); if (next.has(ticket.id)) next.delete(ticket.id); else next.add(ticket.id); return next; })}
                        style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"0.75rem", flexWrap:"wrap" as const, cursor:"pointer" }}>
                        <div>
                          <div style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.85rem", fontWeight:700, color:"#0A2342" }}>{subject}</div>
                          <div style={{ fontFamily:"'Inter', sans-serif", fontSize:"0.7rem", color:"rgba(10,35,66,0.5)" }}>{sender} · {timeAgo(ticket.created_at)}</div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); restoreTicket(ticket); }} disabled={restoring === ticket.id}
                          style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(10,35,66,0.15)", background:"transparent", color:"rgba(10,35,66,0.4)", letterSpacing:"0.06em", opacity:restoring === ticket.id ? 0.5 : 1 }}>
                          {restoring === ticket.id ? "Restoring..." : "Restore"}
                        </button>
                      </div>
                      {open && (
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:"0.9rem", marginTop:"0.9rem" }}>
                          <div style={{ background:"rgba(10,35,66,0.04)", borderRadius:8, padding:"0.9rem" }}>
                            <div style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" as const, color:"rgba(10,35,66,0.5)", marginBottom:"0.4rem" }}>Customer's Email</div>
                            <div style={{ fontFamily:"'Inter', sans-serif", fontSize:"0.78rem", lineHeight:1.6, color:"rgba(10,35,66,0.8)", whiteSpace:"pre-wrap" as const }}>{message}</div>
                          </div>
                          <div style={{ background:"rgba(45,90,142,0.06)", borderRadius:8, padding:"0.9rem" }}>
                            <div style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" as const, color:"#2D5A8E", marginBottom:"0.4rem" }}>{reply ? "Reply Sent" : "Reply"}</div>
                            <div style={{ fontFamily:"'Inter', sans-serif", fontSize:"0.78rem", lineHeight:1.6, color:"rgba(10,35,66,0.8)", whiteSpace:"pre-wrap" as const }}>{reply ?? "No reply was sent for this ticket."}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SD/ED Reports — sent reports, own section by category. The report
            itself is locked once approved, so each card opens the locked report
            and offers Restore to Queue like every other archived item. */}
        {!loading && reportItems.length > 0 && (
          <div style={{ marginBottom:"1.25rem" }}>
            <button
              onClick={() => setReportsOpen(prev => !prev)}
              style={{ width:"100%", background:"rgba(212,175,55,0.06)", border:"1px solid rgba(212,175,55,0.25)", borderRadius:10, padding:"1rem 1.25rem", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", fontFamily:"'Montserrat', sans-serif" }}>
              <span style={{ fontSize:"0.72rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, color:"#8A6E1A" }}>
                SD/ED Reports ({reportItems.length})
              </span>
              <span style={{ color:"rgba(212,175,55,0.6)", fontSize:"0.75rem" }}>{reportsOpen ? "▲" : "▼"}</span>
            </button>
            {reportsOpen && (
              <div style={{ display:"flex", flexDirection:"column" as const, gap:"0.75rem", marginTop:"0.75rem" }}>
                {reportItems.map(approval => (
                  <div key={approval.id}>
                    <SdReportCard approval={approval} photo={agentPhotoByName[approval.agent_name]} />
                    <div style={{ display:"flex", justifyContent:"flex-end", marginTop:"0.4rem" }}>
                      <button onClick={() => handleRestore(approval.id, approval.category)} disabled={restoring === approval.id}
                        style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(10,35,66,0.15)", background:"transparent", color:"rgba(10,35,66,0.4)", letterSpacing:"0.06em", opacity:restoring === approval.id ? 0.5 : 1 }}>
                        {restoring === approval.id ? "Restoring..." : "Restore to Queue"}
                      </button>
                    </div>
                  </div>
                ))}
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

        {/* Ready to Use section — collapsible, matches Grant/Archived/Rejected pattern */}
        {!loading && readyToUse.length > 0 && (
          <div style={{ marginBottom:"1.25rem" }}>
            <button
              onClick={() => setReadyToUseOpen(prev => !prev)}
              style={{ width:"100%", background:"rgba(212,175,55,0.06)", border:"1px solid rgba(212,175,55,0.25)", borderRadius:10, padding:"1rem 1.25rem", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", fontFamily:"'Montserrat', sans-serif" }}>
              <span style={{ fontSize:"0.72rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, color:"#8A6E1A" }}>
                Ready to Use ({readyToUse.length})
              </span>
              <span style={{ color:"rgba(212,175,55,0.6)", fontSize:"0.75rem" }}>{readyToUseOpen ? "▲" : "▼"}</span>
            </button>
            {readyToUseOpen && (
              <div style={{ marginTop:"0.75rem" }}>
                {/* Filter Pills — Ready to Use items only */}
                <div style={{ display:"flex", gap:"0.5rem", marginBottom:"0.75rem", flexWrap:"wrap" as const }}>
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
                <div style={{ display:"flex", flexDirection:"column" as const, gap:"0.75rem" }}>
                  {filtered.length === 0 ? (
                    <div style={{ textAlign:"center" as const, padding:"3rem", color:"rgba(10,35,66,0.3)", fontFamily:"'Inter', sans-serif", fontSize:"0.85rem" }}>
                      {activeFilter === "all" ? "No items ready to use" : `No items in ${CATEGORY_LABELS[activeFilter] ?? activeFilter}`}
                    </div>
                  ) : (
                    filtered.map(approval => renderCard(approval))
                  )}
                </div>
              </div>
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
                Corrective Feedback ({rejectedItems.length})
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
