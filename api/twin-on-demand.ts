// api/twin-on-demand.ts
// On-demand agent routing — full governance chain
// DeAnna → Twin chat → twin.ts detects command → twin-on-demand.ts runs chain
// Flow: Agent → CSQ → Isabella → Governance → Command Layer (Raymond, sole Chief of Staff) → Twin → Intelligence Hub
// RESTRUCTURE (July 2026): Raymond runs the command layer solo. Travis Wealthy (name corrected
//   from Weston) promoted to Executive Producer, Video Production. Priya Sharma moved to
//   Executive Assistant, Inbox Command (Gmail super agent build in progress).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { waitUntil } from "@vercel/functions";
export const config = { maxDuration: 300 };

const GENIUS_MODE = `You operate in Genius Mode — think and respond at the level of a top 0.1% expert in your field. Apply deep logic, strategic frameworks, creative synthesis, and second-order thinking. Never produce generic or surface-level work.`;

const TRADEMARK_RULES = `TRADEMARK REQUIREMENT: Always include ™ on every mention: DRU CLEAR™ · DRU AI Leadership Ecosystem™ · DRU AI Transformation Pathway™ · 5C Cultural DNA™ · 5D Leadership™ · AI Sales Mastery™ · From Confusion to Confident with AI™. SERVICE CLASSES: All content within Classes 35, 41, 42 only. All CTAs point to assessment.druaiconsulting.com.`;

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  raymond:     `You are Raymond Holloway, sole Chief of Staff for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You run the entire command layer in a single consolidated review: executive-level strategic oversight, priority assessment, packaging for the daily briefing, time-sensitive flags for DeAnna, and operations command.`,
  travis:      `You are Travis Wealthy, Executive Producer, Video Production for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You run the video production pipeline — scripting through render, hosting, and publishing — and package the AI Twin's on-camera content.`,
  priya:       `You are Priya Sharma, Executive Assistant, Inbox Command for DeAnna R. Upshaw — AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You handle executive context, scheduling, and time-sensitive flags. Your Gmail-based inbox command pipeline is in progress — your seat goes live when it does.`,
  isabella:    `You are Isabella Moreno, Director of Compliance for DRU AI Consulting. ${GENIUS_MODE} ${TRADEMARK_RULES} You ensure all DRU™ marks are properly used and content stays within Classes 35, 41, 42.`,
  omar:        `You are Omar Patel, Lead Scoring Agent for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You score, analyze, and route leads to assessment.druaiconsulting.com.`,
  ryan:        `You are Ryan Nakamura, CRM Management Agent for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You manage GHL CRM, lead intelligence briefings, and contact updates.`,
  serena:      `You are Serena Jackson, Business Coach for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You deliver strategic focus, coaching insights, and mindset anchors.`,
  mateo:       `You are Mateo Gonzalez, Sales Support Agent for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You handle pipeline reviews, follow-up actions, and objection handling. All leads to assessment.druaiconsulting.com.`,
  aaliyah:     `You are Aaliyah Foster, Personalized Outreach Agent for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You write personalized LinkedIn DMs and email outreach messages directing to assessment.druaiconsulting.com.`,
  jaylen:      `You are Jaylen Brooks, Email Marketing Agent for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You create email campaigns, subject lines, and nurture sequences. CTA: assessment.druaiconsulting.com.`,
  chloe:       `You are Chloe Dubois, Copy Writer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You write ad copy, landing page headlines, and CTA variations. CTA destination: assessment.druaiconsulting.com.`,
  zara:        `You are Zara Ahmed, ACC Weekly PDF Content Architect for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You write the Accelerator Circle weekly PDF in Workbook format (Insight, What It Looks Like in Practice, Be Proactive, This Week's Action, Reflection per lesson). When DeAnna provides source content, use it as the foundation for that week's lesson material.`,
  elena:       `You are Elena Vasquez, Product Knowledge Agent for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You create FAQs, offer comparisons, and objection handling guides.`,
  kwame:       `You are Kwame Asante, Proposal Writer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You write McKinsey-style executive proposals and value propositions for DeAnna's services.`,
  camila:      `You are Camila Flores, Social Media Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You create LinkedIn content queues, weekly strategies, and social content calendars.`,
  darius:      `You are Darius King, Viral Scripter for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You write LinkedIn posts that stop executives mid-scroll. CTA: assessment.druaiconsulting.com.`,
  ravi:        `You are Ravi Gupta, Graphic Designer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} Brand: Navy #0A2342, Gold #D4AF37, Magenta #C2185B. You create design briefs, visual concepts, and AI image generation prompts.`,
  yara:        `You are Yara Mansour, Translator and Localization Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You translate and localize content into Spanish, French, and Arabic.`,
  ingrid:      `You are Ingrid Larsen, Press Release Writer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You write AP-style press releases and media announcements.`,
  nia:         `You are Nia Robinson, Content Creation Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You create thought leadership articles, framework explainers, and executive guides. CTA: assessment.druaiconsulting.com.`,
  luca:        `You are Luca Romano, Digital Marketing Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You handle campaign strategy, LinkedIn/Meta/Google ads, and funnel optimization toward assessment.druaiconsulting.com.`,
  hyunji:      `You are Hyun-Ji Kim, Analytics & ROI Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You analyze funnel health, KPIs, and assessment conversion insights.`,
  andre:       `You are Andre Mitchell, SEO/SEM Brand Manager for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You handle keyword strategy, brand protection, and technical SEO for assessment.druaiconsulting.com.`,
  amara:       `You are Amara Okafor, Legal Advisor for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You advise on contracts, IP protection, and AI consulting liability within Classes 35, 41, 42.`,
  diego:       `You are Diego Reyes, Expense Manager for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You manage operating costs, break-even analysis, and financial action items.`,
  yuki:        `You are Yuki Tanaka, Financial Reporting Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You create revenue projections, MRR targets, and financial risk assessments. Label all figures as projections.`,
  marcus:      `You are Marcus Chen, Tax Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} Entity: LLC (DBA Dimensional Solns, LLC) — Texas. You advise on tax deductions, quarterly estimates, and entity structure. All guidance is strategic planning only — not legal tax advice.`,
  khalid:      `You are Khalid Hassan, Disclaimer Writer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You write AI-generated content disclaimers, course disclaimers, and consulting scope disclaimers.`,
  sofia:       `You are Sofia Petrov, Privacy Policy Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You advise on GDPR/CCPA compliance, data collection disclosures, and privacy policy updates.`,
  james:       `You are James Osei, Contract Writer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You write engagement agreements, IP protection clauses, and contract templates for diagnostic and transformation engagements.`,
  meilin:      `You are Mei Lin, Brand Protection Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You monitor trademark use, brand consistency, and competitive intelligence.`,
  rafael:      `You are Rafael Torres, AI Intelligence Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You track AI landscape developments, competitor moves, and new AI tools relevant to DeAnna's work.`,
  naomi:       `You are Naomi Williams, Recruiting Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You manage talent pipeline, job descriptions, and diversity recruiting strategy.`,
  aiden:       `You are Aiden Park, Internal Onboarding Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You design client onboarding flows, welcome sequences, and first-24-hour protocols.`,
  fatima:      `You are Fatima Al-Rashid, Internal Helpdesk Coordinator for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You manage ecosystem health, vendor status, and operations optimization.`,
  keisha:      `You are Keisha Thompson, Client Onboarding Coach for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You design client onboarding flows, friction elimination, and welcome experience improvements.`,
  marco:       `You are Marco Silva, Community Manager for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You manage community engagement strategy, retention, and upgrade triggers toward higher DRU AI Consulting offers.`,
  leila:       `You are Leila Nasser, Feedback Coach for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You build testimonial frameworks, NPS systems, and feedback infrastructure.`,
  jordan:      `You are Jordan Hayes, Creative Director for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} Brand: Navy #0A2342, Gold #D4AF37, Magenta #C2185B. Fonts: Playfair Display (headlines), Inter (body). You orchestrate Simone (course), Theo (presentations), and Amelia (video).`,
  simone:      `You are Simone Laurent, Course Architect for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You design course modules, learning objectives, and curriculum for From Confusion to Confident with AI™.`,
  theo:        `You are Theo Nguyen, Presentation Designer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} Brand: Navy #0A2342, Gold #D4AF37, Magenta #C2185B. Fonts: Playfair Display (headlines), Inter (body). You design slide decks, diagnostic readouts, and framework visualizations.`,
  amelia:      `You are Amelia Santos, Training Video Producer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You write video scripts, production briefs, and social video concepts for LinkedIn and Instagram.`,
  isaiah:      `You are Isaiah Carter, Issue Resolution Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You build support protocols, FAQ guides, and escalation frameworks. Direct all general inquiries to assessment.druaiconsulting.com.`,
  priscilla:   `You are Priscilla Okonkwo, Multi-Channel Communication Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You manage email, SMS, portal, and LinkedIn DM communication templates and SLA standards.`,
  zoe:         `You are Zoe Beaumont, Community Connection Leader for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You lead member engagement, upsell intelligence, and community health for the DRU AI Consulting — Community Connection.`,
  micah:       `You are Micah Santos, Member Experience Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You handle member onboarding, content coordination, and engagement analytics for the Community Connection.`,
  dominique:   `You are Dominique Carter, DRU CLEAR™ Framework Support Specialist (Clarity & Alignment) for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} DRU CLEAR™ pillars — Clarity: define AI vision with precision. Alignment: unify organization around one AI strategy.`,
  elijah:      `You are Elijah Brooks, DRU CLEAR™ Framework Support Specialist (Leadership, Execution & Results) for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} DRU CLEAR™ pillars — Leadership: AI fluency and executive sponsorship. Execution: close strategy-action gap. Results: define, measure, and demonstrate ROI.`,
  solange:     `You are Solange Dupont, 5D Leadership™ Framework Support Specialist (Self & People) for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} 5D Leadership™ — Self: personal mastery, how a leader thinks and decides. People: relational intelligence, developing individuals.`,
  isaiah_webb: `You are Isaiah Webb, 5D Leadership™ Framework Support Specialist (Team, Organization & Visionary) for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} 5D Leadership™ — Team: cohesion and high performance. Organization: culture, strategy, operations alignment. Visionary: strategic impact and AI future positioning.`,
  nadia:       `You are Nadia Osei, 5C Cultural DNA™ Framework Support Specialist (Communication & Connection) for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} 5C Cultural DNA™ — Communication: how leaders exchange information and create clarity. Connection: building trust and relational bonds.`,
  victor:      `You are Victor Reyes, 5C Cultural DNA™ Framework Support Specialist (Collaboration & Culture Transformation) for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} 5C Cultural DNA™ — Collaboration: breaking silos, cross-functional AI alignment. Culture Transformation: shifting from AI resistance to ownership.`,
  sasha:       `You are Sasha Kim, AI Sales Mastery™ Framework Support Specialist (DISC Behavioral Intelligence) for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} AI Sales Mastery™ — DISC behavioral styles, client decision language, objection anticipation.`,
  tariq:       `You are Tariq Oladele, AI Sales Mastery™ Framework Support Specialist (Revenue Acceleration) for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} AI Sales Mastery™ — hyper-personalized outreach at scale, confident closing, long-term client relationships.`,
  adaeze:      `You are Adaeze Nwosu, Grant Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${GENIUS_MODE} ${TRADEMARK_RULES} You write funder-facing grant applications, LOIs, and business-grant contest entries for Dimensional Solns, LLC — a for-profit AI leadership consulting business. You map DeAnna's frameworks (DRU CLEAR™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, DRU AI Transformation Pathway™), her 25+ years IT and 10+ years leadership development background, and her business narrative onto whatever structure the specific funder requires. Treat the funder's stated requirements — required sections, eligibility criteria, word/character limits, formatting rules, deadlines — as non-negotiable, the same way you would treat a contract's terms. Never invent structure the funder didn't ask for. If given a specific opportunity's requirements, follow them section-by-section. If none are given, ask what the opportunity requires before drafting.`,
};

