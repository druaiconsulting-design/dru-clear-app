// supabase/functions/ghl-agent-trigger/index.ts
// Autonomous Entry Point — single Anthropic call handles routing + execution
// Eliminates WallClockTime by collapsing the chain into one AI call

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AGENT_ROSTER = `
C-Suite / Operations: Priya Sharma (Executive Assistant), Isabella Moreno (Director of Compliance), Marcus Chen (Tax Strategist)
Legal & Finance: Amara Okafor (Legal Team), Diego Reyes (Expense Manager), Yuki Tanaka (Financial Reporting)
AI Governance: Khalid Hassan (Disclaimer Writer), Sofia Petrov (Privacy Policy), James Osei (Contract Writer), Mei Lin (Brand Protection), Rafael Torres (Continuous Learning)
HR Division: Naomi Williams (Recruiting), Aiden Park (Internal Onboarding), Fatima Al-Rashid (Internal Helpdesk)
Revenue & Growth + Sales: Serena Jackson (Business Coach), Mateo Gonzalez (Sales Support), Zara Ahmed (Product Launch), Jaylen Brooks (Email Marketing), Chloe Dubois (Copy Writer), Omar Patel (Lead Scoring), Aaliyah Foster (Personalized Outreach), Ryan Nakamura (CRM Management GHL), Elena Vasquez (Product Knowledge), Kwame Asante (Proposal Writer)
Marketing: Nia Robinson (Content Creation), Luca Romano (Digital Marketing), Hyun-Ji Kim (Analytics & ROI), Andre Mitchell (SEO/SEM)
Content & Brand: Camila Flores (Social Media Strategist), Darius King (Viral Scripter), Ingrid Larsen (Press Release), Ravi Gupta (Graphic Designer), Yara Mansour (Translator/Localization)
Client Delivery: Keisha Thompson (Onboarding Coach), Marco Silva (Community Manager), Leila Nasser (Feedback Coach), Jordan Hayes (Creative Director), Simone Laurent (Course Architect), Theo Nguyen (Presentation Designer), Amelia Santos (Training Video Producer)
Customer Support: Isaiah Carter (Issue Resolution), Priscilla Okonkwo (Multi-Channel Communication)
`;

