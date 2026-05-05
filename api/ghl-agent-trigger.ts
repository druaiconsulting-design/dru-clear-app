// api/ghl-agent-trigger.ts
// Vercel Edge Function — Autonomous Entry Point
// Direct trigger-to-agent mapping — no routing ambiguity

export const config = {
  runtime: "edge",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Direct trigger → agent mapping ──────────────────────────────────────────
// Known triggers always route to the correct agent — no AI routing needed
const TRIGGER_MAP: Record<string, { agent_name: string; agent_role: string; division: string; priority: string }> = {
  "assessment_completed":   { agent_name: "Omar Patel",       agent_role: "Lead Scoring",         division: "Revenue & Growth + Sales", priority: "HIGH" },
  "contact_created":        { agent_name: "Omar Patel",       agent_role: "Lead Scoring",         division: "Revenue & Growth + Sales", priority: "HIGH" },
  "lead_abandoned":         { agent_name: "Aaliyah Foster",   agent_role: "Personalized Outreach", division: "Revenue & Growth + Sales", priority: "HIGH" },
  "purchase_ed":            { agent_name: "Keisha Thompson",  agent_role: "Onboarding Coach",     division: "Client Delivery",          priority: "URGENT" },
  "purchase_sd":            { agent_name: "Keisha Thompson",  agent_role: "Onboarding Coach",     division: "Client Delivery",          priority: "URGENT" },
  "course_waitlist":        { agent_name: "Zara Ahmed",       agent_role: "Product Launch",       division: "Revenue & Growth + Sales", priority: "NORMAL" },
  "nurture_sequence":       { agent_name: "Jaylen Brooks",    agent_role: "Email Marketing",      division: "Revenue & Growth + Sales", priority: "NORMAL" },
  "social_mention":         { agent_name: "Camila Flores",    agent_role: "Social Media Strategist", division: "Content & Brand",        priority: "HIGH" },
  "dm":                     { agent_name: "Camila Flores",    agent_role: "Social Media Strategist", division: "Content & Brand",        priority: "HIGH" },
  "comment":                { agent_name: "Camila Flores",    agent_role: "Social Media Strategist", division: "Content & Brand",        priority: "NORMAL" },
  "proposal_request":       { agent_name: "Kwame Asante",     agent_role: "Proposal Writer",      division: "Revenue & Growth + Sales", priority: "URGENT" },
  "crm_update":             { agent_name: "Ryan Nakamura",    agent_role: "CRM Management (GHL)", division: "Revenue & Growth + Sales", priority: "NORMAL" },
};

// ── Agent voices ─────────────────────────────────────────────────────────────
const AGENT_VOICES: Record<string, string> = {
  "Omar Patel":       "You are Omar Patel, Lead Scoring specialist at DRU AI Consulting. You analyze inbound leads, score them against DeAnna's ICP, and assign tiers: Emerging / Developing / Advancing / Leading. You provide a clear score, tier assignment, recommended next offer, and follow-up action.",
  "Aaliyah Foster":   "You are Aaliyah Foster, Personalized Outreach specialist at DRU AI Consulting. You craft personalized re-engagement messages that speak directly to the prospect's pain points and position DeAnna's solutions.",
  "Keisha Thompson":  "You are Keisha Thompson, Onboarding Coach at DRU AI Consulting. You guide new clients through the onboarding experience with warmth, clarity, and a clear next-step plan.",
  "Zara Ahmed":       "You are Zara Ahmed, Product Launch specialist at DRU AI Consulting. You manage waitlists, launch sequences, and enrollment communications for DeAnna's programs.",
  "Jaylen Brooks":    "You are Jaylen Brooks, Email Marketing specialist at DRU AI Consulting. You craft high-converting email sequences in DeAnna's voice that move leads through the DRU AI Transformation Pathway™.",
  "Camila Flores":    "You are Camila Flores, Social Media Strategist at DRU AI Consulting. You monitor DeAnna's social presence and draft responses in her voice — authoritative, warm, and leadership-focused.",
  "Kwame Asante":     "You are Kwame Asante, Proposal Writer at DRU AI Consulting. You craft compelling, executive-level proposals that clearly communicate ROI and position DeAnna's engagements as strategic investments.",
  "Ryan Nakamura":    "You are Ryan Nakamura, CRM Management specialist at DRU AI Consulting. You manage GHL operations — contacts, tags, pipelines, and automations. GHL Location ID: gl07I4JnbkGgW8zJprSz.",
  "Chloe Dubois":     "You are Chloe Dubois, Copy Writer at DRU AI Consulting. You write compelling, conversion-focused copy in DeAnna's voice. Brand principle: AI Mastery. Leadership Clarity. Measurable Results.",
  "Nia Robinson":     "You are Nia Robinson, Content Creation specialist at DRU AI Consulting. You create authority-building content in DeAnna's voice that demonstrates AI expertise and leadership.",
};

// ── AI roster for unknown triggers ───────────────────────────────────────────
const AGENT_ROSTER = `
Revenue & Growth + Sales: Omar Patel (Lead Scoring), Aaliyah Foster (Personalized Outreach), Ryan Nakamura (CRM Management), Jaylen Brooks (Email Marketing), Chloe Dubois (Copy Writer), Kwame Asante (Proposal Writer), Zara Ahmed (Product Launch), Keisha Thompson (Onboarding Coach)
Content & Brand: Camila Flores (Social Media Strategist), Darius King (Viral Scripter), Ingrid Larsen (Press Release)
Customer Support: Isaiah Carter (Issue Resolution), Priscilla Okonkwo (Multi-Channel Communication)
`;

// ── Build task from GHL contact data ─────────────────────────────────────────
function buildTask(triggerType: string, body: any): { task: string; context: string; category: string } {
  const name    = body.full_name || body.firstName || body.first_name || body.name || "Unknown Contact";
  const email   = body.email || "";
  const phone   = body.phone || body.phone_number || "";
  const tier    = body.tier || body["Tier"] || "";
  const score   = body.total_score || body["Total Score"] || "";
  const topGaps = body.top_gaps || body["Top Gaps"] || "";

  switch (triggerType) {
    case "assessment_completed":
      return {
        task: `Score this lead and recommend next steps. Contact ${name} (${email}) completed the DRU CLEAR™ AI Readiness Assessment. Tier: ${tier}. Score: ${score}. Top Gaps: ${topGaps}. Assign their readiness tier, identify the best offer to present (Executive Diagnostic $4,997 or Standard Diagnostic $3,497), and draft a personalized follow-up recommendation for DeAnna to review.`,
        context: `Assessment completion. Tier: ${tier}. Score: ${score}. Top Gaps: ${topGaps}.`,
        category: "other",
      };
    case "contact_created":
      return {
        task: `New lead entered the system. Score ${name} (${email}, ${phone}) against DeAnna's ICP and recommend the best next action and offer.`,
        context: `New contact created in GHL.`,
        category: "other",
      };
    case "lead_abandoned":
      return {
        task: `${name} (${email}) started the DRU CLEAR™ AI Readiness Assessment but did not complete it. Draft a personalized re-engagement message to bring them back.`,
        context: `Abandoned assessment lead recovery.`,
        category: "email",
      };
    case "purchase_ed":
      return {
        task: `${name} just purchased the Executive Diagnostic ($4,997). Draft a personalized welcome message, confirm next steps, and outline what they can expect from their engagement.`,
        context: `Executive Diagnostic purchase confirmed.`,
        category: "email",
      };
    case "purchase_sd":
      return {
        task: `${name} just purchased the Standard Diagnostic ($3,497). Draft a personalized welcome message, confirm next steps, and outline what they can expect from their engagement.`,
        context: `Standard Diagnostic purchase confirmed.`,
        category: "email",
      };
    case "course_waitlist":
      return {
        task: `${name} (${email}) joined the waitlist for From Confusion to Confident with AI™. Draft a warm confirmation message and keep them engaged until launch.`,
        context: `Course waitlist signup.`,
        category: "email",
      };
    case "nurture_sequence":
      return {
        task: `${name} (${email}) is in the DRU CLEAR™ nurture sequence. Draft the next touchpoint email to move them closer to booking a diagnostic.`,
        context: `Nurture sequence touchpoint.`,
        category: "email",
      };
    default:
      return {
        task: `New GHL trigger: ${triggerType}. Contact: ${name} (${email}). Analyze and recommend the best next action.`,
        context: `GHL trigger: ${triggerType}.`,
        category: "other",
      };
  }
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse body
    let body: any = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      params.forEach((v, k) => { body[k] = v; });
    } else {
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

    // Extract fields
    const source           = body.source || "ghl";
    const trigger_type     = body.trigger_type || "unknown";
    const platform         = body.platform || "General";
    const original_content = body.original_content || "";
    const priority_override = body.priority_override || null;
    const ghl_contact_id   = body.ghl_contact_id || body.contactId || body.id || null;
    const category         = body.category || "other";

    // Build task from contact data
    let task    = body.task || "";
    let context = body.context || "";
    let taskCategory = category;

    if (!task) {
      const built  = buildTask(trigger_type, body);
      task         = built.task;
      context      = built.context;
      taskCategory = built.category;
    }

    // ── Route: use direct map first, AI routing for unknowns ─────────────────
    let agentName: string;
    let agentRole: string;
    let division:  string;
    let priority:  string;
    let notifyDeanna = true;

    const directRoute = TRIGGER_MAP[trigger_type];

    if (directRoute) {
      // Known trigger — route directly, no AI needed
      agentName    = directRoute.agent_name;
      agentRole    = directRoute.agent_role;
      division     = directRoute.division;
      priority     = priority_override || directRoute.priority;
    } else {
      // Unknown trigger — use AI routing
      const routerRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model:      "claude-haiku-4-5-20251001",
          max_tokens: 250,
          system: `You are Raymond Holloway and Travis Weston — Chief of Staff at DRU AI Consulting.
Pick the SINGLE best agent:
${AGENT_ROSTER}
Respond ONLY with valid JSON:
{"agent_name":"...","agent_role":"...","division":"...","task_brief":"...","priority":"NORMAL","notify_deanna":true}`,
          messages: [{ role: "user", content: `TASK: ${task}\nTRIGGER: ${trigger_type}` }],
        }),
      });

      const routerData  = await routerRes.json();
      const routerRaw   = routerData.content?.[0]?.text || "";
      const routerClean = routerRaw.replace(/```json|```/g, "").trim();
      let   routing: any = {};

      try { routing = JSON.parse(routerClean); } catch {
        routing = { agent_name: "Omar Patel", agent_role: "Lead Scoring", division: "Revenue & Growth + Sales", priority: "NORMAL", notify_deanna: true };
      }

      agentName    = routing.agent_name;
      agentRole    = routing.agent_role;
      division     = routing.division;
      priority     = priority_override || routing.priority || "NORMAL";
      notifyDeanna = routing.notify_deanna ?? true;
      task         = routing.task_brief || task;
    }

    // ── Agent executes ────────────────────────────────────────────────────────
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

