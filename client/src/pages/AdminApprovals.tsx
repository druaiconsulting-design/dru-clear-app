// client/src/pages/AdminApprovals.tsx
// Admin · Page 3 · Intelligence Hub & Approval Queue
// Knowledge cards: Read ✓ (archive) — division briefings, design briefs, etc.
// Approval cards: Approve/Reject/Edit — social posts, CC replies, upsell outreach
// CHANGES:
// - Removed All tab (redundant with Knowledge tab)
// - Revenue, Growth & Sales: merged revenue_growth + division_briefing under one tab
// - Social cards: Contributors shown for ALL social cards (not just creative platforms)
// - Conversation persistence: saved to approvals.context, restored on reopen
// - Community Connection: community_post category treated as Approval card → posts to community
// - DIVISION_COLORS key fixed to match actual division name

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
  id: string; created_at: string; source: string; trigger_type: string;
  agent_name: string; agent_role: string; division: string; task_brief: string;
  original_content: string; output: string; edited_output: string | null;
  status: ApprovalStatus; ghl_contact_id: string | null; notify_deanna: boolean;
  priority: Priority; category: string; platform: string | null;
  context: string | null; archived: boolean;
}

interface FlaggedComment {
  id: string; post_id: string; member_id: string | null;
  content: string; created_at: string;
  profiles?: { first_name?: string | null } | null;
  community_posts?: { title?: string | null } | null;
}

interface ConversationMessage { role: 'user' | 'agent'; agentName?: string; text: string; }

interface QuestionState {
  open: boolean;
  selectedAgent: { agent_id: string; agent_name: string; role: string } | null;
  input: string; messages: ConversationMessage[]; loading: boolean;
}

const LEAD_DIRECTIONS = [
  { value: "assessment_invite", label: "Assessment Invite" },
  { value: "follow_up_email",   label: "Follow-up Email" },
  { value: "follow_up_sms",     label: "Follow-up SMS" },
  { value: "assign_task",       label: "Assign Task — Follow Up" },
  { value: "nurture",           label: "Add to Nurture" },
];

const PDF_CATEGORIES = new Set([
  "presentation_design","course_architecture","video_production",
  "creative_direction","client_onboarding","feedback_coaching",
  "community_management","client_delivery",
]);

// Cards that gate a publishing/outreach action — full Approve/Reject/Edit
const APPROVAL_CATEGORIES = new Set([
  "social", "community_comment_reply", "cc_upsell_outreach",
  "CC Post Triggers", "lead_intelligence", "community_post",
]);

const PLATFORM_COLORS: Record<string, string> = {
  LinkedIn:"#0077B5", Instagram:"#C2185B", Facebook:"#1877F2", Email:"#D4AF37",
  General:"#0A2342", X:"#14171A", TikTok:"#010101", YouTube:"#FF0000",
  Pinterest:"#E60023", Content:"#163D6E", Press:"#8A6E1A", Design:"#7A0F38",
  Localization:"#A68920", Copy:"#E0527E", Outreach:"#2E6DAB",
  Community:"#2D5A8E",
};

// Key must match actual division name from approvals table
const DIVISION_COLORS: Record<string, string> = {
  "Revenue, Growth & Sales":"#D4AF37", "Content & Brand":"#C2185B", "Marketing":"#163D6E",
  "Legal & Finance":"#8A6E1A", "AI Governance":"#7A0F38", "HR":"#2E6DAB",
  "Client Delivery":"#A68920", "Customer Support":"#C2185B", "Command":"#0A2342",
  "Community Connection":"#2D5A8E",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  URGENT:"#C2185B", HIGH:"#D4AF37", NORMAL:"rgba(255,255,255,0.3)",
};

const CATEGORY_LABELS: Record<string, string> = {
  daily_briefing:"Daily Briefing",
  // Both revenue_growth and division_briefing map to same label — merged in UI
  revenue_growth:"Revenue, Growth & Sales",
  division_briefing:"Revenue, Growth & Sales",
  content_brand:"Content & Brand", marketing:"Marketing",
  legal_finance:"Legal & Finance", ai_governance:"AI Governance",
  hr:"HR", client_delivery:"Client Delivery", customer_support:"Customer Support",
  social:"Social Media", email:"Email", proposal:"Proposal", content:"Content",
  community_connection:"Community Connection", community_post:"CC Post",
  other:"Other",
  community_comment_reply:"CC Agent Reply", "CC Post Triggers":"CC Policy Violation",
  cc_upsell_outreach:"CC Upsell Signal",
};

// division_briefing intentionally excluded — merged under revenue_growth tab
const CATEGORY_ORDER = [
  "daily_briefing","revenue_growth","content_brand","marketing",
  "legal_finance","ai_governance","hr","client_delivery","customer_support",
  "community_connection","community_post","social","email","proposal","content","other",
  "community_comment_reply","CC Post Triggers","cc_upsell_outreach",
];