const AGENT_VOICES: Record<string, string> = {
  "Camila Flores": "You are Camila Flores, Social Media Strategist at DRU AI Consulting. You manage DeAnna's social presence across LinkedIn, Instagram, and Facebook. You monitor mentions and DMs, draft responses in DeAnna's voice, and create content that builds her authority as an AI Leader.",
  "Omar Patel": "You are Omar Patel, Lead Scoring specialist at DRU AI Consulting. You analyze inbound leads, score them against DeAnna's ICP, and assign tiers: Emerging / Developing / Advancing / Leading.",
  "Ryan Nakamura": "You are Ryan Nakamura, CRM Management specialist at DRU AI Consulting. You manage GHL operations — contacts, tags, pipelines, and automations. GHL Location ID: gl07I4JnbkGgW8zJprSz.",
  "Kwame Asante": "You are Kwame Asante, Proposal Writer at DRU AI Consulting. You craft compelling, executive-level proposals that clearly communicate ROI.",
  "Jaylen Brooks": "You are Jaylen Brooks, Email Marketing specialist at DRU AI Consulting. You craft high-converting email sequences in DeAnna's voice.",
  "Chloe Dubois": "You are Chloe Dubois, Copy Writer at DRU AI Consulting. You write compelling, conversion-focused copy in DeAnna's voice.",
  "Nia Robinson": "You are Nia Robinson, Content Creation specialist at DRU AI Consulting. You create authority-building content in DeAnna's voice.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const {
      source            = "unknown",
      trigger_type      = "unknown",
      task,
      context           = "",
      original_content  = "",
      platform          = "General",
      category          = "other",
      ghl_contact_id    = null,
      priority_override = null,
    } = body;

    if (!task) {
      return new Response(
        JSON.stringify({ error: "task is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const supabaseUrl     = Deno.env.get("SUPABASE_URL");
    const supabaseKey     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!anthropicApiKey || !supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({
          error: "Missing environment variables",
          has_anthropic:    !!anthropicApiKey,
          has_supabase_url: !!supabaseUrl,
          has_supabase_key: !!supabaseKey,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Single Anthropic call: route + identify agent ────────────────────────
    const routerSystemPrompt = `You are Raymond Holloway and Travis Weston — Chief of Staff command team for DRU AI Consulting, operating under DeAnna R. Upshaw's AI Twin.

Your job: analyze the incoming task and identify the SINGLE best agent to handle it.

AGENT ROSTER:
${AGENT_ROSTER}

ROUTING RULES:
- Social media posts, DMs, comments → Camila Flores (Social Media Strategist)
- Lead scoring, new contacts → Omar Patel (Lead Scoring)
- CRM updates, GHL tasks → Ryan Nakamura (CRM Management)
- Proposals → Kwame Asante (Proposal Writer)
- Email sequences → Jaylen Brooks (Email Marketing)
- Copy, content writing → Chloe Dubois (Copy Writer)
- General content → Nia Robinson (Content Creation)

Respond ONLY with valid JSON — no markdown, no explanation:
{
  "agent_name": "...",
  "agent_role": "...",
  "division": "...",
  "task_brief": "...",
  "priority": "URGENT" | "HIGH" | "NORMAL",
  "notify_deanna": true | false
}`;

    const routerRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: routerSystemPrompt,
        messages: [{
          role: "user",
          content: `TASK: ${task}\nCONTEXT: ${context}\nORIGINAL CONTENT: ${original_content}\nPRIORITY OVERRIDE: ${priority_override || "none"}`,
        }],
      }),
    });

    if (!routerRes.ok) {
      const errText = await routerRes.text();
      return new Response(
        JSON.stringify({ error: "Router Anthropic call failed", detail: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const routerData    = await routerRes.json();
    const routerRaw     = routerData.content?.[0]?.text || "";
    const routerClean   = routerRaw.replace(/```json|```/g, "").trim();
    let   routing: any  = {};

    try {
      routing = JSON.parse(routerClean);
    } catch {
      return new Response(
        JSON.stringify({ error: "Router response parse failed", raw: routerRaw }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agentName = routing.agent_name;
    const agentRole = routing.agent_role;
    const division  = routing.division;
    const taskBrief = routing.task_brief || task;
    const priority  = priority_override || routing.priority || "NORMAL";

    // ── Second Anthropic call: agent executes the task ───────────────────────
    const agentVoice = AGENT_VOICES[agentName] ||
      `You are ${agentName}, ${agentRole} in the ${division} division at DRU AI Consulting.`;

    const agentSystemPrompt = `${agentVoice}

You operate within DRU AI Consulting, founded by DeAnna R. Upshaw — CEO, AI Authority, with 25+ years in IT and 10+ years in leadership development.
Brand principle: AI Mastery. Leadership Clarity. Measurable Results.
Framework: DRU CLEAR™ (Clarity, Leadership, Execution, Alignment, Results)
Pathway: Discover → Diagnose → Design → Deploy → Dominate

All outputs must be immediately deployable — no editing required. Write in DeAnna's voice: authoritative, clear, purpose-driven.
Always include ™ on proprietary frameworks: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.`;

    const agentRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system: agentSystemPrompt,
        messages: [{
          role: "user",
          content: `TASK: ${taskBrief}\nCONTEXT: ${context}\nORIGINAL CONTENT: ${original_content}\nGHL CONTACT ID: ${ghl_contact_id || "N/A"}`,
        }],
      }),
    });

    if (!agentRes.ok) {
      const errText = await agentRes.text();
      return new Response(
        JSON.stringify({ error: "Agent Anthropic call failed", detail: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agentData   = await agentRes.json();
    const agentOutput = agentData.content?.[0]?.text || "";

    // ── Insert to approvals table via REST API ───────────────────────────────
    const approvalRow = {
      source,
      trigger_type,
      agent_name:       agentName,
      agent_role:       agentRole,
      division,
      task_brief:       taskBrief,
      original_content: original_content || null,
      output:           agentOutput,
      status:           "pending",
      ghl_contact_id:   ghl_contact_id || null,
      notify_deanna:    routing.notify_deanna ?? true,
      priority,
      category,
      platform,
      context:          context || null,
    };

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/approvals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey":        supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Prefer":        "return=representation",
      },
      body: JSON.stringify(approvalRow),
    });

    if (!insertRes.ok) {
      const insertErr = await insertRes.text();
      return new Response(
        JSON.stringify({ error: "Approvals insert failed", detail: insertErr }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const insertedRows = await insertRes.json();
    const insertedRow  = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;

    return new Response(
      JSON.stringify({
        success:             true,
        agent:               agentName,
        role:                agentRole,
        division,
        priority,
        notify_deanna:       routing.notify_deanna,
        approval_id:         insertedRow?.id || null,
        timestamp:           new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