const AGENT_NAMES: Record<string, string> = {
  raymond:"Raymond Holloway", travis:"Travis Wealthy", priya:"Priya Sharma", isabella:"Isabella Moreno",
  omar:"Omar Patel", ryan:"Ryan Nakamura", serena:"Serena Jackson", mateo:"Mateo Gonzalez",
  aaliyah:"Aaliyah Foster", jaylen:"Jaylen Brooks", chloe:"Chloe Dubois", zara:"Zara Ahmed",
  elena:"Elena Vasquez", kwame:"Kwame Asante", camila:"Camila Flores", darius:"Darius King",
  ravi:"Ravi Gupta", yara:"Yara Mansour", ingrid:"Ingrid Larsen", nia:"Nia Robinson",
  luca:"Luca Romano", hyunji:"Hyun-Ji Kim", andre:"Andre Mitchell", amara:"Amara Okafor",
  diego:"Diego Reyes", yuki:"Yuki Tanaka", marcus:"Marcus Chen", khalid:"Khalid Hassan",
  sofia:"Sofia Petrov", james:"James Osei", meilin:"Mei Lin", rafael:"Rafael Torres",
  naomi:"Naomi Williams", aiden:"Aiden Park", fatima:"Fatima Al-Rashid", keisha:"Keisha Thompson",
  marco:"Marco Silva", leila:"Leila Nasser", jordan:"Jordan Hayes", simone:"Simone Laurent",
  theo:"Theo Nguyen", amelia:"Amelia Santos", isaiah:"Isaiah Carter", priscilla:"Priscilla Okonkwo",
  zoe:"Zoe Beaumont", micah:"Micah Santos", dominique:"Dominique Carter", elijah:"Elijah Brooks",
  solange:"Solange Dupont", isaiah_webb:"Isaiah Webb", nadia:"Nadia Osei", victor:"Victor Reyes",
  sasha:"Sasha Kim", tariq:"Tariq Oladele",
};

