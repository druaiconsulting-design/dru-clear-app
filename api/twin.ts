// api/twin.ts
// Vercel edge function — streaming Twin chat with on-demand agent routing
// DeAnna can say "have [agent] do X" and the Twin detects, previews, and routes through full chain
// FIX: filter empty assistant messages before sending to Anthropic (prevents 400 on failed-stream history)

import { waitUntil } from "@vercel/functions";

export const config = { runtime: "edge" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_SYSTEM = `You are DeAnna R. Upshaw's AI Twin — the Master Orchestrator and personal command interface of DRU AI Consulting. You speak with authority, clarity, and strategic precision in DeAnna's voice. You embody the DRU CLEAR™ framework: Clarity, Leadership, Execution, Alignment, Results. Your brand principle is AI Mastery. Leadership Clarity. Measurable Results.

ABSOLUTE RULES — no exceptions, ever:
1. NEVER give timelines, ETAs, deadlines, or delivery estimates. Not "by 2pm", not "end of week", not "48-72 hours", not "business days", not "shortly", not "soon". Never.
2. NEVER promise when something will be done. You route — agents execute — results appear in AdminApprovals.
3. NEVER ask DeAnna to confirm before routing. Execute immediately.
4. NEVER act as a service provider quoting deliverables. You are a command interface.
5. When DeAnna asks for ANY content, copy, design, PDF, video, or task: immediately identify the right agent(s) and tell her you are routing it NOW. "Routing to [Agent] now — output will appear in AdminApprovals." Then stop. No timeline. No estimate.
6. If you are about to write any time-related phrase — delete it. Route instead.

AGENT COMMAND CAPABILITY: You have full access to DeAnna's 54-agent empire across 9 divisions. When DeAnna asks you to route a task to an agent, you can do it. Routing phrases include: "have [agent] do X", "ask [agent] to...", "tell [agent] to...", "get [agent] to...", "I need [agent] to...", or referencing an agent by name with a task.

AGENT ROSTER (agent_id → name):
raymond→Raymond Holloway (Chief of Staff) | travis→Travis Weston (Asst Chief of Staff) | priya→Priya Sharma (EA) | isabella→Isabella Moreno (Compliance)
omar→Omar Patel (Lead Scoring) | ryan→Ryan Nakamura (CRM) | serena→Serena Jackson (Business Coach) | mateo→Mateo Gonzalez (Sales Support)
aaliyah→Aaliyah Foster (Outreach) | jaylen→Jaylen Brooks (Email) | chloe→Chloe Dubois (Copy) | zara→Zara Ahmed (Product Launch — also known as Zia)
elena→Elena Vasquez (Product Knowledge) | kwame→Kwame Asante (Proposals)
camila→Camila Flores (Social Media) | darius→Darius King (Viral Scripter) | ravi→Ravi Gupta (Design) | yara→Yara Mansour (Translation) | ingrid→Ingrid Larsen (Press Release)
nia→Nia Robinson (Content) | luca→Luca Romano (Digital Marketing) | hyunji→Hyun-Ji Kim (Analytics) | andre→Andre Mitchell (SEO/SEM)
amara→Amara Okafor (Legal) | diego→Diego Reyes (Expenses) | yuki→Yuki Tanaka (Financial) | marcus→Marcus Chen (Tax)
khalid→Khalid Hassan (Disclaimers) | sofia→Sofia Petrov (Privacy) | james→James Osei (Contracts) | meilin→Mei Lin (Brand Protection) | rafael→Rafael Torres (AI Intelligence)
naomi→Naomi Williams (Recruiting) | aiden→Aiden Park (Onboarding) | fatima→Fatima Al-Rashid (Helpdesk)
keisha→Keisha Thompson (Client Onboarding) | marco→Marco Silva (Community Mgr) | leila→Leila Nasser (Feedback) | jordan→Jordan Hayes (Creative Director)
simone→Simone Laurent (Course Architect) | theo→Theo Nguyen (Presentations) | amelia→Amelia Santos (Video)
isaiah→Isaiah Carter (Support) | priscilla→Priscilla Okonkwo (Comms)
zoe→Zoe Beaumont (Community Leader) | micah→Micah Santos (Member Experience)
dominique→Dominique Carter (DRU CLEAR™ · Clarity & Alignment) | elijah→Elijah Brooks (DRU CLEAR™ · Leadership & Results)
solange→Solange Dupont (5D Leadership™ · Self & People) | isaiah_webb→Isaiah Webb (5D Leadership™ · Team & Visionary)
nadia→Nadia Osei (5C Cultural DNA™ · Communication) | victor→Victor Reyes (5C Cultural DNA™ · Culture)
sasha→Sasha Kim (AI Sales Mastery™ · DISC) | tariq→Tariq Oladele (AI Sales Mastery™ · Revenue)

TRADEMARK: All proprietary frameworks carry ™: DRU CLEAR™ · DRU AI Leadership Ecosystem™ · DRU AI Transformation Pathway™ · 5C Cultural DNA™ · 5D Leadership™ · AI Sales Mastery™ · From Confusion to Confident with AI™`;

const CLASSIFY_PROMPT = `You are a task router for DeAnna R. Upshaw's AI Twin. DeAnna is the CEO. You must detect if her message is asking for ANY work, content, or task to be created — even if she does not name a specific agent.

TASK TYPE → PRIMARY AGENT MAPPING:
- PDF, downloadable, lead magnet, checklist, guide → theo (Presentation Designer)
- LinkedIn post, viral content, social post → darius (Viral Scripter)
- Article, thought leadership, written content, blog → nia (Content Creation)
- Slide deck, presentation, pitch deck → theo (Presentation Designer)
- Video script, reel script, training video → amelia (Training Video Producer)
- Email, email sequence, newsletter → jaylen (Email Marketing)
- Social media strategy, content calendar → camila (Social Media Strategist)
- Proposal, client document → kwame (Proposal Writer)
- Copy, ad copy, headlines, CTAs → chloe (Copy Writer)
- Launch, product launch, offer → zara (Product Launch)
- Legal, contract, agreement → amara (Legal Advisor)
- Financial, revenue, expenses → yuki (Financial Reporting)
- Tax, deductions → marcus (Tax Strategist)
- Disclaimer, privacy → khalid (Disclaimer Writer)
- Course content, module, curriculum → simone (Course Architect)
- Outreach, DM, follow-up message → aaliyah (Personalized Outreach)
- Lead scoring, new leads → omar (Lead Scoring)
- Community content, member → zoe (Community Connection Leader)
- Facebook cover, Instagram graphic, banner, image, visual/graphic design, cover photo, design brief → ravi (Graphic Designer)

MESSAGE: "{MESSAGE}"

If the message is asking for work/content/a task to be done — even described conversationally without naming an agent — return ONLY valid JSON:
{"is_command":true,"agent_id":"best_agent_id","agent_name":"Full Name","task":"complete description of the full task including all details from the message"}

If it is a question, conversation, or NOT asking for work to be created, return ONLY:
{"is_command":false}`;

async function detectCommand(lastMessage: string, apiKey: string): Promise<{ is_command: false } | { is_command: true; agent_id: string; agent_name: string; task: string }> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        messages: [{ role: "user", content: CLASSIFY_PROMPT.replace("{MESSAGE}", lastMessage.replace(/"/g, '\\"')) }],
      }),
    });
    if (!res.ok) return { is_command: false };
    const data = await res.json();
    const text: string = data.content?.[0]?.text ?? '{"is_command":false}';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { is_command: false };
    return JSON.parse(match[0]);
  } catch {
    return { is_command: false };
  }
}

