import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import AdminLayout from "../components/AdminLayout";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

type ApprovalStatus = "pending" | "approved" | "rejected" | "edited" | "ready_to_use" | "read";
type Priority       = "URGENT" | "HIGH" | "NORMAL";
type PlatformTab    = "LinkedIn" | "Facebook" | "Instagram";

interface Approval {
  id: string; created_at: string; source: string; trigger_type: string;
  agent_name: string; agent_role: string; division: string; task_brief: string;
  original_content: string; output: string; edited_output: string | null;
  status: ApprovalStatus; ghl_contact_id: string | null; notify_deanna: boolean;
  priority: Priority; category: string; platform: string | null;
  context: string | null; archived: boolean;
  video_url: string | null;
  image_url: string | null;
  linkedin_content: string | null;
  facebook_content: string | null;
  instagram_caption: string | null;
  instagram_video_url: string | null;
  facebook_reel_url: string | null;
  spanish_content: string | null;
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

interface MediaState { video_url: string; image_url: string; instagram_video_url: string; facebook_reel_url: string; }

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

const APPROVAL_CATEGORIES = new Set([
  "social", "community_comment_reply", "cc_upsell_outreach", "ac_upsell_outreach",
  "CC Post Triggers", "lead_intelligence", "community_post", "social_response",
]);

const PLATFORM_COLORS: Record<string, string> = {
  LinkedIn:"#0077B5", Instagram:"#C2185B", Facebook:"#1877F2", Email:"#D4AF37",
  General:"#0A2342", X:"#14171A", TikTok:"#010101", YouTube:"#FF0000",
  Pinterest:"#E60023", Content:"#163D6E", Press:"#8A6E1A", Design:"#7A0F38",
  Localization:"#A68920", Copy:"#E0527E", Outreach:"#2E6DAB", Community:"#2D5A8E",
  Proposal:"#5C4B8A", Course:"#2E7D8E", Video:"#1A5276",
};

// Cards that go to the Ready to Use folder — internal review, no external publish
const READY_TO_USE_PLATFORMS = new Set(['Copy', 'Proposal', 'Design', 'Course', 'Video']);

// Pure reports — consumed once, filed to Archived via the "Read" button. Never reusable content.
const READ_CATEGORIES = new Set(['daily_briefing', 'revenue_growth', 'legal_finance', 'ai_governance', 'hr']);

// Reusable deliverables — filed to Archived via "Ready to Use", browsable by folder.
// (Ravi/Chloe/Kwame reach Ready to Use via the isSocial + READY_TO_USE_PLATFORMS check below instead.)
const READY_TO_USE_CATEGORIES = new Set(['client_delivery', 'customer_support', 'marketing', 'content_brand', 'content_review', 'grants']);

const DIVISION_COLORS: Record<string, string> = {
  "Revenue, Growth & Sales":"#D4AF37", "Content & Brand":"#C2185B", "Marketing":"#163D6E",
  "Legal & Finance":"#8A6E1A", "AI Governance":"#7A0F38", "HR":"#2E6DAB",
  "Client Delivery":"#A68920", "Customer Support":"#C2185B", "Command":"#0A2342",
  "Community Connection":"#2D5A8E",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  URGENT:"#C2185B", HIGH:"#D4AF37", NORMAL:"rgba(10,35,66,0.3)",
};

const CATEGORY_LABELS: Record<string, string> = {
  daily_briefing:"Daily Briefing", revenue_growth:"Revenue, Growth & Sales",
  division_briefing:"Revenue, Growth & Sales", content_brand:"Content & Brand",
  marketing:"Marketing", legal_finance:"Legal & Finance", ai_governance:"AI Governance",
  hr:"HR", client_delivery:"Client Delivery", customer_support:"Customer Support",
  social:"Social Media", email:"Email", proposal:"Proposal", content:"Content",
  community_connection:"Community Connection", community_post:"CC Post", other:"Other",
  community_comment_reply:"CC Agent Reply", "CC Post Triggers":"CC Policy Violation",
  cc_upsell_outreach:"CC Upsell Signal",
  community_opportunity:"CC Opportunity",
  ac_upsell_outreach:"AC Upsell Outreach", grants:"Grants",
};

const CATEGORY_ORDER = [
  "daily_briefing","revenue_growth","content_brand","marketing",
  "legal_finance","ai_governance","hr","client_delivery","customer_support",
  "community_connection","community_post","social","email","proposal","grants","content","other",
  "community_comment_reply","CC Post Triggers","cc_upsell_outreach","community_opportunity","ac_upsell_outreach",
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
    { agent_id:"adaeze",  agent_name:"Adaeze Nwosu",     role:"Grant Strategist" },
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
    { agent_id:"dominique",  agent_name:"Dominique",   role:"DRU CLEAR™ Insights" },
    { agent_id:"elijah",     agent_name:"Elijah",      role:"Framework Lesson" },
    { agent_id:"solange",    agent_name:"Solange",     role:"Action Challenge" },
    { agent_id:"isaiah_webb",agent_name:"Isaiah Webb", role:"5D Leadership™" },
    { agent_id:"nadia",      agent_name:"Nadia",       role:"Strategic Edge" },
    { agent_id:"victor",     agent_name:"Victor",      role:"Community Engagement" },
    { agent_id:"sasha",      agent_name:"Sasha",       role:"AI Sales Mastery™" },
    { agent_id:"tariq",      agent_name:"Tariq",       role:"Sales Content" },
    { agent_id:"zoe",        agent_name:"Zoe Beaumont",role:"CC Division Leader" },
    { agent_id:"micah",      agent_name:"Micah Santos",role:"Member Experience" },
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

function getOriginalColumn(approval: Approval): { heading: string; content: string | null } {
  if (approval.category === "social") return { heading: "Contributors", content: approval.task_brief || null };
  if (approval.category === "community_post") {
    const raw = approval.task_brief || '';
    const parts = raw.split('|').map((s: string) => s.trim()).filter(Boolean);
    const contributors = parts.length > 1 ? parts.slice(1).join(' · ') : raw.replace(/post_id:[a-zA-Z0-9-]+\s*\|?\s*/g, '').trim() || raw;
    const dateStr = new Date(approval.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return { heading: "Contributors", content: contributors ? `${contributors} | ${dateStr}` : dateStr };
  }
  if (approval.category === "daily_briefing")          return { heading: "Today's Date",    content: new Date(approval.created_at).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) };
  if (approval.category === "community_comment_reply") return { heading: "Post Reference",  content: approval.task_brief || null };
  if (approval.category === "CC Post Triggers")        return { heading: "Member Info",     content: approval.task_brief || null };
  if (approval.category === "cc_upsell_outreach")      return { heading: "Member & Signal", content: approval.task_brief || null };
  if (approval.category === "community_opportunity")    return { heading: "Member & Signal", content: approval.task_brief || null };
  if (approval.category === "ac_upsell_outreach")       return { heading: "Member & Signal", content: approval.task_brief || null };
  if (approval.category === "social_response")          return { heading: "Incoming Message", content: approval.original_content || approval.task_brief || null };
  return { heading: "Contributors", content: approval.task_brief || null };
}

function getDraftHeading(approval: Approval): string {
  if (approval.category === "social")                  return `${approval.agent_name}'s Draft`;
  if (approval.category === "community_post")          return `${approval.agent_name}'s Post`;
  if (approval.category === "daily_briefing")          return "Daily Briefing";
  if (approval.category === "community_comment_reply") return "Agent Reply";
  if (approval.category === "CC Post Triggers")        return "Violation Report";
  if (approval.category === "cc_upsell_outreach")      return "Aaliyah Outreach Draft";
  if (approval.category === "community_opportunity")    return "Aaliyah Opportunity Brief";
  if (approval.category === "ac_upsell_outreach")       return "Aaliyah AC Outreach Draft";
  if (approval.category === "social_response")          return `${approval.agent_name}'s Reply Draft`;
  return `${CATEGORY_LABELS[approval.category] ?? approval.division} Briefing`;
}

function getStatusText(approval: Approval, status: "posting" | "posted" | "failed"): string {
  if (approval.category === "lead_intelligence")       return status === "posted" ? "✓ Routed to GHL"       : status === "posting" ? "Routing..."         : "⚠ Route Failed";
  if (approval.division === "Client Delivery")         return status === "posted" ? "✓ PDF Downloaded"      : status === "posting" ? "Generating PDF..."   : "⚠ PDF Failed";
  if (approval.category === "community_comment_reply") return status === "posted" ? "✓ Comment Posted"      : status === "posting" ? "Posting..."          : "⚠ Post Failed";
  if (approval.category === "community_post")          return status === "posted" ? "✓ Posted to Community" : status === "posting" ? "Posting..."          : "⚠ Post Failed";
  if (approval.category === "cc_upsell_outreach")      return status === "posted" ? "✓ Outreach Sent"       : status === "posting" ? "Sending..."          : "⚠ Send Failed";
  if (approval.category === "ac_upsell_outreach")      return status === "posted" ? "✓ AC Outreach Sent"    : status === "posting" ? "Sending..."          : "⚠ Send Failed";
  return status === "posted" ? "✓ Posted" : status === "posting" ? "Posting..." : "⚠ Post Failed";
}

// Renders **bold** inline markdown within a line of text
function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} style={{ fontWeight: 700, fontFamily: "'Montserrat', sans-serif" }}>{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

// Renders agent output with full markdown support:
// ## headings, **bold**, - bullet points, blank line spacing, --- dividers
function renderDraft(text: string) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Blank line or horizontal rule — breathing room
    if (line.trim() === '' || line.trim() === '---') {
      elements.push(<div key={key++} style={{ height: '0.5rem' }} />);
      continue;
    }

    // Section heading (## or ###)
    if (/^#{1,3}\s/.test(line)) {
      const headText = line.replace(/^#{1,3}\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1');
      elements.push(
        <p key={key++} style={{ fontFamily: "'Montserrat', sans-serif", color: '#0A2342', fontSize: '0.78rem', fontWeight: 700, margin: '0.75rem 0 0.3rem', letterSpacing: '0.02em' }}>
          {headText}
        </p>
      );
      continue;
    }

    // Bullet point
    if (/^[\-\*•]\s/.test(line)) {
      const bulletText = line.replace(/^[\-\*•]\s*/, '');
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: '0.5rem', margin: '0.15rem 0', paddingLeft: '0.25rem' }}>
          <span style={{ color: '#D4AF37', fontWeight: 700, flexShrink: 0, fontFamily: "'Inter', sans-serif", fontSize: '0.75rem' }}>•</span>
          <span style={{ fontFamily: "'Inter', sans-serif", color: '#0A2342', fontSize: '0.75rem', lineHeight: 1.6 }}>{renderInlineMarkdown(bulletText)}</span>
        </div>
      );
      continue;
    }

    // Regular line
    elements.push(
      <p key={key++} style={{ fontFamily: "'Inter', sans-serif", color: '#0A2342', fontSize: '0.75rem', lineHeight: 1.6, margin: '0 0 0.35rem' }}>
        {renderInlineMarkdown(line)}
      </p>
    );
  }

  return <>{elements}</>;
}