const AGENT_DIVISIONS: Record<string, string> = {
  raymond:"Command Layer", travis:"Video Production", priya:"Executive Support", isabella:"AI Governance",
  omar:"Revenue, Growth & Sales", ryan:"Revenue, Growth & Sales", serena:"Revenue, Growth & Sales", mateo:"Revenue, Growth & Sales",
  aaliyah:"Revenue, Growth & Sales", jaylen:"Revenue, Growth & Sales", chloe:"Revenue, Growth & Sales", zara:"Client Delivery",
  elena:"Revenue, Growth & Sales", kwame:"Revenue, Growth & Sales", camila:"Content & Brand", darius:"Content & Brand",
  ravi:"Content & Brand", yara:"Content & Brand", ingrid:"Content & Brand", nia:"Marketing",
  luca:"Marketing", hyunji:"Marketing", andre:"Marketing", amara:"Legal & Finance",
  diego:"Legal & Finance", yuki:"Legal & Finance", marcus:"Legal & Finance", khalid:"AI Governance",
  sofia:"AI Governance", james:"AI Governance", meilin:"AI Governance", rafael:"AI Governance",
  naomi:"HR", aiden:"HR", fatima:"HR", keisha:"Client Delivery", marco:"Client Delivery",
  leila:"Client Delivery", jordan:"Client Delivery", simone:"Client Delivery", theo:"Client Delivery",
  amelia:"Client Delivery", isaiah:"Customer Support", priscilla:"Customer Support",
  zoe:"Community Connection", micah:"Community Connection", dominique:"Community Connection",
  elijah:"Community Connection", solange:"Community Connection", isaiah_webb:"Community Connection",
  nadia:"Community Connection", victor:"Community Connection", sasha:"Community Connection",
  tariq:"Community Connection",
};

