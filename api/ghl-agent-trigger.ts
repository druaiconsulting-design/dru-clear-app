// api/ghl-agent-trigger.ts
// Vercel Edge Function — Autonomous Entry Point
// Handles GHL webhook format — auto-builds task from contact data

export const config = {
  runtime: "edge",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AGENT_VOICES: Record<string, string> = {
  "Camila Flores":   "You are Camila Flores, Social Media Strategist at DRU AI Consulting. You manage DeAnna's social presence across LinkedIn, Instagram, and Facebook. You draft responses in DeAnna's voice and create content that builds her authority as an AI Leader.",
  "Omar Patel":      "You are Omar Patel, Lead Scoring specialist at DRU AI Consulting. You analyze inbound leads, score them against DeAnna's ICP, and assign tiers: Emerging / Developing / Advancing / Leading.",
  "Ryan Nakamura":   "You are Ryan Nakamura, CRM Management specialist at DRU AI Consulting. You manage GHL operations — contacts, tags, pipelines, and automations. GHL Location ID: gl07I4JnbkGgW8zJprSz.",
  "Kwame Asante":    "You are Kwame Asante, Proposal Writer at DRU AI Consulting. You craft compelling, executive-level proposals that clearly communicate ROI.",
  "Jaylen Brooks":   "You are Jaylen Brooks, Email Marketing specialist at DRU AI Consulting. You craft high-converting email sequences in DeAnna's voice.",
  "Chloe Dubois":    "You are Chloe Dubois, Copy Writer at DRU AI Consulting. You write compelling, conversion-focused copy in DeAnna's voice.",
  "Nia Robinson":    "You are Nia Robinson, Content Creation specialist at DRU AI Consulting. You create authority-building content in DeAnna's voice.",
  "Aaliyah Foster":  "You are Aaliyah Foster, Personalized Outreach specialist at DRU AI Consulting. You craft personalized outreach messages that speak to each prospect's pain points.",
  "Serena Jackson":  "You are Serena Jackson, Business Coach at DRU AI Consulting. You provide strategic business coaching aligned with DeAnna's DRU AI Transformation Pathway™.",
  "Mateo Gonzalez":  "You are Mateo Gonzalez, Sales Support specialist at DRU AI Consulting. You support the sales process with materials and pipeline management.",
};

const AGENT_ROSTER = `
C-Suite / Operations: Priya Sharma (Executive Assistant), Isabella Moreno (Compliance), Marcus Chen (Tax Strategist)
Legal & Finance: Amara Okafor (Legal), Diego Reyes (Expense Manager), Yuki Tanaka (Financial Reporting)
Revenue & Growth + Sales: Serena Jackson (Business Coach), Mateo Gonzalez (Sales Support), Zara Ahmed (Product Launch), Jaylen Brooks (Email Marketing), Chloe Dubois (Copy Writer), Omar Patel (Lead Scoring), Aaliyah Foster (Personalized Outreach), Ryan Nakamura (CRM Management), Elena Vasquez (Product Knowledge), Kwame Asante (Proposal Writer)
Marketing: Nia Robinson (Content Creation), Luca Romano (Digital Marketing), Hyun-Ji Kim (Analytics), Andre Mitchell (SEO/SEM)
Content & Brand: Camila Flores (Social Media Strategist), Darius King (Viral Scripter), Ingrid Larsen (Press Release), Ravi Gupta (Graphic Designer)
Client Delivery: Keisha Thompson (Onboarding Coach), Marco Silva (Community Manager), Simone Laurent (Course Architect)
Customer Support: Isaiah Carter (Issue Resolution), Priscilla Okonkwo (Multi-Channel Communication)
`;

// Build task automatically from GHL contact data + trigger type
function buildTask(triggerType: string, body: any): { task: string; context: string; category: string } {
  const name    = body.full_name || body.firstName || body.first_name || body.name || "Unknown Contact";
  const email   = body.email || "";
  const phone   = body.phone || body.phone_number || "";
  const tier    = body.tier || body["Tier"] || body.contact?.tier || "";
  const score   = body.total_score || body["Total Score"] || body.contact?.total_score || "";
  const topGaps = body.top_gaps || body["Top Gaps"] || body.contact?.top_gaps || "";

  switch (triggerType) {
    case "assessment_completed":
      return {
        task: `Score this lead and recommend next steps. Contact ${name} (${email}) completed the DRU CLEAR™ AI Readiness Assessment. Tier: ${tier}. Score: ${score}. Top Gaps: ${topGaps}. Determine their readiness level, identify the best offer to present, and draft a personalized follow-up recommendation.`,
        context: `Assessment completion. Tier: ${tier}. Score: ${score}. Top Gaps: ${topGaps}.`,
        category: "other",
      };
    case "contact_created":
      return {
        task: `A new lead just entered the system. Score ${name} (${email}, ${phone}) against DeAnna's ICP and recommend the best next action.`,
        context: `New contact created in GHL.`,
        category: "other",
      };
    case "purchase_ed":
      return {
        task: `${name} just purchased the Executive Diagnostic ($4,997). Draft a personalized welcome message and onboarding next steps.`,
        context: `ED purchase completed.`,
        category: "email",
      };
    case "purchase_sd":
      return {
        task: `${name} just purchased the Standard Diagnostic ($3,497). Draft a personalized welcome message and onboarding next steps.`,
        context: `SD purchase completed.`,
        category: "email",
      };
    default:
      return {
        task: `New GHL trigger: ${triggerType}. Contact: ${name} (${email}). Analyze and recommend the best agent action.`,
        context: `GHL trigger: ${triggerType}`,
        category: "other",
      };
  }
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse body — handle both JSON and GHL's various formats
    let body: any = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      params.forEach((v, k) => { body[k] = v; });
    } else {
      // Try JSON first, fall back to text
      const text = await req.text();
      try { body = JSON.parse(text); } catch { body = { raw: text }; }
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const supabaseUrl     = process.env.VITE_SUPABASE_URL;
    const supabaseKey     = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!anthropicApiKey || !supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract fields — works whether GHL sends custom data at root or nested
    const source           = body.source || "ghl";
    const trigger_type     = body.trigger_type || "unknown";
    const platform         = body.platform || "General";
    const original_content = body.original_content || "";
    const priority_override = body.priority_override || null;
    const ghl_contact_id   = body.ghl_contact_id || body.contactId || body.id || null;

    // If task wasn't sent by GHL, build it automatically from contact data
    let task    = body.task || "";
    let context = body.context || "";
    let category = body.category || "other";

    if (!task) {
      const built = buildTask(trigger_type, body);
      task     = built.task;
      context  = built.context;
      category = built.category;
    }

    // ── Step 1: Route to correct agent ──────────────────────────────────────
    const routerRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: `You are Raymond Holloway and Travis Weston — Chief of Staff command team for DRU AI Consulting.

Pick the SINGLE best agent from this roster:
${AGENT_ROSTER}

ROUTING RULES:
- Assessment scoring, lead scoring → Omar Patel
- CRM updates, contact management → Ryan Nakamura
- Social media → Camila Flores
- Proposals → Kwame Asante
- Email sequences → Jaylen Brooks
- Copy writing → Chloe Dubois
- Onboarding → Keisha Thompson
- Outreach → Aaliyah Foster

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
          content: `TASK: ${task}\nCONTEXT: ${context}\nTRIGGER: ${trigger_type}`,
        }],
      }),
    });

    if (!routerRes.ok) {
      const err = await routerRes.text();
      return new Response(
        JSON.stringify({ error: "Router failed", detail: err }),
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

    // ── Step 2: Agent executes ───────────────────────────────────────────────
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
Products: DRU CLEAR™ AI Readiness Scorecard (free), Executive Diagnostic ($4,997 BEST VALUE), Standard Diagnostic ($3,497), From Confusion to Confident with AI™ ($497/$997/$1,497), Daily Connections (Free/Navigator $47/mo/Accelerator $147/mo)

All outputs must be immediately deployable. Write in DeAnna's voice: authoritative, clear, warm, purpose-driven.
Always include ™ on: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.`,
        messages: [{
          role:    "user",
          content: `TASK: ${taskBrief}\nCONTEXT: ${context}\nORIGINAL: ${original_content}\nGHL CONTACT ID: ${ghl_contact_id || "N/A"}`,
        }],
      }),
    });

    if (!agentRes.ok) {
      const err = await agentRes.text();
      return new Response(
        JSON.stringify({ error: "Agent execution failed", detail: err }),
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
        "Content-Type":  "application/json",
        "apikey":        supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Prefer":        "return=representation",
      },
      body: JSON.stringify(approvalRow),
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      return new Response(
        JSON.stringify({ error: "Insert failed", detail: err }),
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