const DIVISION_AGENTS: Record<string, { agent_id: string; agent_name: string; role: string }[]> = {
  "Revenue, Growth & Sales": [
    { agent_id:"omar",    agent_name:"Omar Patel",       role:"Lead Scoring" },
    { agent_id:"ryan",    agent_name:"Ryan Nakamura",    role:"CRM Management" },
    { agent_id:"serena",  agent_name:"Serena Jackson",   role:"Business Coach" },
    { agent_id:"mateo",   agent_name:"Mateo Gonzalez",   role:"Sales Support" },
    { agent_id:"aaliyah", agent_name:"Aaliyah Foster",   role:"Outreach" },
    { agent_id:"jaylen",  agent_name:"Jaylen Brooks",    role:"Email Marketing" },
    { agent_id:"chloe",   agent_name:"Chloe Dubois",     role:"Copy Writer" },
    { agent_id:"zara",    agent_name:"Zara Ahmed",       role:"Product Launch" },
    { agent_id:"elena",   agent_name:"Elena Vasquez",    role:"Product Knowledge" },
    { agent_id:"kwame",   agent_name:"Kwame Asante",     role:"Proposal Writer" },
  ],
  "Content & Brand": [
    { agent_id:"camila",  agent_name:"Camila Flores",    role:"Social Media Strategist" },
    { agent_id:"darius",  agent_name:"Darius King",      role:"Viral Scripter" },
    { agent_id:"ravi",    agent_name:"Ravi Gupta",       role:"Graphic Designer" },
    { agent_id:"yara",    agent_name:"Yara Mansour",     role:"Translator" },
    { agent_id:"ingrid",  agent_name:"Ingrid Larsen",    role:"Press Release" },
  ],
  "Marketing": [
    { agent_id:"nia",     agent_name:"Nia Robinson",     role:"Content Creation" },
    { agent_id:"luca",    agent_name:"Luca Romano",      role:"Digital Marketing" },
    { agent_id:"hyunji",  agent_name:"Hyun-Ji Kim",      role:"Analytics & ROI" },
    { agent_id:"andre",   agent_name:"Andre Mitchell",   role:"SEO/SEM" },
  ],
  "Legal & Finance": [
    { agent_id:"amara",   agent_name:"Amara Okafor",     role:"Legal Advisor" },
    { agent_id:"diego",   agent_name:"Diego Reyes",      role:"Expense Manager" },
    { agent_id:"yuki",    agent_name:"Yuki Tanaka",      role:"Financial Reporting" },
    { agent_id:"marcus",  agent_name:"Marcus Chen",      role:"Tax Strategist" },
  ],
  "AI Governance": [
    { agent_id:"isabella", agent_name:"Isabella Moreno", role:"Director of Compliance" },
    { agent_id:"khalid",   agent_name:"Khalid Hassan",   role:"Disclaimer Writer" },
    { agent_id:"sofia",    agent_name:"Sofia Petrov",    role:"Privacy Policy" },
    { agent_id:"james",    agent_name:"James Osei",      role:"Contract Writer" },
    { agent_id:"meilin",   agent_name:"Mei Lin",         role:"Brand Protection" },
    { agent_id:"rafael",   agent_name:"Rafael Torres",   role:"Continuous Learning" },
  ],
  "HR": [
    { agent_id:"naomi",   agent_name:"Naomi Williams",   role:"Recruiting" },
    { agent_id:"aiden",   agent_name:"Aiden Park",       role:"Onboarding" },
    { agent_id:"fatima",  agent_name:"Fatima Al-Rashid", role:"Internal Helpdesk" },
  ],
  "Client Delivery": [
    { agent_id:"keisha",  agent_name:"Keisha Thompson",  role:"Onboarding Coach" },
    { agent_id:"marco",   agent_name:"Marco Silva",      role:"Community Manager" },
    { agent_id:"leila",   agent_name:"Leila Nasser",     role:"Feedback Coach" },
    { agent_id:"jordan",  agent_name:"Jordan Hayes",     role:"Creative Director" },
    { agent_id:"simone",  agent_name:"Simone Laurent",   role:"Course Architect" },
    { agent_id:"theo",    agent_name:"Theo Nguyen",      role:"Presentation Designer" },
    { agent_id:"amelia",  agent_name:"Amelia Santos",    role:"Training Video Producer" },
  ],
  "Customer Support": [
    { agent_id:"isaiah",    agent_name:"Isaiah Carter",     role:"Issue Resolution" },
    { agent_id:"priscilla", agent_name:"Priscilla Okonkwo", role:"Multi-Channel Communication" },
  ],
  "Command": [
    { agent_id:"twin", agent_name:"DeAnna's AI Twin", role:"Master Orchestrator" },
  ],
  "Community Connection": [
    { agent_id:"dominique", agent_name:"Dominique",  role:"DRU CLEAR™ Insights" },
    { agent_id:"elijah",    agent_name:"Elijah",      role:"Framework Lesson" },
    { agent_id:"solange",   agent_name:"Solange",     role:"Action Challenge" },
    { agent_id:"isaiah_webb",agent_name:"Isaiah Webb",role:"5D Leadership™" },
    { agent_id:"nadia",     agent_name:"Nadia",       role:"Strategic Edge" },
    { agent_id:"victor",    agent_name:"Victor",      role:"Community Engagement" },
    { agent_id:"sasha",     agent_name:"Sasha",       role:"AI Sales Mastery™" },
    { agent_id:"tariq",     agent_name:"Tariq",       role:"Sales Content" },
    { agent_id:"zoe",       agent_name:"Zoe Beaumont",role:"CC Division Leader" },
    { agent_id:"micah",     agent_name:"Micah Santos",role:"Member Experience" },
  ],
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function renderDraft(text: string) {
  return text.split('\n\n').map((para, i) => (
    <p key={i} style={{ margin:'0 0 0.75rem 0', fontFamily:"'Inter', sans-serif", color:'#FFFFFF', fontSize:'0.75rem', lineHeight:1.6 }}>
      {para.replace(/\n/g, ' ')}
    </p>
  ));
}

function isApprovalCard(approval: Approval): boolean {
  return APPROVAL_CATEGORIES.has(approval.category);
}

function getBadgeInfo(approval: Approval): { text: string; color: string } {
  if (approval.category === "social") {
    const platform = approval.platform ?? "Social";
    return { text: platform, color: PLATFORM_COLORS[platform] ?? "#0A2342" };
  }
  if (approval.category === "community_post")              return { text: "CC Post",            color: "#2D5A8E" };
  if (approval.category === "community_comment_reply")     return { text: "CC Agent Reply",     color: "#2D5A8E" };
  if (approval.category === "CC Post Triggers")            return { text: "CC Policy Violation",color: "#C2185B" };
  if (approval.category === "cc_upsell_outreach")          return { text: "CC Upsell Signal",   color: "#D4AF37" };
  if (approval.category === "daily_briefing")              return { text: "Daily Briefing",     color: "#D4AF37" };
  // revenue_growth AND division_briefing both get gold Revenue badge
  if (approval.category === "revenue_growth" || approval.category === "division_briefing")
    return { text: "Revenue, Growth & Sales", color: "#D4AF37" };
  // Other division cards — use division name + color
  if (approval.division && DIVISION_COLORS[approval.division])
    return { text: approval.division, color: DIVISION_COLORS[approval.division] };
  return { text: CATEGORY_LABELS[approval.category] ?? approval.category, color: "#0A2342" };
}

function getOriginalColumn(approval: Approval): { heading: string; content: string | null } {
  // ALL social cards show Contributors — agents generate content, there is no "original"
  if (approval.category === "social" || approval.category === "community_post") {
    return { heading: "Contributors", content: approval.task_brief || null };
  }
  if (approval.category === "daily_briefing")          return { heading: "Today's Date",    content: new Date(approval.created_at).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) };
  if (approval.category === "community_comment_reply") return { heading: "Post Reference",  content: approval.task_brief || null };
  if (approval.category === "CC Post Triggers")        return { heading: "Member Info",     content: approval.task_brief || null };
  if (approval.category === "cc_upsell_outreach")      return { heading: "Member & Signal", content: approval.task_brief || null };
  return { heading: "Contributors", content: approval.task_brief || null };
}

function getDraftHeading(approval: Approval): string {
  if (approval.category === "social")                  return `${approval.agent_name}'s Draft`;
  if (approval.category === "community_post")          return `${approval.agent_name}'s Post`;
  if (approval.category === "daily_briefing")          return "Daily Briefing";
  if (approval.category === "community_comment_reply") return "Agent Reply";
  if (approval.category === "CC Post Triggers")        return "Violation Report";
  if (approval.category === "cc_upsell_outreach")      return "Aaliyah Outreach Draft";
  return `${CATEGORY_LABELS[approval.category] ?? approval.division} Briefing`;
}