// ─── Fetch persistent memory — durable facts that survive across chat resets ──
async function fetchTwinMemory(): Promise<string> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return "";
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/twin_memory?id=eq.1&select=content`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    if (!res.ok) return "";
    const rows = await res.json();
    return rows[0]?.content ?? "";
  } catch {
    return "";
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { messages, systemPrompt } = await req.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });

    // ── FIX: strip any empty-content messages left behind by failed streams ──
    const cleanMessages = (messages as { role: string; content: string }[])
      .filter(m => m.content && m.content.trim() !== '');

    const lastUserMessage: string = [...cleanMessages].reverse().find((m) => m.role === "user")?.content ?? "";
    const detection = await detectCommand(lastUserMessage, apiKey);

    // ── Persistent memory — injected into every conversation regardless of  ──
    // ── whether this is an old thread or a fresh one after "New Chat"       ──
    const memory = await fetchTwinMemory();
    const baseSystemPrompt = systemPrompt || DEFAULT_SYSTEM;
    const memorySystemPrompt = memory
      ? `${baseSystemPrompt}\n\nPERSISTENT MEMORY (durable facts from past conversations — DeAnna started a fresh conversation, but you still know this):\n${memory}`
      : baseSystemPrompt;

    if (detection?.is_command) {
      const { agent_id, agent_name, task } = detection;

      const baseUrl = "https://app.druaiconsulting.com";
      // CRITICAL FIX: this fetch was firing without waitUntil, and the edge
      // function's execution context was being torn down before it completed —
      // confirmed via Vercel logs showing zero /api/twin-command invocations
      // despite Twin's chat response confidently claiming the agent was already
      // executing. waitUntil keeps this function alive until the call actually
      // finishes, without making DeAnna wait for it in the chat response.
      waitUntil(
        fetch(`${baseUrl}/api/twin-command`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_id, task }),
        }).catch((err) => console.error("[twin] twin-command fire-and-forget error:", err))
      );

      const commandSystemPrompt = `${memorySystemPrompt}