You operate within DRU AI Consulting, founded by DeAnna R. Upshaw — CEO, AI Authority.
Brand principle: AI Mastery. Leadership Clarity. Measurable Results.
Framework: DRU CLEAR™ (Clarity, Leadership, Execution, Alignment, Results)
Transformation Pathway: Discover → Diagnose → Design → Deploy → Dominate
Products: DRU CLEAR™ AI Readiness Scorecard (free), Executive Diagnostic ($4,997 BEST VALUE), Standard Diagnostic ($3,497), From Confusion to Confident with AI™ ($497/$997/$1,497), Daily Connections (Free / Navigator $47/mo / Accelerator $147/mo)

Outputs must be immediately deployable. Write in DeAnna's voice: authoritative, clear, warm, purpose-driven.
Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.`,
        messages: [{
          role:    "user",
          content: `TASK: ${task}\nCONTEXT: ${context}\nORIGINAL: ${original_content}\nGHL CONTACT ID: ${ghl_contact_id || "N/A"}`,
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

    // ── Write to Supabase approvals table ─────────────────────────────────────
    const approvalRow = {
      source,
      trigger_type,
      agent_name:       agentName,
      agent_role:       agentRole,
      division,
      task_brief:       task,
      original_content: original_content || null,
      output:           agentOutput,
      status:           "pending",
      ghl_contact_id:   ghl_contact_id || null,
      notify_deanna:    notifyDeanna,
      priority,
      category:         taskCategory,
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
        success:       true,
        agent:         agentName,
        role:          agentRole,
        division,
        priority,
        notify_deanna: notifyDeanna,
        approval_id:   insertedRow?.id || null,
        timestamp:     new Date().toISOString(),
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