function parseYaraBilingual(output: string): { english: string; spanish: string } {
  const englishMatch = output.match(/##\s*ENGLISH VERSION[^:\n]*[:\n]+([\s\S]*?)(?=##\s*SPANISH VERSION|$)/i);
  const spanishMatch = output.match(/##\s*SPANISH VERSION[^:\n]*[:\n]+([\s\S]*?)(?=Localization notes|Translated hashtags|$)/i);
  return {
    english: englishMatch?.[1]?.trim() || output,
    spanish: spanishMatch?.[1]?.trim() || '',
  };
}

function stripUpsellSignal(text: string): string {
  const idx = text.indexOf('UPSELL SIGNAL:');
  return idx !== -1 ? text.slice(0, idx).trim() : text;
}

function getUpsellSignal(text: string): string | null {
  const idx = text.indexOf('UPSELL SIGNAL:');
  if (idx === -1) return null;
  return text.slice(idx + 'UPSELL SIGNAL:'.length).trim() || null;
}

function isApprovalCard(approval: Approval): boolean {
  return APPROVAL_CATEGORIES.has(approval.category);
}

function isMultiPlatformCard(approval: Approval): boolean {
  return approval.category === 'social' &&
    !!(approval.linkedin_content && approval.facebook_content && approval.instagram_caption);
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
  if (approval.category === "community_opportunity")        return { text: "CC Opportunity",      color: "#C2185B" };
  if (approval.category === "ac_upsell_outreach")           return { text: "AC Upsell",           color: "#D4AF37" };
  if (approval.category === "social_response") {
    const platform = approval.platform ?? "Social";
    return { text: `${platform} Response`, color: PLATFORM_COLORS[platform] ?? "#0A2342" };
  }
  if (approval.category === "daily_briefing")              return { text: "Daily Briefing",     color: "#D4AF37" };
  if (approval.category === "grants")                       return { text: "Grants",             color: "#8A6E1A" };
  if (approval.category === "revenue_growth" || approval.category === "division_briefing")
    return { text: "Revenue, Growth & Sales", color: "#D4AF37" };
  if (approval.division && DIVISION_COLORS[approval.division])
    return { text: approval.division, color: DIVISION_COLORS[approval.division] };
  return { text: CATEGORY_LABELS[approval.category] ?? approval.category, color: "#0A2342" };
}

export default function AdminApprovals() {
  const [approvals, setApprovals]             = useState<Approval[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [activeFilter, setActiveFilter]       = useState<string>("knowledge");
  const [editingId, setEditingId]             = useState<string | null>(null);
  const [editText, setEditText]               = useState("");
  const [editingPlatform, setEditingPlatform] = useState<PlatformTab | null>(null);
  const [saving, setSaving]                   = useState<string | null>(null);
  const [publishStatus, setPublishStatus]     = useState<Record<string, "posting" | "posted" | "failed">>({});
  const [leadDirection, setLeadDirection]     = useState<Record<string, string>>({});
  const [questions, setQuestions]             = useState<Record<string, QuestionState>>({});
  const [memberCounts, setMemberCounts]       = useState({ total: 0, navigator: 0, accelerator: 0 });
  const [flaggedComments, setFlaggedComments] = useState<FlaggedComment[]>([]);
  const [flaggedLoading, setFlaggedLoading]   = useState(true);
  const [savingComment, setSavingComment]     = useState<string | null>(null);
  const [mediaUrls, setMediaUrls]             = useState<Record<string, MediaState>>({});
  const [platformTabs, setPlatformTabs]       = useState<Record<string, PlatformTab>>({});
  const [platformToggles, setPlatformToggles] = useState<Record<string, Record<string, boolean>>>({});
  // Contributor avatars — pulled live from Supabase `agents` table, keyed by
  // agents.name (which matches approval.agent_name exactly). Never hardcode a
  // photo URL here: swap the file in agents-photos + update agents.photo_url
  // in Supabase and every card here picks it up automatically.
  const [agentPhotoByName, setAgentPhotoByName] = useState<Record<string, string>>({});

  const getMediaUrls = (id: string, approval?: Approval): MediaState =>
    mediaUrls[id] ?? {
      video_url: approval?.video_url || '',
      image_url: approval?.image_url || '',
      instagram_video_url: approval?.instagram_video_url || '',
      facebook_reel_url: approval?.facebook_reel_url || '',
    };

  const setMediaUrl = (id: string, field: keyof MediaState, value: string) =>
    setMediaUrls(prev => ({ ...prev, [id]: { ...getMediaUrls(id), [field]: value } }));

  const getActivePlatformTab = (id: string): PlatformTab => platformTabs[id] ?? 'LinkedIn';

  const getActivePlatformContent = (approval: Approval): string => {
    const tab = getActivePlatformTab(approval.id);
    if (tab === 'Facebook') return approval.facebook_content ?? approval.output;
    if (tab === 'Instagram') return approval.instagram_caption ?? approval.output;
    return approval.linkedin_content ?? approval.output;
  };

  const getPlatformToggle = (id: string, platform: string): boolean =>
    platformToggles[id]?.[platform] ?? true;

  const togglePlatform = (id: string, platform: string) => {
    setPlatformToggles(prev => ({
      ...prev,
      [id]: { LinkedIn: true, Facebook: true, Instagram: true, ...prev[id], [platform]: !(prev[id]?.[platform] ?? true) },
    }));
  };

  const getSelectedPlatforms = (id: string): string[] => {
    const toggles = platformToggles[id] ?? { LinkedIn: true, Facebook: true, Instagram: true };
    return ['LinkedIn', 'Facebook', 'Instagram'].filter(p => toggles[p] !== false);
  };

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
    const { data } = await supabase.from("community_comments").select("*, profiles(first_name), community_posts(title)").eq("is_flagged", true).eq("is_active", true).order("created_at", { ascending: false });
    setFlaggedComments((data as FlaggedComment[]) || []);
    setFlaggedLoading(false);
  };

  const fetchAgentPhotos = async () => {
    const { data, error } = await supabase.from("agents").select("name, photo_url");
    if (error || !data) { console.error("[agent photos]", error); return; }
    const byName: Record<string, string> = {};
    data.forEach((a: any) => { if (a.photo_url && a.name) byName[a.name] = a.photo_url; });
    setAgentPhotoByName(byName);
  };

  useEffect(() => {
    fetchApprovals(); fetchMemberCounts(); fetchFlaggedComments(); fetchAgentPhotos();
    const channel = supabase.channel("approvals-realtime").on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, () => fetchApprovals()).subscribe();
    const commentsChannel = supabase.channel("flagged-comments-realtime").on("postgres_changes", { event: "*", schema: "public", table: "community_comments" }, () => fetchFlaggedComments()).subscribe();
    return () => { supabase.removeChannel(channel); supabase.removeChannel(commentsChannel); };
  }, []);

  const downloadPDF = async (approval: Approval): Promise<boolean> => {
    try {
      const res = await fetch("/api/pdf-generator", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ output: approval.edited_output || approval.output, agent_name: approval.agent_name, task_brief: approval.task_brief, division: approval.division, category: approval.category, approval_id: approval.id }) });
      if (!res.ok) return false;
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
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
    const match = (approval.task_brief || "").match(/post_id:([a-zA-Z0-9-]+)/);
    const postId = match?.[1];
    if (!postId) return false;
    const { error } = await supabase.from("community_comments").insert({ post_id: postId, member_id: null, agent_name: approval.agent_name, content, is_flagged: false, is_active: true });
    if (error) return false;
    await supabase.from("community_comments").update({ is_active: false, is_flagged: false }).eq("post_id", postId).eq("is_flagged", true).like("content", "Reply requested%");
    return true;
  };

  const postToCommunity = async (approval: Approval, content: string): Promise<boolean> => {
    try {
      const cleanContent = stripUpsellSignal(content);
      const postIdMatch = (approval.task_brief || '').match(/post_id:([a-zA-Z0-9-]+)/);
      const postId = postIdMatch?.[1];
      const lines = cleanContent.split('\n').filter((l: string) => l.trim());
      const title = lines[0]?.replace(/^#+\s*/, '').slice(0, 120) || `${approval.agent_name} Post` || 'Community Post';
      // Fallback inserts must route to the correct division — never assume Community
      // Connection / navigator tier just because the original post_id write failed.
      const isAC = approval.division === 'Accelerator Circle';
      const fallbackFields = { tier_required: isAC ? 'accelerator' : 'navigator' };
      if (postId) {
        // UPDATE only — no select (RLS was silently blocking return of updated rows, causing false fallthrough to INSERT)
        const { error: updateError } = await supabase.from('community_posts').update({ is_active: true, content: cleanContent, published_at: new Date().toISOString() }).eq('id', postId);
        if (!updateError) return true;
        // UPDATE errored — try INSERT as true fallback (new record)
        const { error: insertError } = await supabase.from('community_posts').insert({ id: postId, title, content: cleanContent, agent_name: approval.agent_name, post_type: 'agent', is_active: true, ...fallbackFields, published_at: new Date().toISOString() });
        if (!insertError || (insertError as any).code === '23505') return true; // 23505 = duplicate key = UPDATE already worked
        return false;
      }
      const { error: insertError } = await supabase.from('community_posts').insert({ title, content: cleanContent, agent_name: approval.agent_name, post_type: 'agent', is_active: true, ...fallbackFields, published_at: new Date().toISOString() });
      if (insertError) return false;
      return true;
    } catch (err) { console.error('[community_post]', err); return false; }
  };

  // Yara — post English to both CC + ACC communities, Spanish stored in content_es
  const postYaraToCommunity = async (approval: Approval): Promise<boolean> => {
    try {
      const content   = approval.linkedin_content || approval.output;
      const contentEs = approval.spanish_content || null;
      const lines     = content.split('\n').filter((l: string) => l.trim());
      const title     = lines[0]?.replace(/^#+\s*/, '').slice(0, 120) || 'Yara Mansour Post';
      const base = { title, content, content_es: contentEs, agent_name: 'Yara Mansour', post_type: 'agent', is_active: true, published_at: new Date().toISOString() };
      const { error: ccErr }  = await supabase.from('community_posts').insert({ ...base, tier_required: 'navigator' });
      const { error: accErr } = await supabase.from('community_posts').insert({ ...base, tier_required: 'accelerator' });
      return !ccErr && !accErr;
    } catch (err) { console.error('[yara_community]', err); return false; }
  };

  const fireSocialPublisher = async (approval: Approval, overrideContent?: { linkedin?: string; facebook?: string; instagram?: string }): Promise<boolean> => {
    const media = getMediaUrls(approval.id, approval);
    const isMulti = isMultiPlatformCard(approval);
    try {
      const res = await fetch("/api/social-publisher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isMulti ? {
          approval_id: approval.id,
          linkedin_content: overrideContent?.linkedin ?? approval.linkedin_content ?? approval.output,
          facebook_content: overrideContent?.facebook ?? approval.facebook_content ?? '',
          instagram_caption: overrideContent?.instagram ?? approval.instagram_caption ?? '',
          video_url: media.video_url || null,
          instagram_video_url: media.instagram_video_url || null,
          image_url: media.image_url || null,
          facebook_reel_url: media.facebook_reel_url || null,
          platforms_selected: getSelectedPlatforms(approval.id),
        } : {
          content: approval.edited_output || approval.output,
          platform: approval.platform,
          approval_id: approval.id,
          video_url: media.video_url || null,
          image_url: media.image_url || null,
          facebook_reel_url: media.facebook_reel_url || null,
        })
      });
      return res.ok;
    } catch { return false; }
  };

  // Fires approved social response reply back to Make.com → posts to platform
  const fireSocialReply = async (approval: Approval): Promise<boolean> => {
    try {
      let ctx: Record<string, string> = {};
      try { if (approval.context) ctx = JSON.parse(approval.context); } catch { /* ignore */ }
      const res = await fetch("/api/social-reply-publisher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_id:      approval.id,
          platform:         ctx.platform         ?? approval.platform ?? "",
          interaction_type: ctx.interaction_type  ?? "",
          interaction_id:   ctx.interaction_id    ?? null,
          post_id:          ctx.post_id           ?? null,
          reply_text:       approval.edited_output || approval.output,
          author_handle:    ctx.author_handle     ?? null,
        }),
      });
      return res.ok;
    } catch { return false; }
  };

  const handleApprove = async (id: string) => {
    setSaving(id);
    const approval = approvals.find(a => a.id === id);
    if (!approval) { setSaving(null); return; }

    const media = getMediaUrls(id, approval);

    const updatePayload: Record<string, any> = { status: "approved" };
    if (approval.category === "social") {
      if (media.video_url) updatePayload.video_url = media.video_url;
      if (media.image_url) updatePayload.image_url = media.image_url;
      if (media.instagram_video_url) updatePayload.instagram_video_url = media.instagram_video_url;
      if (media.facebook_reel_url) updatePayload.facebook_reel_url = media.facebook_reel_url;
    }

    const { error } = await supabase.from("approvals").update(updatePayload).eq("id", id);
    if (error) { setSaving(null); return; }

    const content = approval.edited_output || approval.output;
    if (approval.category === "social") {
      setPublishStatus(prev => ({ ...prev, [id]: "posting" }));
      const ok = await fireSocialPublisher(approval);
      setPublishStatus(prev => ({ ...prev, [id]: ok ? "posted" : "failed" }));
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
        const res = await fetch("https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/AlZQHDN7D7PIvApW0qDF", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trigger_type:"cc_upsell_outreach", agent_name:"Aaliyah Foster", outreach_message: content, email: emailMatch?.[1] ?? "", phone: phoneMatch?.[1] ?? "", task_brief: approval.task_brief, approval_id: id }) });
        setPublishStatus(prev => ({ ...prev, [id]: res.ok ? "posted" : "failed" }));
      } catch { setPublishStatus(prev => ({ ...prev, [id]: "failed" })); }
    } else if (approval.category === "ac_upsell_outreach") {
      setPublishStatus(prev => ({ ...prev, [id]: "posting" }));
      try {
        const emailMatch = (approval.task_brief || "").match(/Email:\s*([^\s|]+)/);
        const phoneMatch = (approval.task_brief || "").match(/Phone:\s*([^\s|]+)/);
        const res = await fetch("https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/AlZQHDN7D7PIvApW0qDF", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trigger_type:"ac_upsell_outreach", agent_name:"Aaliyah Foster", outreach_message: content, email: emailMatch?.[1] ?? "", phone: phoneMatch?.[1] ?? "", task_brief: approval.task_brief, approval_id: id }) });
        setPublishStatus(prev => ({ ...prev, [id]: res.ok ? "posted" : "failed" }));
      } catch { setPublishStatus(prev => ({ ...prev, [id]: "failed" })); }
    } else if (approval.division === "Client Delivery" || PDF_CATEGORIES.has(approval.category)) {
      setPublishStatus(prev => ({ ...prev, [id]: "posting" }));
      const ok = await downloadPDF(approval);
      setPublishStatus(prev => ({ ...prev, [id]: ok ? "posted" : "failed" }));
    } else if (approval.category === "social_response") {
      setPublishStatus(prev => ({ ...prev, [id]: "posting" }));
      const ok = await fireSocialReply(approval);
      setPublishStatus(prev => ({ ...prev, [id]: ok ? "posted" : "failed" }));
    }
    setSaving(null);
  };

  const handleReject  = async (id: string) => { setSaving(id); await supabase.from("approvals").update({ status:"rejected", archived: true }).eq("id", id); setSaving(null); };
  const handleReadyToUse = async (id: string) => {
    setSaving(id);
    await supabase.from("approvals").update({ status: "ready_to_use", archived: true }).eq("id", id);
    setApprovals(prev => prev.filter(a => a.id !== id));
    setSaving(null);
  };
  const handleArchive = async (id: string) => { setSaving(id); await supabase.from("approvals").update({ archived:true }).eq("id", id); setSaving(null); };
  // Read = pure report, consumed once. Never "approved" — approved means an action was actually taken.
  const handleRead    = async (id: string) => { setSaving(id); await supabase.from("approvals").update({ archived:true, status:"read" }).eq("id", id); setSaving(null); };
  const handleClearFlag     = async (id: string) => { setSavingComment(id); await supabase.from("community_comments").update({ is_flagged: false }).eq("id", id); setSavingComment(null); };
  const handleRemoveComment = async (id: string) => { setSavingComment(id); await supabase.from("community_comments").update({ is_active: false }).eq("id", id); setSavingComment(null); };

  const handleEditStart = (approval: Approval) => {
    setEditingId(approval.id);
    if (isMultiPlatformCard(approval)) {
      const tab = getActivePlatformTab(approval.id);
      setEditingPlatform(tab);
      setEditText(getActivePlatformContent(approval));
    } else {
      setEditingPlatform(null);
      const rawText = approval.edited_output || approval.output;
      setEditText(approval.category === 'community_post' ? stripUpsellSignal(rawText) : rawText);
    }
  };

  const handleEditSave = async (id: string) => {
    setSaving(id);
    const approval = approvals.find(a => a.id === id);
    if (!approval) { setSaving(null); return; }
    const media = getMediaUrls(id, approval);
    const isMulti = isMultiPlatformCard(approval);

    const updatePayload: Record<string, any> = { status: "approved" };
    if (isMulti && editingPlatform) {
      if (editingPlatform === 'LinkedIn') updatePayload.linkedin_content = editText;
      if (editingPlatform === 'Facebook') updatePayload.facebook_content = editText;
      if (editingPlatform === 'Instagram') updatePayload.instagram_caption = editText;
    }
    updatePayload.edited_output = editText;
    if (approval.category === "social") {
      if (media.video_url) updatePayload.video_url = media.video_url;
      if (media.image_url) updatePayload.image_url = media.image_url;
      if (media.instagram_video_url) updatePayload.instagram_video_url = media.instagram_video_url;
      if (media.facebook_reel_url) updatePayload.facebook_reel_url = media.facebook_reel_url;
    }

    await supabase.from("approvals").update(updatePayload).eq("id", id);
    setEditingId(null);
    setEditingPlatform(null);

    if (approval.category === "social") {
      setPublishStatus(prev => ({ ...prev, [id]: "posting" }));
      const overrideContent = isMulti && editingPlatform ? {
        linkedin: editingPlatform === 'LinkedIn' ? editText : (approval.linkedin_content ?? approval.output),
        facebook: editingPlatform === 'Facebook' ? editText : (approval.facebook_content ?? ''),
        instagram: editingPlatform === 'Instagram' ? editText : (approval.instagram_caption ?? ''),
      } : undefined;
      const ok = await fireSocialPublisher({ ...approval, edited_output: editText }, overrideContent);
      setPublishStatus(prev => ({ ...prev, [id]: ok ? "posted" : "failed" }));
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
        const res = await fetch("https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/AlZQHDN7D7PIvApW0qDF", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trigger_type:"cc_upsell_outreach", agent_name:"Aaliyah Foster", outreach_message: editText, email: emailMatch?.[1] ?? "", phone: phoneMatch?.[1] ?? "", task_brief: approval.task_brief, approval_id: id }) });
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
      let savedMessages: ConversationMessage[] = [];
      if (approval.context) { try { savedMessages = JSON.parse(approval.context); } catch { savedMessages = []; } }
      const autoAgent = approval.category === "social" ? { agent_id: approval.source?.replace('_social','') ?? 'darius', agent_name: approval.agent_name, role: approval.agent_role }
        : approval.category === "community_post" ? { agent_id: approval.source?.replace('_cc','') ?? 'dominique', agent_name: approval.agent_name, role: 'CC Agent' }
        : approval.category === "daily_briefing" ? { agent_id:"twin", agent_name:"DeAnna's AI Twin", role:"Master Orchestrator" } : null;
      setQS(approval.id, { open:true, selectedAgent:autoAgent, messages: savedMessages });
    } else { setQS(approval.id, { open:false }); }
  };

  const handleAskQuestion = async (approval: Approval) => {
    const qs = getQS(approval.id);
    if (!qs.selectedAgent || !qs.input.trim()) return;
    const question = qs.input.trim();
    const newMessages = [...qs.messages, { role:'user' as const, text:question }];
    setQS(approval.id, { messages:newMessages, input:"", loading:true });
    try {
      const res = await fetch("/api/ask-agent", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ agent_id: qs.selectedAgent.agent_id, agent_name: qs.selectedAgent.agent_name, agent_role: qs.selectedAgent.role, question, card_output: approval.output, conversation_history: qs.messages }) });
      const data = await res.json();
      const reply = data.response ?? "Unable to respond. Please try again.";
      const updatedMessages: ConversationMessage[] = [...newMessages, { role:'agent', agentName:qs.selectedAgent.agent_name, text:reply }];
      setQS(approval.id, { messages: updatedMessages, loading:false });
      await supabase.from("approvals").update({ context: JSON.stringify(updatedMessages) }).eq("id", approval.id);
    } catch {
      setQS(approval.id, { messages: [...newMessages, { role:'agent', agentName:qs.selectedAgent?.agent_name, text:"Something went wrong. Please try again." }], loading:false });
    }
  };

  const presentCategories = [...new Set(approvals.map(a => a.category === "division_briefing" ? "revenue_growth" : a.category))];
  const orderedCategories   = CATEGORY_ORDER.filter(c => presentCategories.includes(c));
  const remainingCategories = presentCategories.filter(c => !CATEGORY_ORDER.includes(c));
  const allCategories       = [...orderedCategories, ...remainingCategories];

  const filtered = (() => {
    if (activeFilter === "knowledge") return approvals.filter(a => !isApprovalCard(a));
    if (activeFilter === "approvals") return approvals.filter(a => isApprovalCard(a));
    if (activeFilter === "revenue_growth") return approvals.filter(a => a.category === "revenue_growth" || a.category === "division_briefing");
    return approvals.filter(a => a.category === activeFilter);
  })();

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
    background: active ? "#D4AF37" : "rgba(10,35,66,0.06)",
    color: active ? "#0A2342" : "rgba(10,35,66,0.6)",
    transition:"all 0.15s ease",
  });

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ flex:1, padding:"2rem 1.5rem", maxWidth:1100, margin:"0 auto", width:"100%" }}>

        {/* Header */}
        <div style={{ marginBottom:"1.5rem", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap" as const, gap:"1rem" }}>
          <div>
            <h1 style={{ fontFamily:"'Playfair Display', serif", color:"#0A2342", fontSize:"1.75rem", fontWeight:700, lineHeight:1.2, marginBottom:"0.2rem" }}>Intelligence Dashboard</h1>
            <p style={{ color:"rgba(10,35,66,0.45)", fontFamily:"'Inter', sans-serif", fontSize:"0.75rem" }}>Knowledge Vault: read, think and strategize · Approvals: publishing</p>
          </div>
          <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap" as const }}>
            <div onClick={() => window.location.href = "/admin-archived"} style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.72rem", fontWeight:700, color:"rgba(10,35,66,0.5)", border:"1px solid rgba(10,35,66,0.2)", borderRadius:8, padding:"0.6rem 1.25rem", letterSpacing:"0.06em", cursor:"pointer" }}>Archived →</div>
            <div onClick={() => window.location.href = "/admin"} style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.72rem", fontWeight:700, color:"#D4AF37", border:"1px solid rgba(212,175,55,0.35)", borderRadius:8, padding:"0.6rem 1.25rem", letterSpacing:"0.06em", cursor:"pointer" }}>← Profit Pulse</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"0.75rem", marginBottom:"0.75rem" }}>
          {[
            { label:"Pending Approval", value:pending,       color:"#D4AF37" },
            { label:"Knowledge Vault",  value:knowledge,     color:"#1E88E5" },
            { label:"Approved Today",   value:approvedToday, color:"#4CAF50" },
          ].map(s => (
            <div key={s.label} style={{ background:"#FFFFFF", border:"1px solid rgba(10,35,66,0.1)", borderRadius:10, padding:"0.875rem 1rem" }}>
              <p style={{ fontFamily:"'Playfair Display', serif", color:s.color, fontSize:"1.75rem", fontWeight:700, margin:0 }}>{s.value}</p>
              <p style={{ fontFamily:"'Montserrat', sans-serif", color:"rgba(10,35,66,0.45)", fontSize:"0.62rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, margin:"4px 0 0" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Community Member Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"0.75rem", marginBottom:"1rem" }}>
          {[
            { label:"CC Members",  value:memberCounts.total,       color:"#D4AF37" },
            { label:"Navigator",   value:memberCounts.navigator,   color:"#1E88E5" },
            { label:"Accelerator", value:memberCounts.accelerator, color:"#C2185B" },
          ].map(s => (
            <div key={s.label} style={{ background:"#FFFFFF", border:"1px solid rgba(212,175,55,0.15)", borderRadius:10, padding:"0.875rem 1rem" }}>
              <p style={{ fontFamily:"'Playfair Display', serif", color:s.color, fontSize:"1.75rem", fontWeight:700, margin:0 }}>{s.value}</p>
              <p style={{ fontFamily:"'Montserrat', sans-serif", color:"rgba(10,35,66,0.45)", fontSize:"0.62rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, margin:"4px 0 0" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Flagged Comments */}
        <div style={{ marginBottom:"1.75rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"0.75rem" }}>
            <h2 style={{ fontFamily:"'Playfair Display', serif", color:"#0A2342", fontSize:"1.1rem", fontWeight:700, margin:0 }}>Zoe/Micah CC Reply Queue</h2>
            {flaggedComments.length > 0 && (
              <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:"#C2185B", color:"#FFFFFF" }}>{flaggedComments.length}</span>
            )}
          </div>
          {flaggedLoading ? (
            <div style={{ padding:"0.75rem 1rem", color:"rgba(212,175,55,0.6)", fontFamily:"'Montserrat', sans-serif", fontSize:"0.72rem" }}>Loading...</div>
          ) : flaggedComments.length === 0 ? (
            <div style={{ padding:"0.75rem 1rem", background:"#FFFFFF", border:"1px solid rgba(10,35,66,0.1)", borderRadius:8 }}>
              <p style={{ fontFamily:"'Inter', sans-serif", color:"rgba(10,35,66,0.35)", fontSize:"0.75rem", margin:0 }}>No flagged comments</p>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column" as const, gap:"0.5rem" }}>
              {flaggedComments.map(fc => (
                <div key={fc.id} style={{ background:"rgba(194,24,91,0.04)", border:"1px solid rgba(194,24,91,0.2)", borderRadius:10, padding:"0.875rem 1rem", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"1rem" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.4rem", flexWrap:"wrap" as const }}>
                      <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.65rem", fontWeight:700, color:"#0A2342" }}>{(fc as any).profiles?.first_name ?? "Unknown Member"}</span>
                      {(fc as any).community_posts?.title && (<><span style={{ color:"rgba(10,35,66,0.3)", fontSize:"0.6rem" }}>on</span><span style={{ fontFamily:"'Inter', sans-serif", fontSize:"0.62rem", color:"rgba(212,175,55,0.9)" }}>{String((fc as any).community_posts.title).slice(0, 60)}</span></>)}
                      <span style={{ fontFamily:"'Inter', sans-serif", color:"rgba(10,35,66,0.35)", fontSize:"0.6rem" }}>{timeAgo(fc.created_at)}</span>
                    </div>
                    <p style={{ fontFamily:"'Inter', sans-serif", color:"rgba(10,35,66,0.65)", fontSize:"0.75rem", lineHeight:1.5, margin:0 }}>"{fc.content.slice(0, 200)}{fc.content.length > 200 ? "..." : ""}"</p>
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

        {/* Section Tabs */}
        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"0.75rem", flexWrap:"wrap" as const }}>
          <button onClick={() => setActiveFilter("knowledge")} style={sectionTabStyle(activeFilter === "knowledge", "#4A90D9")}>Knowledge Vault ({approvals.filter(a => !isApprovalCard(a)).length})</button>
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

        {loading && <div style={{ textAlign:"center" as const, padding:"3rem", color:"rgba(10,35,66,0.4)", fontFamily:"'Montserrat', sans-serif", fontSize:"0.75rem" }}>LOADING...</div>}
        {!loading && filtered.length === 0 && <div style={{ textAlign:"center" as const, padding:"3rem", color:"rgba(10,35,66,0.3)", fontFamily:"'Inter', sans-serif", fontSize:"0.85rem" }}>{activeFilter === "knowledge" ? "Knowledge Vault is clear — agents are standing by" : "No items in this category"}</div>}

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
              const isKnowledge   = READ_CATEGORIES.has(approval.category);
              const isSocial      = approval.category === "social";
              const isMulti       = isMultiPlatformCard(approval);
              const isReadyToUse  = READY_TO_USE_CATEGORIES.has(approval.category) || (isSocial && READY_TO_USE_PLATFORMS.has(approval.platform ?? ''));
              const currentDir    = leadDirection[approval.id] || "assessment_invite";
              const hasConversation = !!approval.context && approval.context !== "null";
              const currentMedia  = getMediaUrls(approval.id, approval);
              const activePlatformTab = getActivePlatformTab(approval.id);
              const activeContent = isMulti ? getActivePlatformContent(approval) : (approval.edited_output || approval.output);

              return (
                <div key={approval.id} style={{ borderRadius:12, overflow:"hidden", border:`1px solid ${isPostTrigger ? "rgba(194,24,91,0.35)" : isCCPost ? "rgba(45,90,142,0.35)" : isKnowledge ? "rgba(10,35,66,0.12)" : approval.status === "pending" ? "rgba(212,175,55,0.25)" : "rgba(10,35,66,0.08)"}`, background: approval.status !== "pending" ? "rgba(10,35,66,0.02)" : isPostTrigger ? "rgba(194,24,91,0.03)" : isCCPost ? "rgba(45,90,142,0.03)" : isKnowledge ? "rgba(10,35,66,0.02)" : "#FFFFFF", opacity:approval.status !== "pending" ? 0.7 : 1 }}>

                  {/* Card Header */}
                  <div style={{ background:"#071A2E", padding:"0.65rem 1rem", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap" as const, gap:"0.5rem" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", flexWrap:"wrap" as const }}>
                      {!isBriefing && approval.agent_name !== "DeAnna's AI Twin" && agentPhotoByName[approval.agent_name] && (
                        <img src={agentPhotoByName[approval.agent_name]} alt={approval.agent_name}
                          style={{ width:48, height:48, borderRadius:"50%", objectFit:"cover" as const, border:"1px solid rgba(212,175,55,0.5)", flexShrink:0 }} />
                      )}
                      <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.58rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:badge.color, color:"#FFFFFF" }}>{badge.text}</span>
                      {isMulti && <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.52rem", fontWeight:700, padding:"2px 7px", borderRadius:20, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", color:"rgba(255,255,255,0.8)" }}>3 Platforms</span>}
                      {isKnowledge && <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.52rem", fontWeight:700, padding:"2px 7px", borderRadius:20, background:"rgba(192,208,232,0.1)", border:"1px solid rgba(192,208,232,0.3)", color:"rgba(192,208,232,0.8)" }}>Knowledge Vault</span>}
                      <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.55rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:"transparent", border:`1px solid ${PRIORITY_COLORS[approval.priority] ?? PRIORITY_COLORS.NORMAL}`, color:PRIORITY_COLORS[approval.priority] ?? PRIORITY_COLORS.NORMAL }}>{approval.priority || "NORMAL"}</span>
                      <span style={{ fontFamily:"'Inter', sans-serif", color:"rgba(212,175,55,0.8)", fontSize:"0.62rem" }}>{isBriefing ? `${approval.division} Division` : `${approval.agent_name} · ${approval.agent_role}`}</span>
                      {isPDF && !isPostTrigger && !isCCReply && !isKnowledge && !isCCPost && <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.52rem", fontWeight:700, padding:"2px 7px", borderRadius:20, background:"rgba(166,137,32,0.2)", border:"1px solid rgba(166,137,32,0.5)", color:"#A68920" }}>PDF on Approve</span>}
                      {isLead && <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.52rem", fontWeight:700, padding:"2px 7px", borderRadius:20, background:"rgba(212,175,55,0.15)", border:"1px solid rgba(212,175,55,0.4)", color:"#D4AF37" }}>Routes to GHL</span>}
                      {isCCReply && <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.52rem", fontWeight:700, padding:"2px 7px", borderRadius:20, background:"rgba(45,90,142,0.2)", border:"1px solid rgba(45,90,142,0.5)", color:"#7BA7D4" }}>Posts to Community</span>}
                      {isCCPost && <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.52rem", fontWeight:700, padding:"2px 7px", borderRadius:20, background:"rgba(45,90,142,0.2)", border:"1px solid rgba(45,90,142,0.5)", color:"#7BA7D4" }}>Posts to Community</span>}
                      {isSocial && !isMulti && (currentMedia.video_url || currentMedia.image_url) && (
                        <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.52rem", fontWeight:700, padding:"2px 7px", borderRadius:20, background:"rgba(76,175,80,0.15)", border:"1px solid rgba(76,175,80,0.4)", color:"#4CAF50" }}>
                          {currentMedia.video_url ? "📹 Video" : "🖼 Image"} Ready
                        </span>
                      )}
                      {hasConversation && !qs.open && <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.52rem", fontWeight:700, padding:"2px 7px", borderRadius:20, background:"rgba(212,175,55,0.1)", border:"1px solid rgba(212,175,55,0.3)", color:"rgba(212,175,55,0.8)" }}>💬 Conversation saved</span>}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
                      {publishStatus[approval.id] && (
                        <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.55rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, color:publishStatus[approval.id] === "posted" ? "#4CAF50" : publishStatus[approval.id] === "posting" ? "#D4AF37" : "#C2185B" }}>
                          {getStatusText(approval, publishStatus[approval.id])}
                        </span>
                      )}
                      {approval.status !== "pending" && !publishStatus[approval.id] && <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.55rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, color:approval.status === "approved" ? "#4CAF50" : "#C2185B" }}>{approval.status}</span>}
                      <span style={{ fontFamily:"'Inter', sans-serif", color:"rgba(255,255,255,0.4)", fontSize:"0.6rem" }}>{timeAgo(approval.created_at)}</span>
                    </div>
                  </div>

                  {/* Platform Tabs — multi-platform social cards only */}
                  {isMulti && (
                    <div style={{ background:"rgba(10,35,66,0.03)", borderBottom:"1px solid rgba(10,35,66,0.08)", padding:"0.5rem 1rem", display:"flex", gap:"0.4rem", alignItems:"center" }}>
                      {(['LinkedIn', 'Facebook', 'Instagram'] as PlatformTab[]).map(platform => (
                        <button
                          key={platform}
                          onClick={() => setPlatformTabs(prev => ({ ...prev, [approval.id]: platform }))}
                          style={{
                            fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem", fontWeight:700,
                            padding:"0.3rem 0.75rem", borderRadius:20, cursor:"pointer",
                            border:`1px solid ${PLATFORM_COLORS[platform]}`,
                            background: activePlatformTab === platform ? PLATFORM_COLORS[platform] : "transparent",
                            color: activePlatformTab === platform ? "#FFFFFF" : PLATFORM_COLORS[platform],
                            transition:"all 0.15s ease",
                          }}
                        >
                          {platform}
                          {editingId === approval.id && editingPlatform === platform && (
                            <span style={{ marginLeft:4, opacity:0.8 }}>✏</span>
                          )}
                        </button>
                      ))}
                      <span style={{ fontFamily:"'Inter', sans-serif", fontSize:"0.58rem", color:"rgba(10,35,66,0.35)", marginLeft:"0.5rem" }}>
                        Viewing {activePlatformTab} content
                      </span>
                    </div>
                  )}

                  {/* Card Body */}
                  <div style={{ padding:"1rem", display:"grid", gridTemplateColumns:isBriefing ? "1fr 2fr" : "1fr 1fr", gap:"1rem" }}>
                    <div>
                      <p style={{ fontFamily:"'Montserrat', sans-serif", color:"rgba(212,175,55,0.8)", fontSize:"0.58rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" as const, marginBottom:"0.5rem" }}>{origCol.heading}</p>
                      <p style={{ fontFamily:"'Inter', sans-serif", color:"rgba(10,35,66,0.7)", fontSize:"0.75rem", lineHeight:1.6, margin:0 }}>{origCol.content ?? <em style={{ color:"rgba(10,35,66,0.3)" }}>No content</em>}</p>
                      {isBriefing && divAgents.length > 0 && (() => {
                        // Only these categories are genuine multi-agent roll-ups where more than
                        // one agent's work could appear in a single card — text-matching is needed
                        // to figure out who's actually in today's synthesis.
                        const isMultiAgentRollup = ['daily_briefing','revenue_growth','content_brand','marketing','legal_finance','ai_governance','hr','client_delivery','customer_support'].includes(approval.category);
                        let agentsToShow: typeof divAgents;
                        if (isMultiAgentRollup) {
                          const contentText = approval.edited_output || approval.output || '';
                          const eligible = divAgents.filter(a => a.agent_name !== "DeAnna's AI Twin");
                          const mentioned = eligible.filter(a => contentText.includes(a.agent_name));
                          agentsToShow = mentioned.length > 0 ? mentioned : eligible;
                        } else {
                          // Single-owner card (grants, content_review, etc.) — the contributor is
                          // already known exactly from agent_name. Never guess or show a roster.
                          agentsToShow = divAgents.filter(a => a.agent_name === approval.agent_name);
                        }
                        const withPhotos = agentsToShow.filter(a => agentPhotoByName[a.agent_name]);
                        if (withPhotos.length === 0) return null;
                        return (
                          <div style={{ display:"flex", flexWrap:"wrap" as const, gap:"0.6rem", marginTop:"0.75rem" }}>
                            {withPhotos.map(a => (
                              <img key={a.agent_id} src={agentPhotoByName[a.agent_name]} alt={a.agent_name} title={`${a.agent_name} · ${a.role}`}
                                style={{ width:52, height:52, borderRadius:"50%", objectFit:"cover" as const, border:"1px solid rgba(212,175,55,0.4)" }} />
                            ))}
                          </div>
                        );
                      })()}
                      {isCCPost && (() => {
                        const signal = getUpsellSignal(approval.edited_output || approval.output);
                        return signal ? (
                          <div style={{ marginTop:"0.75rem", padding:"0.5rem 0.625rem", background:"rgba(212,175,55,0.07)", border:"1px solid rgba(212,175,55,0.25)", borderRadius:6 }}>
                            <p style={{ fontFamily:"'Montserrat', sans-serif", color:"rgba(212,175,55,0.85)", fontSize:"0.52rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" as const, margin:"0 0 0.25rem" }}>Upsell Signal</p>
                            <p style={{ fontFamily:"'Inter', sans-serif", color:"rgba(10,35,66,0.65)", fontSize:"0.68rem", lineHeight:1.5, margin:0 }}>{signal}</p>
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <div>
                      <p style={{ fontFamily:"'Montserrat', sans-serif", color:"rgba(212,175,55,0.8)", fontSize:"0.58rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" as const, marginBottom:"0.5rem" }}>{draftHead}</p>
                      {editingId === approval.id ? (
                        <textarea value={editText} onChange={e => setEditText(e.target.value)} style={{ width:"100%", minHeight:isBriefing ? 200 : 100, background:"#FFFFFF", border:"1px solid rgba(212,175,55,0.4)", borderRadius:6, color:"#0A2342", fontFamily:"'Inter', sans-serif", fontSize:"0.75rem", padding:"0.5rem", lineHeight:1.6, resize:"vertical" as const, boxSizing:"border-box" as const, outline:"none" }} />
                      ) : (
                        <div>{renderDraft(isCCPost ? stripUpsellSignal(activeContent) : activeContent)}</div>
                      )}
                    </div>
                  </div>

                  {/* Platform Toggles — multi-platform pending cards */}
                  {isMulti && approval.status === "pending" && editingId !== approval.id && (
                    <div style={{ padding:"0 1rem 0.75rem" }}>
                      <div style={{ background:"rgba(10,35,66,0.02)", border:"1px solid rgba(10,35,66,0.08)", borderRadius:8, padding:"0.625rem 1rem", display:"flex", alignItems:"center", gap:"1.25rem", flexWrap:"wrap" as const }}>
                        <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.58rem", fontWeight:700, color:"rgba(10,35,66,0.45)", letterSpacing:"0.08em", textTransform:"uppercase" as const, flexShrink:0 }}>Post to:</span>
                        {(['LinkedIn', 'Facebook', 'Instagram'] as PlatformTab[]).map(platform => {
                          const checked = getPlatformToggle(approval.id, platform);
                          return (
                            <label key={platform} style={{ display:"flex", alignItems:"center", gap:"0.35rem", cursor:"pointer" }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePlatform(approval.id, platform)}
                                style={{ accentColor: PLATFORM_COLORS[platform], width:14, height:14 }}
                              />
                              <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, color: checked ? PLATFORM_COLORS[platform] : "rgba(10,35,66,0.3)", transition:"color 0.15s" }}>{platform}</span>
                            </label>
                          );
                        })}
                        {getSelectedPlatforms(approval.id).length === 0 && (
                          <span style={{ fontFamily:"'Inter', sans-serif", fontSize:"0.6rem", color:"#C2185B" }}>Select at least one platform</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Media URLs — social posts only */}
                  {isSocial && approval.status === "pending" && (
                    <div style={{ padding:"0 1rem 0.875rem" }}>
                      <div style={{ background:"rgba(10,35,66,0.02)", border:"1px solid rgba(10,35,66,0.08)", borderRadius:8, padding:"0.75rem 1rem" }}>
                        <p style={{ fontFamily:"'Montserrat', sans-serif", color:"rgba(212,175,55,0.8)", fontSize:"0.58rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" as const, marginBottom:"0.625rem", margin:"0 0 0.625rem" }}>Media · Optional</p>
                        <div style={{ display:"flex", flexDirection:"column" as const, gap:"0.4rem" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:"0.625rem" }}>
                            <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem", fontWeight:600, color:"rgba(10,35,66,0.45)", minWidth:100, flexShrink:0 }}>Bunny MP4 URL{isMulti ? " (LinkedIn + FB)" : ""}</span>
                            <input
                              type="text"
                              value={currentMedia.video_url}
                              onChange={e => setMediaUrl(approval.id, 'video_url', e.target.value)}
                              placeholder="Paste Bunny MP4 URL — play_720p.mp4"
                              style={{ flex:1, background:"#FFFFFF", border:`1px solid ${currentMedia.video_url ? "rgba(76,175,80,0.4)" : "rgba(10,35,66,0.15)"}`, borderRadius:6, color:"#0A2342", fontFamily:"'Inter', sans-serif", fontSize:"0.68rem", padding:"0.35rem 0.625rem", outline:"none" }}
                            />
                          </div>
                          {isMulti && (
                            <div style={{ display:"flex", alignItems:"center", gap:"0.625rem" }}>
                              <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem", fontWeight:600, color:"rgba(194,24,91,0.7)", minWidth:100, flexShrink:0 }}>IG Reel URL (9:16)</span>
                              <input
                                type="text"
                                value={currentMedia.instagram_video_url}
                                onChange={e => setMediaUrl(approval.id, 'instagram_video_url', e.target.value)}
                                placeholder="Paste Bunny MP4 URL — play_720p.mp4 (9:16 reel)"
                                style={{ flex:1, background:"#FFFFFF", border:`1px solid ${currentMedia.instagram_video_url ? "rgba(194,24,91,0.4)" : "rgba(10,35,66,0.15)"}`, borderRadius:6, color:"#0A2342", fontFamily:"'Inter', sans-serif", fontSize:"0.68rem", padding:"0.35rem 0.625rem", outline:"none" }}
                              />
                            </div>
                          )}
                          {(isMulti || approval.platform === 'Facebook') && (
                            <div style={{ display:"flex", alignItems:"center", gap:"0.625rem" }}>
                              <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem", fontWeight:600, color:"rgba(24,119,242,0.8)", minWidth:100, flexShrink:0 }}>FB Reel · 9:16 vertical only · 1080×1920</span>
                              <input
                                type="text"
                                value={currentMedia.facebook_reel_url}
                                onChange={e => setMediaUrl(approval.id, 'facebook_reel_url', e.target.value)}
                                placeholder="Paste Bunny MP4 URL — play_720p.mp4 (vertical 9:16 only, leave blank to skip Reel)"
                                style={{ flex:1, background:"#FFFFFF", border:`1px solid ${currentMedia.facebook_reel_url ? "rgba(24,119,242,0.4)" : "rgba(10,35,66,0.15)"}`, borderRadius:6, color:"#0A2342", fontFamily:"'Inter', sans-serif", fontSize:"0.68rem", padding:"0.35rem 0.625rem", outline:"none" }}
                              />
                            </div>
                          )}
                          <div style={{ display:"flex", alignItems:"center", gap:"0.625rem" }}>
                            <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem", fontWeight:600, color:"rgba(10,35,66,0.45)", minWidth:100, flexShrink:0 }}>Image URL</span>
                            <input
                              type="text"
                              value={currentMedia.image_url}
                              onChange={e => setMediaUrl(approval.id, 'image_url', e.target.value)}
                              placeholder="https://vz-65fe52c5-439.b-cdn.net/[image-guid]/thumbnail.jpg"
                              style={{ flex:1, background:"#FFFFFF", border:`1px solid ${currentMedia.image_url ? "rgba(76,175,80,0.4)" : "rgba(10,35,66,0.15)"}`, borderRadius:6, color:"#0A2342", fontFamily:"'Inter', sans-serif", fontSize:"0.68rem", padding:"0.35rem 0.625rem", outline:"none" }}
                            />
                          </div>
                        </div>
                        {currentMedia.image_url && (
                          <div style={{ marginTop:"0.5rem" }}>
                            <img src={currentMedia.image_url} alt="Preview" onError={e => (e.currentTarget.style.display = 'none')} style={{ height:56, borderRadius:4, border:"1px solid rgba(10,35,66,0.1)", objectFit:"cover" as const }} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Lead Direction */}
                  {isLead && approval.status === "pending" && editingId !== approval.id && (
                    <div style={{ margin:"0 1rem 0.75rem", padding:"0.75rem", background:"rgba(212,175,55,0.04)", border:"1px solid rgba(212,175,55,0.2)", borderRadius:8 }}>
                      <p style={{ fontFamily:"'Montserrat', sans-serif", color:"rgba(212,175,55,0.9)", fontSize:"0.58rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" as const, marginBottom:"0.5rem" }}>Route this lead to:</p>
                      <div style={{ display:"flex", flexWrap:"wrap" as const, gap:"0.4rem" }}>
                        {LEAD_DIRECTIONS.map(opt => (
                          <button key={opt.value} onClick={() => setLeadDirection(prev => ({ ...prev, [approval.id]: opt.value }))}
                            style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem", fontWeight:700, padding:"0.3rem 0.875rem", borderRadius:20, cursor:"pointer", border:`1px solid ${currentDir === opt.value ? "#D4AF37" : "rgba(10,35,66,0.2)"}`, background:currentDir === opt.value ? "rgba(212,175,55,0.15)" : "transparent", color:currentDir === opt.value ? "#D4AF37" : "rgba(10,35,66,0.5)", transition:"all 0.15s" }}>
                            {opt.label}{opt.value === "assessment_invite" && <span style={{ marginLeft:4, opacity:0.6, fontSize:"0.52rem" }}>★ default</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ask a Question */}
                  {qs.open && approval.status === "pending" && !isPostTrigger && (
                    <div style={{ margin:"0 1rem", padding:"0.875rem", background:"rgba(10,35,66,0.03)", border:"1px solid rgba(212,175,55,0.2)", borderRadius:8, marginBottom:"0.5rem" }}>
                      {isBriefing && approval.category !== "daily_briefing" && !isCCReply && !isCCPost && (
                        <div style={{ marginBottom:"0.75rem" }}>
                          <p style={{ fontFamily:"'Montserrat', sans-serif", color:"rgba(212,175,55,0.8)", fontSize:"0.58rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" as const, marginBottom:"0.4rem" }}>Who are you asking?</p>
                          <div style={{ display:"flex", flexWrap:"wrap" as const, gap:"0.4rem" }}>
                            {divAgents.map(agent => (
                              <button key={agent.agent_id} onClick={() => setQS(approval.id, { selectedAgent:agent })}
                                style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem", fontWeight:700, padding:"0.3rem 0.75rem", borderRadius:20, cursor:"pointer", border:`1px solid ${qs.selectedAgent?.agent_id === agent.agent_id ? "#D4AF37" : "rgba(10,35,66,0.2)"}`, background:qs.selectedAgent?.agent_id === agent.agent_id ? "rgba(212,175,55,0.15)" : "transparent", color:qs.selectedAgent?.agent_id === agent.agent_id ? "#D4AF37" : "rgba(10,35,66,0.5)", transition:"all 0.15s" }}>
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
                            <div key={i} style={{ padding:"0.5rem 0.75rem", borderRadius:8, background:msg.role === "user" ? "rgba(212,175,55,0.08)" : "#FFFFFF", border:`1px solid ${msg.role === "user" ? "rgba(212,175,55,0.2)" : "rgba(10,35,66,0.1)"}` }}>
                              <p style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.55rem", fontWeight:700, letterSpacing:"0.08em", color:msg.role === "user" ? "#D4AF37" : "rgba(10,35,66,0.4)", marginBottom:"0.25rem", textTransform:"uppercase" as const }}>{msg.role === "user" ? "You" : msg.agentName}</p>
                              <p style={{ fontFamily:"'Inter', sans-serif", fontSize:"0.75rem", color:"#0A2342", lineHeight:1.6, margin:0 }}>{msg.text}</p>
                            </div>
                          ))}
                          {qs.loading && (
                            <div style={{ padding:"0.5rem 0.75rem", borderRadius:8, background:"rgba(10,35,66,0.03)", border:"1px solid rgba(10,35,66,0.08)" }}>
                              <p style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.55rem", fontWeight:700, color:"rgba(212,175,55,0.6)", margin:0, letterSpacing:"0.08em" }}>{qs.selectedAgent?.agent_name ?? "Agent"} is responding...</p>
                            </div>
                          )}
                        </div>
                      )}
                      {qs.selectedAgent && (
                        <div style={{ display:"flex", gap:"0.5rem" }}>
                          <input type="text" value={qs.input} onChange={e => setQS(approval.id, { input:e.target.value })} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAskQuestion(approval); } }} placeholder={`Ask ${qs.selectedAgent.agent_name} a question...`} disabled={qs.loading}
                            style={{ flex:1, background:"#FFFFFF", border:"1px solid rgba(212,175,55,0.3)", borderRadius:6, color:"#0A2342", fontFamily:"'Inter', sans-serif", fontSize:"0.75rem", padding:"0.5rem 0.75rem", outline:"none", opacity:qs.loading ? 0.6 : 1 }} />
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
                        style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem", fontWeight:700, padding:"0.4rem 0.875rem", borderRadius:6, cursor:"pointer", border:`1px solid ${qs.open ? "rgba(212,175,55,0.6)" : hasConversation ? "rgba(212,175,55,0.4)" : "rgba(10,35,66,0.2)"}`, background:qs.open ? "rgba(212,175,55,0.1)" : hasConversation ? "rgba(212,175,55,0.05)" : "transparent", color:qs.open ? "#D4AF37" : hasConversation ? "rgba(212,175,55,0.8)" : "rgba(10,35,66,0.4)", letterSpacing:"0.06em" }}>
                        {qs.open ? "✕ Close" : hasConversation ? "💬 Continue Conversation" : "? Ask a Question"}
                      </button>
                    )}
                    <div style={{ display:"flex", gap:"0.5rem", marginLeft:"auto" }}>
                      {isKnowledge && approval.status === "pending" && editingId !== approval.id && (
                        <button onClick={() => handleRead(approval.id)} disabled={saving === approval.id}
                          style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1.25rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(30,136,229,0.4)", background:"rgba(30,136,229,0.08)", color:"#1E88E5", letterSpacing:"0.06em", opacity:saving === approval.id ? 0.6 : 1 }}>
                          {saving === approval.id ? "..." : "Read ✓"}
                        </button>
                      )}
                      {isPostTrigger && approval.status === "pending" && editingId !== approval.id && (
                        <button onClick={() => handleArchive(approval.id)} disabled={saving === approval.id}
                          style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1.25rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(10,35,66,0.2)", background:"transparent", color:"rgba(10,35,66,0.5)", letterSpacing:"0.06em", opacity:saving === approval.id ? 0.6 : 1 }}>
                          {saving === approval.id ? "..." : "Dismiss"}
                        </button>
                      )}
                      {!isKnowledge && approval.status === "pending" && editingId !== approval.id && !isPostTrigger && (
                        <>
                          <button onClick={() => handleReject(approval.id)} disabled={saving === approval.id} style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(194,24,91,0.5)", background:"transparent", color:"#C2185B", letterSpacing:"0.06em" }}>Reject</button>
                          <button onClick={() => handleEditStart(approval)} style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(212,175,55,0.4)", background:"transparent", color:"#D4AF37", letterSpacing:"0.06em" }}>
                            {isMulti ? `Edit ${activePlatformTab}` : "Edit"}
                          </button>
                          {/* Ready to Use — reusable deliverables (Client Delivery, Customer Support, Marketing, Content & Brand,
                              Grants, plus individual folders: Ravi/Chloe/Kwame via platform tag, Theo/Jordan/Simone/Amelia/Nia via content_review) */}
                          {isReadyToUse ? (
                            <button
                              onClick={() => handleReadyToUse(approval.id)}
                              disabled={saving === approval.id}
                              style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1.25rem", borderRadius:6, cursor:"pointer", border:"none", background:"#0A2342", color:"#FAFAF8", letterSpacing:"0.06em", opacity:saving === approval.id ? 0.6 : 1 }}>
                              {saving === approval.id ? "..." : "Ready to Use ✓"}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleApprove(approval.id)}
                              disabled={saving === approval.id || (isMulti && getSelectedPlatforms(approval.id).length === 0)}
                              style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1.25rem", borderRadius:6, cursor:"pointer", border:"none", background:"#D4AF37", color:"#0A2342", letterSpacing:"0.06em", opacity:(saving === approval.id || (isMulti && getSelectedPlatforms(approval.id).length === 0)) ? 0.6 : 1 }}>
                              {saving === approval.id ? "..." : isCCReply ? "Approve + Post →" : isCCPost ? "Approve + Post →" : isUpsell ? "Approve + Send →" : isPDF ? "Approve + PDF ↓" : isLead ? "Approve + Route →" : isSocial ? "Approve + Publish →" : approval.category === "social_response" ? "Send Reply ✓" : "Approve ✓"}
                            </button>
                          )}
                          {/* Ready to Use bank — available on ALL social cards for content banking */}
                          {isSocial && !isReadyToUse && approval.status === 'pending' && (
                            <button
                              onClick={() => handleReadyToUse(approval.id)}
                              disabled={saving === approval.id}
                              style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(10,35,66,0.3)", background:"transparent", color:"rgba(10,35,66,0.5)", letterSpacing:"0.06em", opacity:saving === approval.id ? 0.6 : 1 }}>
                              Bank ✓
                            </button>
                          )}
                          {/* Yara — Post to Community button (CC + ACC, English + Spanish toggle) */}
                          {isMulti && approval.platform === 'LinkedIn' && approval.agent_name === 'Yara Mansour' && approval.status === 'pending' && (
                            <button
                              onClick={async () => {
                                setSaving(approval.id);
                                const ok = await postYaraToCommunity(approval);
                                setPublishStatus(prev => ({ ...prev, [`${approval.id}_community`]: ok ? "posted" : "failed" }));
                                setSaving(null);
                              }}
                              disabled={saving === approval.id}
                              style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"1px solid #C2185B", background:"transparent", color:"#C2185B", letterSpacing:"0.06em", opacity:saving === approval.id ? 0.6 : 1 }}>
                              {publishStatus[`${approval.id}_community`] === 'posted' ? "✓ Posted" : publishStatus[`${approval.id}_community`] === 'failed' ? "⚠ Failed" : "🌐 Post to Community"}
                            </button>
                          )}
                        </>
                      )}
                      {editingId === approval.id && (
                        <>
                          <button onClick={() => { setEditingId(null); setEditingPlatform(null); }} style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(10,35,66,0.2)", background:"transparent", color:"rgba(10,35,66,0.5)", letterSpacing:"0.06em" }}>Cancel</button>
                          <button onClick={() => handleEditSave(approval.id)} disabled={saving === approval.id} style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"none", background:"#D4AF37", color:"#0A2342", letterSpacing:"0.06em", opacity:saving === approval.id ? 0.6 : 1 }}>
                            {saving === approval.id ? "Saving..." : isMulti ? `Save ${editingPlatform} & Publish` : "Save & Approve"}
                          </button>
                        </>
                      )}
                      {approval.status !== "pending" && editingId !== approval.id && (
                        <button onClick={() => handleArchive(approval.id)} disabled={saving === approval.id} style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.62rem", fontWeight:700, padding:"0.45rem 1rem", borderRadius:6, cursor:"pointer", border:"1px solid rgba(10,35,66,0.15)", background:"transparent", color:"rgba(10,35,66,0.4)", letterSpacing:"0.06em" }}>Archive</button>
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

        <footer style={{ textAlign:"center" as const, padding:"0.75rem 0 0", color:"rgba(10,35,66,0.3)", fontFamily:"'Montserrat', sans-serif", fontSize:"0.6rem" }}>
          © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
        </footer>
      </main>
    </AdminLayout>
  );
}