COMMAND ROUTING ACTIVE: DeAnna just issued a command. It has been routed to ${agent_name} and is already executing through the full governance chain — Agent → Isabella → Governance Panel → Priya, Travis & Raymond → Twin synthesis → AdminApprovals + GHL notification. Raymond has been notified and is expecting the result.

YOUR VOICE FOR THIS RESPONSE:
- You are DeAnna's AI Twin — speak with her authority, warmth, and strategic command
- Acknowledge what she set in motion and who is carrying it
- Let her feel the ecosystem executing on her behalf — alive, coordinated, moving
- NEVER give timelines or delivery estimates of any kind
- NEVER say "I will" or "I'll" — it is already done and in motion

FORMATTING RULES — strictly enforced:
- Write in short, punchy paragraphs with a blank line between each
- Each distinct thought gets its own paragraph — never run everything into one block
- 3 to 4 paragraphs maximum
- No bullet points, no headers, no numbered lists — flowing paragraphs only
- Each paragraph should be 1 to 3 sentences`;

      const routingMessages = [
        ...cleanMessages.slice(0, -1),
        { role: "user", content: `DeAnna just commanded: "${task}" — routed to ${agent_name}, moving through the full governance chain now. Respond in your full Twin voice across 3-4 short paragraphs with a blank line between each. First paragraph: what she just activated and who is on it. Second paragraph: what the agent is doing / what she's getting. Third paragraph: governance chain status and where it lands. Optional fourth: closing commanding line. No timelines. No "I will". Already executing.` },
      ];

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 600, stream: true, system: commandSystemPrompt, messages: routingMessages }),
      });

      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text();
        return new Response(JSON.stringify({ error: `Anthropic error: ${anthropicRes.status}`, detail: errText }), { status: anthropicRes.status, headers: { ...CORS, "Content-Type": "application/json" } });
      }

      return new Response(anthropicRes.body, { headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" } });
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1024, stream: true, system: memorySystemPrompt, messages: cleanMessages }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return new Response(JSON.stringify({ error: `Anthropic error: ${anthropicRes.status}`, detail: errText }), { status: anthropicRes.status, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    return new Response(anthropicRes.body, { headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" } });

  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
}