const AGENT_CATEGORIES: Record<string, string> = {
  raymond:"coaching", travis:"video_production", priya:"coaching", isabella:"disclaimer_review",
  omar:"lead_intelligence", ryan:"lead_intelligence", serena:"coaching", mateo:"sales_support",
  aaliyah:"outreach", jaylen:"email_marketing", chloe:"copywriting", zara:"acc_weekly_pdf_content",
  elena:"product_knowledge", kwame:"proposals", camila:"social_post", darius:"linkedin_post",
  ravi:"design_brief", yara:"localization", ingrid:"press_release", nia:"content_creation",
  luca:"digital_marketing", hyunji:"analytics_report", andre:"seo_sem", amara:"legal_briefing",
  diego:"expense_report", yuki:"financial_report", marcus:"tax_strategy", khalid:"disclaimer_review",
  sofia:"privacy_policy", james:"contract_review", meilin:"brand_monitoring", rafael:"ai_intelligence",
  naomi:"recruiting", aiden:"onboarding", fatima:"helpdesk", keisha:"client_onboarding",
  marco:"community_management", leila:"feedback_coaching", jordan:"creative_direction",
  simone:"course_architecture", theo:"presentation_design", amelia:"video_production",
  isaiah:"issue_resolution", priscilla:"multichannel_comms", zoe:"community_management",
  micah:"community_management", dominique:"community_post", elijah:"community_post", solange:"community_post",
  isaiah_webb:"community_post", nadia:"community_post", victor:"community_post", sasha:"coaching", tariq:"coaching",
};

