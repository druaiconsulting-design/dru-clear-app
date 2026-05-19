// api/twin.ts
// Vercel edge function — streaming Twin chat with on-demand agent routing
// DeAnna can say "have [agent] do X" and the Twin detects, previews, and routes through full chain

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
raymond→Raymond Holloway (EVP) | travis→Travis Weston (AVP) | priya→Priya Sharma (EA) | isabella→Isabella Moreno (Compliance)
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

const CLASSIFY_PROMPT = `You are a command classifier for DeAnna R. Upshaw's AI Twin. Determine if the message is a routing command to one of the 54 agents.

AGENT ROSTER (name/nickname → agent_id):
Raymond Holloway → raymond | Travis Weston → travis | Priya Sharma → priya | Isabella Moreno → isabella
Omar Patel → omar | Ryan Nakamura → ryan | Serena Jackson → serena | Mateo Gonzalez → mateo
Aaliyah Foster → aaliyah | Jaylen Brooks → jaylen | Chloe Dubois → chloe | Zara Ahmed / Zia / Z → zara
Elena Vasquez → elena | Kwame Asante → kwame | Camila Flores → camila | Darius King → darius
Ravi Gupta → ravi | Yara Mansour → yara | Ingrid Larsen → ingrid | Nia Robinson → nia
Luca Romano → luca | Hyun-Ji Kim → hyunji | Andre Mitchell → andre | Amara Okafor → amara
Diego Reyes → diego | Yuki Tanaka → yuki | Marcus Chen → marcus | Khalid Hassan → khalid
Sofia Petrov → sofia | James Osei → james | Mei Lin → meilin | Rafael Torres → rafael
Naomi Williams → naomi | Aiden Park → aiden | Fatima Al-Rashid → fatima | Keisha Thompson → keisha
Marco Silva → marco | Leila Nasser → leila | Jordan Hayes → jordan | Simone Laurent → simone
Theo Nguyen → theo | Amelia Santos → amelia | Isaiah Carter → isaiah | Priscilla Okonkwo → priscilla
Zoe Beaumont → zoe | Micah Santos → micah | Dominique Carter → dominique | Elijah Brooks → elijah
Solange Dupont → solange | Isaiah Webb → isaiah_webb | Nadia Osei → nadia | Victor Reyes → victor
Sasha Kim → sasha | Tariq Oladele → tariq

MESSAGE: "{MESSAGE}"

If this is a routing command, return ONLY valid JSON:
{"is_command":true,"agent_id":"exact_id_from_roster","agent_name":"Full Name","task":"clear description of what the agent should do"}

If NOT a routing command, return ONLY:
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

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { messages, systemPrompt } = await req.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });

    const lastUserMessage: string = [...messages].reverse().find((m: { role: string; content: string }) => m.role === "user")?.content ?? "";
    const detection = await detectCommand(lastUserMessage, apiKey);

    if (detection?.is_command) {
      const { agent_id, agent_name, task } = detection;

      const baseUrl = "https://app.druaiconsulting.com";
      fetch(`${baseUrl}/api/twin-command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id, task }),
      }).catch((err) => console.error("[twin] twin-command fire-and-forget error:", err));

      const commandSystemPrompt = `${systemPrompt || DEFAULT_SYSTEM}

COMMAND ROUTING ACTIVE: DeAnna issued a command. You routed it to ${agent_name} — it is already executing through the full governance chain (Agent → Isabella → Governance → Raymond/Travis/Priya → AdminApprovals + GHL notification).
CRITICAL RULES — strictly enforced: Never ask for confirmation. Never give timelines or delivery estimates. Never say "I will" or "I can" — it is already DONE and executing. Respond in 2-3 sentences max. Be direct, commanding, and decisive. You are her command interface, not a service provider.`;

      const routingMessages = [
        ...messages.slice(0, -1),
        { role: "user", content: `Command executed: "${task}" has been routed to ${agent_name} and is already running. Confirm this to DeAnna in your commanding Twin voice — what was routed, who is handling it, and that results will appear in AdminApprovals. 2-3 sentences. No timelines. No confirmation requests. Done is done.` },
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
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1024, stream: true, system: systemPrompt || DEFAULT_SYSTEM, messages }),
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