function getStatusText(approval: Approval, status: "posting" | "posted" | "failed"): string {
  if (approval.category === "lead_intelligence")       return status === "posted" ? "✓ Routed to GHL"       : status === "posting" ? "Routing..."         : "⚠ Route Failed";
  if (approval.division === "Client Delivery")         return status === "posted" ? "✓ PDF Downloaded"      : status === "posting" ? "Generating PDF..."   : "⚠ PDF Failed";
  if (approval.category === "community_comment_reply") return status === "posted" ? "✓ Comment Posted"      : status === "posting" ? "Posting..."          : "⚠ Post Failed";
  if (approval.category === "community_post")          return status === "posted" ? "✓ Posted to Community" : status === "posting" ? "Posting..."          : "⚠ Post Failed";
  if (approval.category === "cc_upsell_outreach")      return status === "posted" ? "✓ Outreach Sent"       : status === "posting" ? "Sending..."          : "⚠ Send Failed";
  return status === "posted" ? "✓ Posted" : status === "posting" ? "Posting..." : "⚠ Post Failed";
}
export default function AdminApprovals() {
  const [approvals, setApprovals]             = useState<Approval[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [activeFilter, setActiveFilter]       = useState<string>("knowledge");
  const [editingId, setEditingId]             = useState<string | null>(null);
  const [editText, setEditText]               = useState("");
  const [saving, setSaving]                   = useState<string | null>(null);
  const [publishStatus, setPublishStatus]     = useState<Record<string, "posting" | "posted" | "failed">>({});
  const [leadDirection, setLeadDirection]     = useState<Record<string, string>>({});
  const [questions, setQuestions]             = useState<Record<string, QuestionState>>({});
  const [memberCounts, setMemberCounts]       = useState({ total: 0, navigator: 0, accelerator: 0 });
  const [flaggedComments, setFlaggedComments] = useState<FlaggedComment[]>([]);
  const [flaggedLoading, setFlaggedLoading]   = useState(true);
  const [savingComment, setSavingComment]     = useState<string | null>(null);

  const fetchApprovals = async () => {
    const { data, error } = await supabase.from("approvals").select("*").eq("archived", false).order("created_at", { ascending: false });
    if (error) console.error("Failed to fetch approvals:", error);
    else setApprovals((data as Approval[]) || []);
    setLoading(false);
  };

  const fetchMemberCounts = async () => {
    const { data } = await supabase.from("profiles").select("tier").in("tier", ["navigator", "accelerator"]);
    const nav = (data ?? []).filter((p: any) => p.tier === "navigator").length;
    const acc = (data ?? []).filter((p: any) => p.tier === "accelerator").length;
    setMemberCounts({ total: nav + acc, navigator: nav, accelerator: acc });
  };

  const fetchFlaggedComments = async () => {
    const { data } = await supabase
      .from("community_comments")
      .select("*, profiles(first_name), community_posts(title)")
      .eq("is_flagged", true).eq("is_active", true)
      .order("created_at", { ascending: false });
    setFlaggedComments((data as FlaggedComment[]) || []);
    setFlaggedLoading(false);
  };

  useEffect(() => {
    fetchApprovals();
    fetchMemberCounts();
    fetchFlaggedComments();
    const channel = supabase.channel("approvals-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, () => fetchApprovals())
      .subscribe();
    const commentsChannel = supabase.channel("flagged-comments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_comments" }, () => fetchFlaggedComments())
      .subscribe();
    return () => { supabase.removeChannel(channel); supabase.removeChannel(commentsChannel); };
  }, []);

  const downloadPDF = async (approval: Approval): Promise<boolean> => {
    try {
      const res = await fetch("/api/pdf-generator", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ output: approval.edited_output || approval.output, agent_name: approval.agent_name, task_brief: approval.task_brief, division: approval.division, category: approval.category, approval_id: approval.id }) });
      if (!res.ok) return false;
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `dru-ai-${(approval.category || "briefing").replace(/_/g, "-")}-${Date.now()}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      return true;
    } catch (err) { console.error("[pdf]", err); return false; }
  };

  const routeLead = async (approval: Approval, direction: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/lead-executor", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ approval_id: approval.id, output: approval.output, direction, agent_name: approval.agent_name }) });
      return res.ok;
    } catch (err) { console.error("[lead]", err); return false; }
  };

  const postCCComment = async (approval: Approval, content: string): Promise<boolean> => {
    const match  = (approval.task_brief || "").match(/post_id:([a-zA-Z0-9-]+)/);
    const postId = match?.[1];
    if (!postId) { console.error("[cc_reply] No post_id in task_brief:", approval.task_brief); return false; }
    const { error } = await supabase.from("community_comments").insert({
      post_id: postId, member_id: null, agent_name: approval.agent_name,
      content, is_flagged: false, is_active: true,
    });
    if (error) { console.error("[cc_reply] Insert failed:", error); return false; }
    return true;
  };

  // Post CC agent content directly to community_posts table
  const postToCommunity = async (approval: Approval, content: string): Promise<boolean> => {
    try {
      const lines  = content.split('\n').filter(l => l.trim());
      const title  = lines[0]?.replace(/^#+\s*/, '').slice(0, 120) || approval.task_brief || 'Community Post';
      const { error } = await supabase.from("community_posts").insert({
        title,
        content,
        agent_name:  approval.agent_name,
        division:    "Community Connection",
        category:    approval.trigger_type || approval.category,
        is_active:   true,
        min_tier:    "navigator",
      });
      if (error) { console.error("[community_post] Insert failed:", error); return false; }
      return true;
    } catch (err) { console.error("[community_post]", err); return false; }
  };

  const handleApprove = async (id: string) => {
    setSaving(id);
    const { error } = await supabase.from("approvals").update({ status: "approved" }).eq("id", id);
    if (error) { setSaving(null); return; }
    const approval = approvals.find(a => a.id === id);
    if (!approval) { setSaving(null); return; }
    const content = approval.edited_output || approval.output;
    if (approval.category === "social") {
      setPublishStatus(prev => ({ ...prev, [id]: "posting" }));
      try {
        const res = await fetch("/api/social-publisher", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ content, platform: approval.platform, approval_id: id }) });
        setPublishStatus(prev => ({ ...prev, [id]: res.ok ? "posted" : "failed" }));
      } catch { setPublishStatus(prev => ({ ...prev, [id]: "failed" })); }
    } else if (approval.category === "community_post") {
      setPublishStatus(prev => ({ ...prev, [id]: "posting" }));
      const ok = await postToCommunity(approval, content);
      setPublishStatus(prev => ({ ...prev, [id]: ok ? "posted" : "failed" }));
    } else if (approval.category === "lead_intelligence") {
      const direction = leadDirection[id] || "assessment_invite";
      setPublishStatus(prev => ({ ...prev, [id]: "posting" }));
      const ok = await routeLead(approval, direction);
      setPublishStatus(prev => ({ ...prev, [id]: ok ? "posted" : "failed" }));
    } else if (approval.category === "community_comment_reply") {
      setPublishStatus(prev => ({ ...prev, [id]: "posting" }));
      const ok = await postCCComment(approval, content);
      if (!ok) await supabase.from("approvals").update({ status: "pending" }).eq("id", id);
      setPublishStatus(prev => ({ ...prev, [id]: ok ? "posted" : "failed" }));
    } else if (approval.category === "cc_upsell_outreach") {
      setPublishStatus(prev => ({ ...prev, [id]: "posting" }));
      try {
        const emailMatch = (approval.task_brief || "").match(/Email:\s*([^\s|]+)/);
        const phoneMatch = (approval.task_brief || "").match(/Phone:\s*([^\s|]+)/);
        const res = await fetch("https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/AlZQHDN7D7PIvApW0qDF", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger_type:"cc_upsell_outreach", agent_name:"Aaliyah Foster", outreach_message: content, email: emailMatch?.[1] ?? "", phone: phoneMatch?.[1] ?? "", task_brief: approval.task_brief, approval_id: id }),
        });
        setPublishStatus(prev => ({ ...prev, [id]: res.ok ? "posted" : "failed" }));
      } catch { setPublishStatus(prev => ({ ...prev, [id]: "failed" })); }
    } else if (approval.division === "Client Delivery" || PDF_CATEGORIES.has(approval.category)) {
      setPublishStatus(prev => ({ ...prev, [id]: "posting" }));
      const ok = await downloadPDF(approval);
      setPublishStatus(prev => ({ ...prev, [id]: ok ? "posted" : "failed" }));
    }
    setSaving(null);
  };

  const handleReject  = async (id: string) => { setSaving(id); await supabase.from("approvals").update({ status:"rejected" }).eq("id", id); setSaving(null); };
  const handleArchive = async (id: string) => { setSaving(id); await supabase.from("approvals").update({ archived:true }).eq("id", id); setSaving(null); };
  const handleRead    = async (id: string) => { setSaving(id); await supabase.from("approvals").update({ archived:true, status:"approved" }).eq("id", id); setSaving(null); };

  const handleClearFlag     = async (id: string) => { setSavingComment(id); await supabase.from("community_comments").update({ is_flagged: false }).eq("id", id); setSavingComment(null); };
  const handleRemoveComment = async (id: string) => { setSavingComment(id); await supabase.from("community_comments").update({ is_active: false }).eq("id", id); setSavingComment(null); };

  const handleEditStart = (approval: Approval) => { setEditingId(approval.id); setEditText(approval.edited_output || approval.output); };
  const handleEditSave  = async (id: string) => {
    setSaving(id);
    await supabase.from("approvals").update({ edited_output: editText, status:"approved" }).eq("id", id);
    setEditingId(null);
    const approval = approvals.find(a => a.id === id);
    if (!approval) { setSaving(null); return; }
    if (approval.category === "social") {
      setPublishStatus(prev => ({ ...prev, [id]: "posting" }));
      try {
        const res = await fetch("/api/social-publisher", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ content: editText, platform: approval.platform, approval_id: id }) });
        setPublishStatus(prev => ({ ...prev, [id]: res.ok ? "posted" : "failed" }));
      } catch { setPublishStatus(prev => ({ ...prev, [id]: "failed" })); }
    } else if (approval.category === "community_post") {
      setPublishStatus(prev => ({ ...prev, [id]: "posting" }));
      const ok = await postToCommunity(approval, editText);
      setPublishStatus(prev => ({ ...prev, [id]: ok ? "posted" : "failed" }));
    } else if (approval.category === "lead_intelligence") {
      const direction = leadDirection[id] || "assessment_invite";
      setPublishStatus(prev => ({ ...prev, [id]: "posting" }));
      const ok = await routeLead(approval, direction);
      setPublishStatus(prev => ({ ...prev, [id]: ok ? "posted" : "failed" }));
    } else if (approval.category === "community_comment_reply") {
      setPublishStatus(prev => ({ ...prev, [id]: "posting" }));
      const ok = await postCCComment(approval, editText);
      setPublishStatus(prev => ({ ...prev, [id]: ok ? "posted" : "failed" }));
    } else if (approval.category === "cc_upsell_outreach") {
      setPublishStatus(prev => ({ ...prev, [id]: "posting" }));
      try {
        const emailMatch = (approval.task_brief || "").match(/Email:\s*([^\s|]+)/);
        const phoneMatch = (approval.task_brief || "").match(/Phone:\s*([^\s|]+)/);
        const res = await fetch("https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/AlZQHDN7D7PIvApW0qDF", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger_type:"cc_upsell_outreach", agent_name:"Aaliyah Foster", outreach_message: editText, email: emailMatch?.[1] ?? "", phone: phoneMatch?.[1] ?? "", task_brief: approval.task_brief, approval_id: id }),
        });
        setPublishStatus(prev => ({ ...prev, [id]: res.ok ? "posted" : "failed" }));
      } catch { setPublishStatus(prev => ({ ...prev, [id]: "failed" })); }
    } else if (approval.division === "Client Delivery" || PDF_CATEGORIES.has(approval.category)) {
      setPublishStatus(prev => ({ ...prev, [id]: "posting" }));
      const ok = await downloadPDF({ ...approval, edited_output: editText });
      setPublishStatus(prev => ({ ...prev, [id]: ok ? "posted" : "failed" }));
    }
    setSaving(null);
  };

  const getQS = (id: string): QuestionState => questions[id] ?? { open:false, selectedAgent:null, input:"", messages:[], loading:false };
  const setQS = (id: string, update: Partial<QuestionState>) => setQuestions(prev => ({ ...prev, [id]: { ...getQS(id), ...update } }));

  const toggleQuestion = (approval: Approval) => {
    const qs = getQS(approval.id);
    if (!qs.open) {
      // Restore saved conversation from approvals.context if it exists
      let savedMessages: ConversationMessage[] = [];
      if (approval.context) {
        try { savedMessages = JSON.parse(approval.context); } catch { savedMessages = []; }
      }
      const autoAgent = approval.category === "social"
        ? { agent_id: approval.source?.replace('_social','') ?? 'darius', agent_name: approval.agent_name, role: approval.agent_role }
        : approval.category === "community_post"
        ? { agent_id: approval.source?.replace('_cc','') ?? 'dominique', agent_name: approval.agent_name, role: 'CC Agent' }
        : approval.category === "daily_briefing"
        ? { agent_id:"twin", agent_name:"DeAnna's AI Twin", role:"Master Orchestrator" }
        : null;
      setQS(approval.id, { open:true, selectedAgent:autoAgent, messages: savedMessages });
    } else { setQS(approval.id, { open:false }); }
  };

  const handleAskQuestion = async (approval: Approval) => {
    const qs = getQS(approval.id);
    if (!qs.selectedAgent || !qs.input.trim()) return;
    const question    = qs.input.trim();
    const newMessages = [...qs.messages, { role:'user' as const, text:question }];
    setQS(approval.id, { messages:newMessages, input:"", loading:true });
    try {
      const res  = await fetch("/api/ask-agent", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ agent_id: qs.selectedAgent.agent_id, agent_name: qs.selectedAgent.agent_name, agent_role: qs.selectedAgent.role, question, card_output: approval.output, conversation_history: qs.messages }) });
      const data = await res.json();
      const reply = data.response ?? "Unable to respond. Please try again.";
      const updatedMessages: ConversationMessage[] = [...newMessages, { role:'agent', agentName:qs.selectedAgent.agent_name, text:reply }];
      setQS(approval.id, { messages: updatedMessages, loading:false });
      // Persist conversation to approvals.context so it survives page reload and approval
      await supabase.from("approvals").update({ context: JSON.stringify(updatedMessages) }).eq("id", approval.id);
    } catch {
      const failMessages: ConversationMessage[] = [...newMessages, { role:'agent', agentName:qs.selectedAgent?.agent_name, text:"Something went wrong. Please try again." }];
      setQS(approval.id, { messages: failMessages, loading:false });
    }
  };

  // Filtering — revenue_growth tab includes division_briefing cards (same division, merged)
  const presentCategories = [...new Set(approvals.map(a =>
    a.category === "division_briefing" ? "revenue_growth" : a.category
  ))];
  const orderedCategories   = CATEGORY_ORDER.filter(c => presentCategories.includes(c));
  const remainingCategories = presentCategories.filter(c => !CATEGORY_ORDER.includes(c));
  const allCategories       = [...orderedCategories, ...remainingCategories];

  const filtered = (() => {
    if (activeFilter === "knowledge") return approvals.filter(a => !isApprovalCard(a));
    if (activeFilter === "approvals") return approvals.filter(a => isApprovalCard(a));
    // revenue_growth tab shows both revenue_growth AND division_briefing cards
    if (activeFilter === "revenue_growth") return approvals.filter(a => a.category === "revenue_growth" || a.category === "division_briefing");
    return approvals.filter(a => a.category === activeFilter);
  })();

  // Counts — revenue_growth count includes division_briefing
  const getCategoryCount = (cat: string) => {
    if (cat === "revenue_growth") return approvals.filter(a => a.category === "revenue_growth" || a.category === "division_briefing").length;
    return approvals.filter(a => a.category === cat).length;
  };

  const pending       = approvals.filter(a => a.status === "pending" && isApprovalCard(a)).length;
  const knowledge     = approvals.filter(a => !isApprovalCard(a)).length;
  const approvedToday = approvals.filter(a => a.status === "approved" && new Date(a.created_at).toDateString() === new Date().toDateString()).length;

  const sectionTabStyle = (active: boolean, color: string) => ({
    fontFamily:"'Montserrat', sans-serif", fontSize:"0.65rem", fontWeight:700,
    letterSpacing:"0.08em", textTransform:"uppercase" as const,
    padding:"0.4rem 0.875rem", borderRadius:20, cursor:"pointer",
    border: active ? "none" : `1px solid ${color}40`,
    background: active ? color : "transparent",
    color: active ? "#FFFFFF" : color,
    transition:"all 0.15s ease",
  });

  const tabStyle = (active: boolean) => ({
    fontFamily:"'Montserrat', sans-serif", fontSize:"0.65rem", fontWeight:700,
    letterSpacing:"0.08em", textTransform:"uppercase" as const,
    padding:"0.4rem 0.875rem", borderRadius:20, cursor:"pointer", border:"none",
    background: active ? "#D4AF37" : "rgba(255,255,255,0.06)",
    color: active ? "#0A2342" : "rgba(255,255,255,0.6)",
    transition:"all 0.15s ease",
  });

  return (
    <div style={{ minHeight:"100dvh", background:"#0A2342", display:"flex", flexDirection:"column" }}>
      <NavBar active="/admin-approvals" />
      <main style={{ flex:1, padding:"2rem 1.5rem", maxWidth:1100, margin:"0 auto", width:"100%" }}>

        {/* Header */}
        <div style={{ marginBottom:"1.5rem", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap" as const, gap:"1rem" }}>
          <div>
            <p style={{ fontFamily:"'Montserrat', sans-serif", color:"#C2185B", fontSize:"0.7rem", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:"0.4rem" }}>Admin · Page 3 · Confidential</p>
            <h1 style={{ fontFamily:"'Playfair Display', serif", color:"#FFFFFF", fontSize:"1.75rem", fontWeight:700, lineHeight:1.2, marginBottom:"0.2rem" }}>Intelligence Hub</h1>
            <p style={{ color:"rgba(230,230,230,0.5)", fontFamily:"'Inter', sans-serif", fontSize:"0.75rem" }}>Knowledge cards to read and act on · Approval cards gate publishing and outreach</p>
          </div>
          <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap" as const }}>
            <div onClick={() => window.location.href = "/admin-archived"} style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.72rem", fontWeight:700, color:"rgba(255,255,255,0.5)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:8, padding:"0.6rem 1.25rem", letterSpacing:"0.06em", cursor:"pointer" }}>Archived →</div>
            <div onClick={() => window.location.href = "/admin"} style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.72rem", fontWeight:700, color:"#D4AF37", border:"1px solid rgba(212,175,55,0.35)", borderRadius:8, padding:"0.6rem 1.25rem", letterSpacing:"0.06em", cursor:"pointer" }}>← Command Center</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"0.75rem", marginBottom:"0.75rem" }}>
          {[
            { label:"Pending Approval", value:pending,       color:"#D4AF37" },
            { label:"Knowledge Items",  value:knowledge,     color:"rgba(192,208,232,1)" },
            { label:"Approved Today",   value:approvedToday, color:"#4CAF50" },
          ].map(s => (
            <div key={s.label} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:10, padding:"0.875rem 1rem" }}>
              <p style={{ fontFamily:"'Playfair Display', serif", color:s.color, fontSize:"1.75rem", fontWeight:700, margin:0 }}>{s.value}</p>
              <p style={{ fontFamily:"'Montserrat', sans-serif", color:"rgba(230,230,230,0.5)", fontSize:"0.62rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, margin:"4px 0 0" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Community Member Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"0.75rem", marginBottom:"1.5rem" }}>
          {[
            { label:"CC Members",  value:memberCounts.total,       color:"#D4AF37" },
            { label:"Navigator",   value:memberCounts.navigator,   color:"rgba(192,208,232,1)" },
            { label:"Accelerator", value:memberCounts.accelerator, color:"#B8941F" },
          ].map(s => (
            <div key={s.label} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(212,175,55,0.15)", borderRadius:10, padding:"0.875rem 1rem" }}>
              <p style={{ fontFamily:"'Playfair Display', serif", color:s.color, fontSize:"1.75rem", fontWeight:700, margin:0 }}>{s.value}</p>
              <p style={{ fontFamily:"'Montserrat', sans-serif", color:"rgba(230,230,230,0.5)", fontSize:"0.62rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, margin:"4px 0 0" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Flagged Comments */}
        <div style={{ marginBottom:"1.75rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"0.75rem" }}>
            <h2 style={{ fontFamily:"'Playfair Display', serif", color:"#FFFFFF", fontSize:"1.1rem", fontWeight:700, margin:0 }}>Flagged Comments</h2>
            {flaggedComments.length > 0 && (
              <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:"#C2185B", color:"#FFFFFF" }}>{flaggedComments.length}</span>
            )}
          </div>
          {flaggedLoading ? (
            <div style={{ padding:"0.75rem 1rem", color:"rgba(212,175,55,0.6)", fontFamily:"'Montserrat', sans-serif", fontSize:"0.72rem" }}>Loading...</div>
          ) : flaggedComments.length === 0 ? (
            <div style={{ padding:"0.75rem 1rem", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:8 }}>
              <p style={{ fontFamily:"'Inter', sans-serif", color:"rgba(255,255,255,0.3)", fontSize:"0.75rem", margin:0 }}>No flagged comments</p>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column" as const, gap:"0.5rem" }}>
              {flaggedComments.map(fc => (
                <div key={fc.id} style={{ background:"rgba(194,24,91,0.05)", border:"1px solid rgba(194,24,91,0.2)", borderRadius:10, padding:"0.875rem 1rem", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"1rem" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.4rem", flexWrap:"wrap" as const }}>
                      <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.65rem", fontWeight:700, color:"#FFFFFF" }}>{(fc as any).profiles?.first_name ?? "Unknown Member"}</span>
                      {(fc as any).community_posts?.title && (<><span style={{ color:"rgba(255,255,255,0.3)", fontSize:"0.6rem" }}>on</span><span style={{ fontFamily:"'Inter', sans-serif", fontSize:"0.62rem", color:"rgba(212,175,55,0.8)" }}>{String((fc as any).community_posts.title).slice(0, 60)}</span></>)}
                      <span style={{ fontFamily:"'Inter', sans-serif", color:"rgba(255,255,255,0.3)", fontSize:"0.6rem" }}>{timeAgo(fc.created_at)}</span>
                    </div>
                    <p style={{ fontFamily:"'Inter', sans-serif", color:"rgba(255,255,255,0.65)", fontSize:"0.75rem", lineHeight:1.5, margin:0 }}>"{fc.content.slice(0, 200)}{fc.content.length > 200 ? "..." : ""}"</p>
                  </div>
                  <div style={{ display:"flex", gap:"0.5rem", flexShrink:0 }}>
                    <button onClick={() => handleClearFlag(fc.id)} disabled={savingComment === fc.id} style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.58rem", fontWeight:700, padding:"0.35rem 0.75rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(212,175,55,0.4)", background:"transparent", color:"#D4AF37", letterSpacing:"0.06em", opacity:savingComment === fc.id ? 0.5 : 1 }}>Clear</button>
                    <button onClick={() => handleRemoveComment(fc.id)} disabled={savingComment === fc.id} style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.58rem", fontWeight:700, padding:"0.35rem 0.75rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(194,24,91,0.5)", background:"transparent", color:"#C2185B", letterSpacing:"0.06em", opacity:savingComment === fc.id ? 0.5 : 1 }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section Tabs — Knowledge vs Approvals (All removed — redundant) */}
        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"0.75rem", flexWrap:"wrap" as const }}>
          <button onClick={() => setActiveFilter("knowledge")} style={sectionTabStyle(activeFilter === "knowledge", "rgba(192,208,232,1)")}>Knowledge ({approvals.filter(a => !isApprovalCard(a)).length})</button>
          <button onClick={() => setActiveFilter("approvals")} style={sectionTabStyle(activeFilter === "approvals", "#C2185B")}>Approvals ({approvals.filter(a => isApprovalCard(a)).length})</button>
        </div>

        {/* Category Filter Tabs */}
        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.25rem", flexWrap:"wrap" as const }}>
          {allCategories.map(cat => (
            <button key={cat} onClick={() => setActiveFilter(cat)} style={tabStyle(activeFilter === cat)}>
              {CATEGORY_LABELS[cat] || cat} ({getCategoryCount(cat)})
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign:"center" as const, padding:"3rem", color:"rgba(212,175,55,0.6)", fontFamily:"'Montserrat', sans-serif", fontSize:"0.75rem" }}>LOADING...</div>}
        {!loading && filtered.length === 0 && <div style={{ textAlign:"center" as const, padding:"3rem", color:"rgba(255,255,255,0.3)", fontFamily:"'Inter', sans-serif", fontSize:"0.85rem" }}>{activeFilter === "knowledge" ? "Queue is clear — agents are standing by" : "No items in this category"}</div>}

        {!loading && (
          <div style={{ display:"flex", flexDirection:"column" as const, gap:"1rem" }}>
            {filtered.map(approval => {
              const badge         = getBadgeInfo(approval);
              const origCol       = getOriginalColumn(approval);
              const draftHead     = getDraftHeading(approval);
              const isBriefing    = approval.category !== "social" && approval.category !== "community_post";
              const qs            = getQS(approval.id);
              const divAgents     = DIVISION_AGENTS[approval.division] ?? [];
              const isLead        = approval.category === "lead_intelligence";
              const isPDF         = approval.division === "Client Delivery" || PDF_CATEGORIES.has(approval.category);
              const isPostTrigger = approval.category === "CC Post Triggers";
              const isCCReply     = approval.category === "community_comment_reply";
              const isCCPost      = approval.category === "community_post";
              const isUpsell      = approval.category === "cc_upsell_outreach";
              const isKnowledge   = !isApprovalCard(approval);
              const currentDir    = leadDirection[approval.id] || "assessment_invite";
              const hasConversation = !!approval.context && approval.context !== "null";

              return (
                <div key={approval.id} style={{ borderRadius:12, overflow:"hidden", border:`1px solid ${isPostTrigger ? "rgba(194,24,91,0.4)" : isCCPost ? "rgba(45,90,142,0.4)" : isKnowledge ? "rgba(192,208,232,0.15)" : approval.status === "pending" ? "rgba(212,175,55,0.3)" : "rgba(255,255,255,0.08)"}`, background:approval.status !== "pending" ? "rgba(255,255,255,0.02)" : isPostTrigger ? "rgba(194,24,91,0.04)" : isCCPost ? "rgba(45,90,142,0.04)" : isKnowledge ? "rgba(192,208,232,0.02)" : "rgba(255,255,255,0.04)", opacity:approval.status !== "pending" ? 0.7 : 1 }}>

                  {/* Card Header */}
                  <div style={{ background:"#071A2E", padding:"0.65rem 1rem", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap" as const, gap:"0.5rem" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", flexWrap:"wrap" as const }}>
                      <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.58rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:badge.color, color:"#FFFFFF" }}>{badge.text}</span>
                      {isKnowledge && <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.52rem", fontWeight:700, padding:"2px 7px", borderRadius:20, background:"rgba(192,208,232,0.1)", border:"1px solid rgba(192,208,232,0.3)", color:"rgba(192,208,232,0.8)" }}>Knowledge</span>}
                      <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.55rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:"transparent", border:`1px solid ${PRIORITY_COLORS[approval.priority] ?? PRIORITY_COLORS.NORMAL}`, color:PRIORITY_COLORS[approval.priority] ?? PRIORITY_COLORS.NORMAL }}>{approval.priority || "NORMAL"}</span>
                      <span style={{ fontFamily:"'Inter', sans-serif", color:"rgba(212,175,55,0.8)", fontSize:"0.62rem" }}>{isBriefing ? `${approval.division} Division` : `${approval.agent_name} · ${approval.agent_role}`}</span>
                      {isPDF && !isPostTrigger && !isCCReply && !isKnowledge && !isCCPost && <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.52rem", fontWeight:700, padding:"2px 7px", borderRadius:20, background:"rgba(166,137,32,0.2)", border:"1px solid rgba(166,137,32,0.5)", color:"#A68920" }}>PDF on Approve</span>}
                      {isLead && <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.52rem", fontWeight:700, padding:"2px 7px", borderRadius:20, background:"rgba(212,175,55,0.15)", border:"1px solid rgba(212,175,55,0.4)", color:"#D4AF37" }}>Routes to GHL</span>}
                      {isCCReply && <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.52rem", fontWeight:700, padding:"2px 7px", borderRadius:20, background:"rgba(45,90,142,0.2)", border:"1px solid rgba(45,90,142,0.5)", color:"#7BA7D4" }}>Posts to Community</span>}
                      {isCCPost && <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.52rem", fontWeight:700, padding:"2px 7px", borderRadius:20, background:"rgba(45,90,142,0.2)", border:"1px solid rgba(45,90,142,0.5)", color:"#7BA7D4" }}>Posts to Community</span>}
                      {hasConversation && !qs.open && <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.52rem", fontWeight:700, padding:"2px 7px", borderRadius:20, background:"rgba(212,175,55,0.1)", border:"1px solid rgba(212,175,55,0.3)", color:"rgba(212,175,55,0.8)" }}>💬 Conversation saved</span>}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
                      {publishStatus[approval.id] && (
                        <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.55rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, color:publishStatus[approval.id] === "posted" ? "#4CAF50" : publishStatus[approval.id] === "posting" ? "#D4AF37" : "#C2185B" }}>
                          {getStatusText(approval, publishStatus[approval.id])}
                        </span>
                      )}
                      {approval.status !== "pending" && !publishStatus[approval.id] && <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.55rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, color:approval.status === "approved" ? "#4CAF50" : "#C2185B" }}>{approval.status}</span>}
                      <span style={{ fontFamily:"'Inter', sans-serif", color:"rgba(255,255,255,0.3)", fontSize:"0.6rem" }}>{timeAgo(approval.created_at)}</span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding:"1rem", display:"grid", gridTemplateColumns:isBriefing ? "1fr 2fr" : "1fr 1fr", gap:"1rem" }}>
                    <div>
                      <p style={{ fontFamily:"'Montserrat', sans-serif", color:"rgba(212,175,55,0.7)", fontSize:"0.58rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" as const, marginBottom:"0.5rem" }}>{origCol.heading}</p>
                      <p style={{ fontFamily:"'Inter', sans-serif", color:"rgba(255,255,255,0.7)", fontSize:"0.75rem", lineHeight:1.6, margin:0 }}>{origCol.content ?? <em style={{ color:"rgba(255,255,255,0.3)" }}>No content</em>}</p>
                    </div>
                    <div>
                      <p style={{ fontFamily:"'Montserrat', sans-serif", color:"rgba(212,175,55,0.7)", fontSize:"0.58rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" as const, marginBottom:"0.5rem" }}>{draftHead}</p>
                      {editingId === approval.id ? (
                        <textarea value={editText} onChange={e => setEditText(e.target.value)} style={{ width:"100%", minHeight:isBriefing ? 200 : 100, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(212,175,55,0.4)", borderRadius:6, color:"#FFFFFF", fontFamily:"'Inter', sans-serif", fontSize:"0.75rem", padding:"0.5rem", lineHeight:1.6, resize:"vertical" as const, boxSizing:"border-box" as const, outline:"none" }} />
                      ) : (
                        <div>{renderDraft(approval.edited_output || approval.output)}</div>
                      )}
                    </div>
                  </div>

                  {/* Lead Direction Selector */}
                  {isLead && approval.status === "pending" && editingId !== approval.id && (
                    <div style={{ margin:"0 1rem 0.75rem", padding:"0.75rem", background:"rgba(212,175,55,0.04)", border:"1px solid rgba(212,175,55,0.2)", borderRadius:8 }}>
                      <p style={{ fontFamily:"'Montserrat', sans-serif", color:"rgba(212,175,55,0.8)", fontSize:"0.58rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" as const, marginBottom:"0.5rem" }}>Route this lead to:</p>
                      <div style={{ display:"flex", flexWrap:"wrap" as const, gap:"0.4rem" }}>
                        {LEAD_DIRECTIONS.map(opt => (
                          <button key={opt.value} onClick={() => setLeadDirection(prev => ({ ...prev, [approval.id]: opt.value }))}
                            style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem", fontWeight:700, padding:"0.3rem 0.875rem", borderRadius:20, cursor:"pointer", border:`1px solid ${currentDir === opt.value ? "#D4AF37" : "rgba(255,255,255,0.18)"}`, background:currentDir === opt.value ? "rgba(212,175,55,0.18)" : "transparent", color:currentDir === opt.value ? "#D4AF37" : "rgba(255,255,255,0.5)", transition:"all 0.15s" }}>
                            {opt.label}{opt.value === "assessment_invite" && <span style={{ marginLeft:4, opacity:0.6, fontSize:"0.52rem" }}>★ default</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ask a Question Panel */}
                  {qs.open && approval.status === "pending" && !isPostTrigger && (
                    <div style={{ margin:"0 1rem", padding:"0.875rem", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(212,175,55,0.2)", borderRadius:8, marginBottom:"0.5rem" }}>
                      {isBriefing && approval.category !== "daily_briefing" && !isCCReply && !isCCPost && (
                        <div style={{ marginBottom:"0.75rem" }}>
                          <p style={{ fontFamily:"'Montserrat', sans-serif", color:"rgba(212,175,55,0.7)", fontSize:"0.58rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" as const, marginBottom:"0.4rem" }}>Who are you asking?</p>
                          <div style={{ display:"flex", flexWrap:"wrap" as const, gap:"0.4rem" }}>
                            {divAgents.map(agent => (
                              <button key={agent.agent_id} onClick={() => setQS(approval.id, { selectedAgent:agent })}
                                style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem", fontWeight:700, padding:"0.3rem 0.75rem", borderRadius:20, cursor:"pointer", border:`1px solid ${qs.selectedAgent?.agent_id === agent.agent_id ? "#D4AF37" : "rgba(255,255,255,0.2)"}`, background:qs.selectedAgent?.agent_id === agent.agent_id ? "rgba(212,175,55,0.15)" : "transparent", color:qs.selectedAgent?.agent_id === agent.agent_id ? "#D4AF37" : "rgba(255,255,255,0.5)", transition:"all 0.15s" }}>
                                {agent.agent_name} <span style={{ opacity:0.6, fontSize:"0.55rem" }}>· {agent.role}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {(approval.category === "social" || approval.category === "community_post" || approval.category === "daily_briefing" || isCCReply) && qs.selectedAgent && (
                        <p style={{ fontFamily:"'Montserrat', sans-serif", color:"#D4AF37", fontSize:"0.6rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:"0.75rem" }}>Asking: {qs.selectedAgent.agent_name} · {qs.selectedAgent.role}</p>
                      )}
                      {qs.messages.length > 0 && (
                        <div style={{ marginBottom:"0.75rem", display:"flex", flexDirection:"column" as const, gap:"0.5rem", maxHeight:300, overflowY:"auto" as const }}>
                          {qs.messages.map((msg, i) => (
                            <div key={i} style={{ padding:"0.5rem 0.75rem", borderRadius:8, background:msg.role === "user" ? "rgba(212,175,55,0.1)" : "rgba(255,255,255,0.05)", border:`1px solid ${msg.role === "user" ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.08)"}` }}>
                              <p style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.55rem", fontWeight:700, letterSpacing:"0.08em", color:msg.role === "user" ? "#D4AF37" : "rgba(255,255,255,0.5)", marginBottom:"0.25rem", textTransform:"uppercase" as const }}>{msg.role === "user" ? "You" : msg.agentName}</p>
                              <p style={{ fontFamily:"'Inter', sans-serif", fontSize:"0.75rem", color:"#FFFFFF", lineHeight:1.6, margin:0 }}>{msg.text}</p>
                            </div>
                          ))}
                          {qs.loading && (
                            <div style={{ padding:"0.5rem 0.75rem", borderRadius:8, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)" }}>
                              <p style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.55rem", fontWeight:700, color:"rgba(212,175,55,0.6)", margin:0, letterSpacing:"0.08em" }}>{qs.selectedAgent?.agent_name ?? "Agent"} is responding...</p>
                            </div>
                          )}
                        </div>
                      )}
                      {qs.selectedAgent && (
                        <div style={{ display:"flex", gap:"0.5rem" }}>
                          <input type="text" value={qs.input} onChange={e => setQS(approval.id, { input:e.target.value })} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAskQuestion(approval); } }} placeholder={`Ask ${qs.selectedAgent.agent_name} a question...`} disabled={qs.loading}
                            style={{ flex:1, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(212,175,55,0.3)", borderRadius:6, color:"#FFFFFF", fontFamily:"'Inter', sans-serif", fontSize:"0.75rem", padding:"0.5rem 0.75rem", outline:"none", opacity:qs.loading ? 0.6 : 1 }} />
                          <button onClick={() => handleAskQuestion(approval)} disabled={qs.loading || !qs.input.trim()}
                            style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.5rem 1rem", borderRadius:6, cursor:"pointer", border:"none", background:"#D4AF37", color:"#0A2342", letterSpacing:"0.06em", opacity:(qs.loading || !qs.input.trim()) ? 0.5 : 1 }}>Send</button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ padding:"0 1rem 1rem", display:"flex", gap:"0.5rem", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap" as const }}>
                    {approval.status === "pending" && editingId !== approval.id && !isPostTrigger && (
                      <button onClick={() => toggleQuestion(approval)}
                        style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem", fontWeight:700, padding:"0.4rem 0.875rem", borderRadius:6, cursor:"pointer", border:`1px solid ${qs.open ? "rgba(212,175,55,0.6)" : hasConversation ? "rgba(212,175,55,0.4)" : "rgba(255,255,255,0.15)"}`, background:qs.open ? "rgba(212,175,55,0.1)" : hasConversation ? "rgba(212,175,55,0.05)" : "transparent", color:qs.open ? "#D4AF37" : hasConversation ? "rgba(212,175,55,0.8)" : "rgba(255,255,255,0.4)", letterSpacing:"0.06em" }}>
                        {qs.open ? "✕ Close" : hasConversation ? "💬 Continue Conversation" : "? Ask a Question"}
                      </button>
                    )}

                    <div style={{ display:"flex", gap:"0.5rem", marginLeft:"auto" }}>
                      {/* KNOWLEDGE CARDS — Read ✓ only */}
                      {isKnowledge && approval.status === "pending" && editingId !== approval.id && (
                        <button onClick={() => handleRead(approval.id)} disabled={saving === approval.id}
                          style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1.25rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(192,208,232,0.4)", background:"rgba(192,208,232,0.08)", color:"rgba(192,208,232,0.9)", letterSpacing:"0.06em", opacity:saving === approval.id ? 0.6 : 1 }}>
                          {saving === approval.id ? "..." : "Read ✓"}
                        </button>
                      )}

                      {/* CC Post Triggers — Dismiss only */}
                      {isPostTrigger && approval.status === "pending" && editingId !== approval.id && (
                        <button onClick={() => handleArchive(approval.id)} disabled={saving === approval.id}
                          style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1.25rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(255,255,255,0.2)", background:"transparent", color:"rgba(255,255,255,0.5)", letterSpacing:"0.06em", opacity:saving === approval.id ? 0.6 : 1 }}>
                          {saving === approval.id ? "..." : "Dismiss"}
                        </button>
                      )}

                      {/* APPROVAL CARDS — full Reject / Edit / Approve */}
                      {!isKnowledge && approval.status === "pending" && editingId !== approval.id && !isPostTrigger && (
                        <>
                          <button onClick={() => handleReject(approval.id)} disabled={saving === approval.id} style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(194,24,91,0.5)", background:"transparent", color:"#C2185B", letterSpacing:"0.06em" }}>Reject</button>
                          <button onClick={() => handleEditStart(approval)} style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(212,175,55,0.4)", background:"transparent", color:"#D4AF37", letterSpacing:"0.06em" }}>Edit</button>
                          <button onClick={() => handleApprove(approval.id)} disabled={saving === approval.id} style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1.25rem", borderRadius:6, cursor:"pointer", border:"none", background:"#D4AF37", color:"#0A2342", letterSpacing:"0.06em", opacity:saving === approval.id ? 0.6 : 1 }}>
                            {saving === approval.id ? "..." : isCCReply ? "Approve + Post →" : isCCPost ? "Approve + Post →" : isUpsell ? "Approve + Send →" : isPDF ? "Approve + PDF ↓" : isLead ? "Approve + Route →" : "Approve ✓"}
                          </button>
                        </>
                      )}

                      {/* Edit save/cancel */}
                      {editingId === approval.id && (
                        <>
                          <button onClick={() => setEditingId(null)} style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(255,255,255,0.2)", background:"transparent", color:"rgba(255,255,255,0.5)", letterSpacing:"0.06em" }}>Cancel</button>
                          <button onClick={() => handleEditSave(approval.id)} disabled={saving === approval.id} style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"none", background:"#D4AF37", color:"#0A2342", letterSpacing:"0.06em", opacity:saving === approval.id ? 0.6 : 1 }}>{saving === approval.id ? "Saving..." : "Save & Approve"}</button>
                        </>
                      )}

                      {/* Already actioned */}
                      {approval.status !== "pending" && editingId !== approval.id && (
                        <button onClick={() => handleArchive(approval.id)} disabled={saving === approval.id} style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(255,255,255,0.15)", background:"transparent", color:"rgba(255,255,255,0.4)", letterSpacing:"0.06em" }}>Archive</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop:"1rem", textAlign:"center" as const, padding:"0.75rem", background:"rgba(212,175,55,0.05)", border:"1px solid rgba(212,175,55,0.2)", borderRadius:8 }}>
          <p style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem", color:"rgba(212,175,55,0.7)", margin:0 }}>All responses reviewed by DeAnna R. Upshaw before posting · DRU AI Consulting © 2026</p>
        </div>
      </main>
      <footer style={{ textAlign:"center" as const, padding:"0.75rem", color:"rgba(255,255,255,0.2)", fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