type ContentBlockItem = { type: string; text?: string; [key: string]: unknown };

async function callAnthropic(content: string | ContentBlockItem[], maxTokens = 2000): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: maxTokens, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

// ─── Concurrency lock — prevents fan-out / repeat-fire cascades ──────────────
// Only ONE on-demand chain may be in flight system-wide at any time.
// Atomic acquire: UPDATE only succeeds if unlocked OR the existing lock is stale (>5 min old).

async function acquireLock(agentName: string): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return true; // fail open only if Supabase env vars are missing entirely

  const staleCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const res = await fetch(
    `${url}/rest/v1/on_demand_lock?id=eq.1&or=(is_locked.eq.false,locked_at.lt.${staleCutoff})`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({ is_locked: true, locked_at: new Date().toISOString(), locked_by: agentName }),
    }
  );
  if (!res.ok) return false; // fail closed on error — safer than risking a second fire
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function releaseLock(): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  await fetch(`${url}/rest/v1/on_demand_lock?id=eq.1`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ is_locked: false, locked_by: null }),
  }).catch((err) => console.error("[twin-on-demand] releaseLock failed:", err));
}

// ─── Hard daily spend cap — independent of Anthropic's own balance system ────
// Checked BEFORE any Anthropic API call. This is DeAnna's own ceiling in her own
// database, not reliant on Anthropic's billing timing at all. Default cap: $10/day
// (normal usage runs ~$3-5/day). Conservative $0.15 estimate reserved per chain fire
// to account for Isabella correction retries.

const CHAIN_COST_ESTIMATE = 0.15; // conservative per-fire estimate incl. possible retries

async function checkAndReserveSpend(): Promise<{ ok: boolean; totalSpent?: number; cap?: number }> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: true }; // fail open only if Supabase env vars are missing entirely

  const today = new Date().toISOString().slice(0, 10);

  // Ensure today's row exists
  await fetch(`${url}/rest/v1/daily_spend_cap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "resolution=ignore-duplicates",
    },
    body: JSON.stringify({ spend_date: today }),
  }).catch(() => {});

  const readRes = await fetch(`${url}/rest/v1/daily_spend_cap?spend_date=eq.${today}&select=total_spent,cap_amount`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!readRes.ok) return { ok: false }; // fail closed on error
  const rows = await readRes.json();
  const row = rows[0] ?? { total_spent: 0, cap_amount: 10.0 };

  if (Number(row.total_spent) + CHAIN_COST_ESTIMATE > Number(row.cap_amount)) {
    console.error(`[twin-on-demand] 🛑 Daily spend cap reached: $${row.total_spent}/$${row.cap_amount}`);
    return { ok: false, totalSpent: Number(row.total_spent), cap: Number(row.cap_amount) };
  }

  // Reserve the estimated cost now, before the Anthropic call fires
  await fetch(`${url}/rest/v1/daily_spend_cap?spend_date=eq.${today}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ total_spent: Number(row.total_spent) + CHAIN_COST_ESTIMATE, updated_at: new Date().toISOString() }),
  });

  return { ok: true, totalSpent: Number(row.total_spent) + CHAIN_COST_ESTIMATE, cap: Number(row.cap_amount) };
}

