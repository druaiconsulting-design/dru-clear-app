// api/ghl-agent-trigger.ts
// Vercel Edge Function — Autonomous Entry Point
// Receives GHL webhooks + Make.com triggers
// Routes to correct agent, executes, writes to Supabase approvals table
// On Vercel edge — no WallClockTime limit

export const config = {
  runtime: "edge",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  "Camila Flores":   "You are Camila Flores, Social Media Strategist at DRU AI Consulting. You manage DeAnna's social presence across LinkedIn, Instagram, and Facebook. You draft responses in DeAnna's voice and create content that builds her authority as an AI Leader.",
  "Omar Patel":      "You are Omar Patel, Lead Scoring specialist at DRU AI Consulting. You analyze inbound leads, score them against DeAnna's ICP, and assign tiers: Emerging / Developing / Advancing / Leading.",
  "Ryan Nakamura":   "You are Ryan Nakamura, CRM Management specialist at DRU AI Consulting. You manage GHL operations — contacts, tags, pipelines, and automations. GHL Location ID: gl07I4JnbkGgW8zJprSz.",
  "Kwame Asante":    "You are Kwame Asante, Proposal Writer at DRU AI Consulting. You craft compelling, executive-level proposals that clearly communicate ROI and position DeAnna's engagements as strategic investments.",
  "Jaylen Brooks":   "You are Jaylen Brooks, Email Marketing specialist at DRU AI Consulting. You craft high-converting email sequences in DeAnna's voice that move leads through the DRU AI Transformation Pathway™.",
  "Chloe Dubois":    "You are Chloe Dubois, Copy Writer at DRU AI Consulting. You write compelling, conversion-focused copy in DeAnna's voice. Brand principle: AI Mastery. Leadership Clarity. Measurable Results.",
  "Nia Robinson":    "You are Nia Robinson, Content Creation specialist at DRU AI Consulting. You create authority-building content in DeAnna's voice that demonstrates AI expertise and leadership.",
  "Aaliyah Foster":  "You are Aaliyah Foster, Personalized Outreach specialist at DRU AI Consulting. You craft personalized outreach messages that speak to each prospect's pain points and position DeAnna's solutions.",
  "Serena Jackson":  "You are Serena Jackson, Business Coach at DRU AI Consulting. You provide strategic business coaching aligned with DeAnna's DRU AI Transformation Pathway™: Discover → Diagnose → Design → Deploy → Dominate.",
  "Mateo Gonzalez":  "You are Mateo Gonzalez, Sales Support specialist at DRU AI Consulting. You support the sales process with materials, follow-up sequences, and pipeline management.",
};

export default async function handler(req: Request) {
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

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const supabaseUrl     = process.env.VITE_SUPABASE_URL;
    const supabaseKey     = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!anthropicApiKey || !supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({
          error:            "Missing environment variables",
          has_anthropic:    !!anthropicApiKey,
          has_supabase_url: !!supabaseUrl,
          has_supabase_key: !!supabaseKey,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 1: Route — identify the right agent ─────────────────────────────
    const routerRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":    "application/json",
        "x-api-key":       anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: `You are Raymond Holloway and Travis Weston — Chief of Staff command team for DRU AI Consulting under DeAnna R. Upshaw's AI Twin.

Analyze the task and pick the SINGLE best agent from this roster:
${AGENT_ROSTER}

ROUTING RULES:
- Social media posts, DMs, comments, mentions → Camila Flores
- New leads, lead scoring → Omar Patel
- CRM, GHL, contact updates → Ryan Nakamura
- Proposals → Kwame Asante
- Email sequences → Jaylen Brooks
- Copy, ad copy, web copy → Chloe Dubois
- General content, articles → Nia Robinson
- Outreach messages → Aaliyah Foster
- Sales support, pipeline → Mateo Gonzalez

Respond ONLY with valid JSON, no markdown:
{
  "agent_name": "...",
  "agent_role": "...",
  "division": "...",
  "task_brief": "...",
  "priority": "URGENT" | "HIGH" | "NORMAL",
  "notify_deanna": true | false
}`,
        messages: [{
          role:    "user",
          content: `TASK: ${task}\nCONTEXT: ${context}\nORIGINAL CONTENT: ${original_content}\nPRIORITY OVERRIDE: ${priority_override || "none"}`,
        }],
      }),
    });

    if (!routerRes.ok) {
      const errText = await routerRes.text();
      return new Response(
        JSON.stringify({ error: "Router call failed", detail: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const routerData  = await routerRes.json();
    const routerRaw   = routerData.content?.[0]?.text || "";
    const routerClean = routerRaw.replace(/```json|```/g, "").trim();
    let   routing: any = {};

    try {
      routing = JSON.parse(routerClean);
    } catch {
      return new Response(
        JSON.stringify({ error: "Router parse failed", raw: routerRaw }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agentName = routing.agent_name;
    const agentRole = routing.agent_role;
    const division  = routing.division;
    const taskBrief = routing.task_brief || task;
    const priority  = priority_override || routing.priority || "NORMAL";

    // ── Step 2: Execute — agent does the work ────────────────────────────────
    const agentVoice = AGENT_VOICES[agentName] ||
      `You are ${agentName}, ${agentRole} in the ${division} division at DRU AI Consulting.`;

    const agentRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system: `${agentVoice}

You operate within DRU AI Consulting, founded by DeAnna R. Upshaw — CEO, AI Authority, 25+ years IT, 10+ years leadership development.
Brand principle: AI Mastery. Leadership Clarity. Measurable Results.
Framework: DRU CLEAR™ (Clarity, Leadership, Execution, Alignment, Results)
Transformation Pathway: Discover → Diagnose → Design → Deploy → Dominate

All outputs must be immediately deployable — no editing required.
Write in DeAnna's voice: authoritative, clear, warm, purpose-driven.
Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.`,
        messages: [{
          role:    "user",
          content: `TASK: ${taskBrief}\nCONTEXT: ${context}\nORIGINAL CONTENT: ${original_content}\nGHL CONTACT ID: ${ghl_contact_id || "N/A"}`,
        }],
      }),
    });

    if (!agentRes.ok) {
      const errText = await agentRes.text();
      return new Response(
        JSON.stringify({ error: "Agent execution failed", detail: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agentData   = await agentRes.json();
    const agentOutput = agentData.content?.[0]?.text || "";

    // ── Step 3: Write to Supabase approvals table ────────────────────────────
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
      ghl_contact_id:   ghl_contact_id  || null,
      notify_deanna:    routing.notify_deanna ?? true,
      priority,
      category,
      platform,
      context:          context || null,
    };

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/approvals`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
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
        success:      true,
        agent:        agentName,
        role:         agentRole,
        division,
        priority,
        notify_deanna: routing.notify_deanna,
        approval_id:  insertedRow?.id || null,
        timestamp:    new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