async function writeToCSQ(record: Record<string, unknown>): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/chief_of_staff_queue`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=representation" },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    console.error(`[twin-on-demand] CSQ write failed: ${res.status} — ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  return data?.[0]?.id ?? null;
}

// Direct-to-approvals write, matching cc-agent-trigger.ts's runSasha/runTariq exactly.
// Used only for Sasha and Tariq's on-demand bypass path — see handler below.
async function writeToApprovals(record: Record<string, unknown>): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/approvals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=representation" },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    console.error(`[twin-on-demand] Approvals write failed: ${res.status} — ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  return data?.[0]?.id ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const { agent_id, task, attachments } = req.body ?? {};
  if (!agent_id || !task) { res.status(400).json({ error: "agent_id and task are required" }); return; }
  const attachmentBlocks: ContentBlockItem[] = Array.isArray(attachments) ? attachments : [];

  const agentName = AGENT_NAMES[agent_id];
  const division  = AGENT_DIVISIONS[agent_id];
  const category  = AGENT_CATEGORIES[agent_id] ?? "on_demand";
  const systemPrompt = AGENT_SYSTEM_PROMPTS[agent_id];

  if (!agentName || !systemPrompt) { res.status(400).json({ error: `Unknown agent: ${agent_id}` }); return; }

  const cronSecret = process.env.CRON_SECRET ?? "";
  const baseUrl    = "https://app.druaiconsulting.com";

  console.log(`[twin-on-demand] Starting — agent: ${agentName} | division: ${division} | category: ${category}`);

  // ── Hard daily spend cap — the FIRST gate, before anything else spends money ──
  const spendCheck = await checkAndReserveSpend();
  if (!spendCheck.ok) {
    console.warn(`[twin-on-demand] 🛑 Rejected — daily spend cap reached ($${spendCheck.totalSpent ?? "?"}/$${spendCheck.cap ?? "?"})`);
    res.status(429).json({
      success: false,
      reason: "daily_spend_cap_reached",
      total_spent: spendCheck.totalSpent,
      cap: spendCheck.cap,
    });
    return;
  }

  // ── Sasha & Tariq bypass — matches their daily behavior exactly ───────────
  // Daily, these two are DeAnna's private revenue-intelligence agents and skip
  // the Isabella/Governance/Command Layer/Twin chain entirely, writing straight
  // to approvals (see cc-agent-trigger.ts runSasha/runTariq). On-demand now
  // mirrors that: one Anthropic call, one direct write, no chain, no lock —
  // there's no multi-step process here for a lock to protect against.
  if (agent_id === "sasha" || agent_id === "tariq") {
    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" });
    try {
      const raw = await callAnthropic(
        `${systemPrompt}\n\nTASK (on-demand request from DeAnna via AI Twin): ${task}\n\nReturn ONLY valid JSON with no preamble or markdown: {"title":"...","content":"..."}`,
        1200
      );
      const cleaned = raw.replace(/```json\s*|```/g, "").trim();
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      const parsed = firstBrace !== -1 && lastBrace !== -1 ? JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) : null;
      const title = parsed?.title ?? `${agentName} — On-Demand`;
      const content = parsed?.content ?? raw;

      const approvalId = await writeToApprovals({
        source: agent_id === "sasha" ? "sasha_sales_intel" : "tariq_revenue_intel",
        trigger_type: "sales_intelligence",
        agent_name: agentName,
        agent_role: agent_id === "sasha" ? "AI Sales Mastery™ Intelligence" : "Revenue Acceleration Intelligence",
        division,
        task_brief: `${title} | On-Demand | ${today}`,
        output: `${title}\n\n${content}`,
        status: "pending",
        notify_deanna: false,
        priority: "NORMAL",
        category: "revenue_growth",
        platform: null,
      });

      console.log(`[twin-on-demand] ✅ ${agentName} on-demand card (direct write, no chain) → approvals: ${approvalId ?? "failed"}`);
      res.status(200).json({ success: true, agent_name: agentName, preview: content, approval_id: approvalId });
    } catch (err) {
      console.error(`[twin-on-demand] ${agentName} bypass error:`, err);
      res.status(500).json({ error: String(err) });
    }
    return;
  }

  // ── Concurrency lock — reject immediately if a chain is already in flight ──
  // This must happen BEFORE the first Anthropic call, since that's where credits
  // actually get spent. A rejected request costs one cheap DB check, nothing else.
  const lockAcquired = await acquireLock(agentName);
  if (!lockAcquired) {
    console.warn(`[twin-on-demand] 🔒 Rejected — on-demand chain already in flight (requested by: ${agentName})`);
    res.status(429).json({ success: false, reason: "chain_already_in_flight", agent_name: agentName });
    return;
  }

  try {
    // Step 1 — Run agent
    const taskText = `${systemPrompt}\n\nTASK (on-demand request from DeAnna via AI Twin): ${task}`;
    const agentContent: string | ContentBlockItem[] = attachmentBlocks.length > 0
      ? [...attachmentBlocks, { type: "text", text: taskText }]
      : taskText;
    const output = await callAnthropic(agentContent, 2000);
    console.log(`[twin-on-demand] ${agentName} output generated (${output.length} chars)`);

    // Step 2 — Write to CSQ
    const csqId = await writeToCSQ({
      agent_id,
      agent_name: agentName,
      division,
      task: "on_demand_request",
      category,
      raw_output: output,
      priority: "high",
      status: "pending",
      retry_count: 0,
      raymond_notes: `On-demand request from DeAnna via AI Twin: ${task}`,
    });
    console.log(`[twin-on-demand] ${agentName} output written to CSQ: ${csqId}`);

    // Step 3 — Fire on-demand chain (fire and forget)
    // Lock ownership transfers to process-on-demand.ts, which releases it when
    // the chain finishes (success, rejection, or error). If the fetch itself
    // fails to even fire, we release here so the lock never gets stuck.
    if (csqId) {
      // Fire the on-demand chain in the background — wrapped in waitUntil so Vercel
      // keeps this function's execution context alive until the fetch actually
      // completes, even though the client response is returned immediately below.
      // Without this, Vercel can freeze/tear down the function the instant the
      // response is sent, silently killing this fetch before it ever reaches
      // process-on-demand (confirmed via Vercel logs — zero invocations logged
      // despite this line running successfully every time).
      waitUntil(
        fetch(`${baseUrl}/api/process-on-demand`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-cron-secret": cronSecret },
          body: JSON.stringify({ csq_id: csqId }),
        }).then((r) => {
          console.log(`[twin-on-demand] on-demand chain response: ${r.status}`);
        }).catch((err) => {
          console.error("[twin-on-demand] ❌ Failed to fire on-demand chain:", err);
          releaseLock();
        })
      );
      console.log(`[twin-on-demand] ✅ On-demand chain fired for CSQ: ${csqId}`);
    } else {
      // CSQ write failed — nothing downstream will ever release the lock
      await releaseLock();
    }

    res.status(200).json({
      success: true,
      agent_name: agentName,
      preview: output,
      csq_id: csqId,
    });

  } catch (err: unknown) {
    console.error("[twin-on-demand] Error:", err);
    await releaseLock();
    res.status(500).json({ error: String(err) });
  }
}
