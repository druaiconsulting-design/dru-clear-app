// api/twin.ts
// Vercel edge function — streaming Twin chat with on-demand agent routing
// DeAnna can say "have [agent] do X" and the Twin detects, previews, and routes through full chain
// FIX: filter empty assistant messages before sending to Anthropic (prevents 400 on failed-stream history)
// FIX (July 29 2026): messages with attachments (PDF/image/doc) arrive with `content` as an ARRAY of
//   content blocks, not a plain string — the old code called .trim() directly on content and crashed
//   with a 500 on every attachment message, before any Anthropic call was ever made. getMessageText()
//   and hasContent() below handle both shapes safely.
// FIX (Aug 22 2026) — Layer 1: removed the hardcoded "COMMAND ROUTING ACTIVE... already
//   executing" script. Twin now (1) asks DeAnna one real clarifying question herself when a
//   request is too vague to route without guessing, and (2) once an agent is routed,
//   actually reads the agent's real output (twin-on-demand already returned it as `preview`,
//   this file just never looked at it before) and responds honestly — relaying a genuine
//   clarifying question from the agent instead of hiding it, or acknowledging a real draft
//   without claiming it's already cleared through compliance when it hasn't been yet.

import { VOICE_DNA } from './_lib/agentKnowledge.js';

export const config = { runtime: "edge" };

type ContentBlockItem = { type: string; text?: string; [key: string]: unknown };
type MessageContent = string | ContentBlockItem[];

// Extracts a plain-text representation of a message's content, whether it's a
// plain string or an array of content blocks (attachments). Used only for
// command detection — the full original content (string or array) still gets
// passed to Anthropic untouched.
function getMessageText(content: MessageContent): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(block => block?.type === "text" && typeof block.text === "string")
      .map(block => block.text)
      .join("\n");
  }
  return "";
}

// True if the message has any real content — non-empty string, or a non-empty
// array of content blocks (even if none of them are plain text, e.g. an
// image/document-only attachment message still counts as having content).
function hasContent(content: MessageContent): boolean {
  if (typeof content === "string") return content.trim() !== "";
  if (Array.isArray(content)) return content.length > 0;
  return false;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_SYSTEM = `You are DeAnna R. Upshaw's AI Twin — the Master Orchestrator and personal command interface of DRU AI Consulting. You speak with authority, clarity, and strategic precision in DeAnna's voice. You embody the DRU CLEAR™ framework: Clarity, Leadership, Execution, Alignment, Results. Your brand principle is AI Mastery. Leadership Clarity. Measurable Results.

${VOICE_DNA}

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
aaliyah→Aaliyah Foster (Outreach) | jaylen→Jaylen Brooks (Email) | chloe→Chloe Dubois (Copy) | zara→Zara Ahmed (ACC Weekly PDF Content Architect)
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
- ACC weekly PDF, Accelerator Circle content, leadership development/training content → zara (ACC Weekly PDF Content Architect)
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

Decide one of three outcomes:

1. The message is asking for work/content/a task to be done, AND there's enough in it to actually know what to produce (a clear subject, format, or audience — nothing you'd have to invent) — return ONLY valid JSON:
{"is_command":true,"needs_clarification":false,"agent_id":"best_agent_id","agent_name":"Full Name","task":"complete description of the full task including all details from the message"}

2. The message is clearly asking for work, but it is too vague to route without guessing (no clear subject, format, or audience — you would have to make something up that isn't in the message) — return ONLY valid JSON with ONE specific question that would resolve it:
{"is_command":true,"needs_clarification":true,"clarifying_question":"one specific, plain-English question — not stacked, not multiple questions"}

3. It is a question, conversation, or NOT asking for work to be created — return ONLY:
{"is_command":false}`;

type CommandDetection =
  | { is_command: false }
  | { is_command: true; needs_clarification: true; clarifying_question: string }
  | { is_command: true; needs_clarification: false; agent_id: string; agent_name: string; task: string };

// Logs every real API call's actual token usage and cost to Supabase so spend
// is visible in the Intelligence Hub instead of estimated by hand.
async function logModelUsage(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const rate = model.startsWith("claude-sonnet") ? { in: 3, out: 15 } : { in: 1, out: 5 };
  const cost_usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  await fetch(`${url}/rest/v1/model_usage_log`, { method: "POST", headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ source_file: "twin", model, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd }) });
}

// Twin's replies stream directly to the client, so usage can't be read from a
// single .json() call the way every other file does it. This reads a teed copy
// of the same stream independently, in the background, purely to log real
// token counts — it never touches or delays what the client actually receives.
async function logStreamUsage(stream: ReadableStream<Uint8Array>, model: string): Promise<void> {
  try {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let inputTokens = 0;
    let outputTokens = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const evt = JSON.parse(line.slice(6));
          if (evt.type === "message_start") inputTokens = evt.message?.usage?.input_tokens ?? inputTokens;
          if (evt.type === "message_delta") outputTokens = evt.usage?.output_tokens ?? outputTokens;
        } catch { /* ignore malformed SSE lines */ }
      }
    }
    await logModelUsage(model, inputTokens, outputTokens);
  } catch (err) {
    console.error("[twin] Stream usage logging failed:", err);
  }
}

async function detectCommand(lastMessage: string, apiKey: string): Promise<CommandDetection> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: CLASSIFY_PROMPT.replace("{MESSAGE}", lastMessage.replace(/"/g, '\\"')) }],
      }),
    });
    if (!res.ok) return { is_command: false };
    const data = await res.json();
    await logModelUsage("claude-haiku-4-5-20251001", data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0).catch(() => {});
    const text: string = data.content?.[0]?.text ?? '{"is_command":false}';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { is_command: false };
    return JSON.parse(match[0]);
  } catch {
    return { is_command: false };
  }
}

// ─── Attachment links (July 29 2026) ──────────────────────────────────────────
// DeAnna uploads a file to the private 'twin-attachments' Supabase Storage bucket
// herself and pastes a signed URL into her message instead of using an in-chat
// file picker (removed — it produced base64 payloads that blew past Vercel's
// 4.5MB function body limit). This detects that link, fetches the file
// server-side, and turns it into the exact same content-block shape the old
// attachment flow used, so nothing downstream (detectCommand, Anthropic calls)
// needs to know the difference.
const ATTACHMENT_URL_PATTERN = /https:\/\/[a-zA-Z0-9.-]+\.supabase\.co\/storage\/v1\/object\/sign\/twin-attachments\/[^\s"')]+/;

// Edge runtime has no Node `Buffer` global — base64-encode using Web-standard
// btoa, in chunks to avoid call-stack limits on large files.
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function extFromUrl(url: string): string {
  const path = url.split("?")[0];
  const name = path.split("/").pop() ?? "";
  return (name.split(".").pop() ?? "").toLowerCase();
}

async function buildAttachmentBlock(url: string): Promise<ContentBlockItem | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    const ext = extFromUrl(url);
    const buf = await res.arrayBuffer();

    if (ext === "pdf" || contentType.includes("application/pdf")) {
      const data = arrayBufferToBase64(buf);
      return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
    }
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext) || contentType.startsWith("image/")) {
      const data = arrayBufferToBase64(buf);
      const mediaType = contentType.startsWith("image/") ? contentType : `image/${ext === "jpg" ? "jpeg" : ext}`;
      return { type: "image", source: { type: "base64", media_type: mediaType, data } };
    }
    if (ext === "txt" || contentType.includes("text/plain")) {
      const text = new TextDecoder("utf-8").decode(buf);
      return { type: "text", text: `[Attached file from link]\n\n${text}` };
    }
    if (ext === "docx" || contentType.includes("wordprocessingml")) {
      const data = arrayBufferToBase64(buf);
      const baseUrl = "https://app.druaiconsulting.com";
      const extractRes = await fetch(`${baseUrl}/api/extract-docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, filename: "attachment.docx" }),
      });
      if (!extractRes.ok) return null;
      const { text } = await extractRes.json();
      return { type: "text", text: `[Attached Word document from link]\n\n${text}` };
    }
    return null;
  } catch (err) {
    console.error("[twin] Failed to fetch/convert attachment link:", err);
    return null;
  }
}

// Replaces a message's plain-string content with a content-block array
// (file block + remaining text) if it contains a twin-attachments link.
// Leaves the message untouched if no link is found or the fetch fails.
async function hydrateAttachmentLink(content: MessageContent): Promise<MessageContent> {
  if (typeof content !== "string") return content;
  const match = content.match(ATTACHMENT_URL_PATTERN);
  if (!match) return content;

  const url = match[0];
  const block = await buildAttachmentBlock(url);
  if (!block) return content;

  const remainingText = content.replace(url, "").trim();
  return remainingText ? [block, { type: "text", text: remainingText }] : [block];
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

    // ── Hydrate any twin-attachments links into real content blocks first ──
    const hydratedMessages = await Promise.all(
      (messages as { role: string; content: MessageContent }[]).map(async m => ({
        role: m.role,
        content: await hydrateAttachmentLink(m.content),
      }))
    );

    // ── FIX: strip any empty-content messages left behind by failed streams ──
    // Handles both plain-string content and array content (PDF/image/doc attachments)
    const cleanMessages = hydratedMessages
      .filter(m => hasContent(m.content));

    const lastUserContent: MessageContent =
      [...cleanMessages].reverse().find((m) => m.role === "user")?.content ?? "";
    const lastUserMessage: string = getMessageText(lastUserContent);
    const detection = await detectCommand(lastUserMessage, apiKey);

    // Any non-text blocks (document/image) attached to the last user message —
    // these need to travel with the task to twin-on-demand, not just its text
    // description, or the agent generating the actual content never sees the file.
    const attachmentBlocks: ContentBlockItem[] = Array.isArray(lastUserContent)
      ? lastUserContent.filter(b => b?.type !== "text")
      : [];

    // ── Persistent memory — injected into every conversation regardless of  ──
    // ── whether this is an old thread or a fresh one after "New Chat"       ──
    const memory = await fetchTwinMemory();
    const baseSystemPrompt = systemPrompt || DEFAULT_SYSTEM;
    const memorySystemPrompt = memory
      ? `${baseSystemPrompt}\n\nPERSISTENT MEMORY (durable facts from past conversations — DeAnna started a fresh conversation, but you still know this):\n${memory}`
      : baseSystemPrompt;

    // ── Case: the request is asking for work but is too vague to route without ──
    // ── guessing. Twin asks DeAnna the one clarifying question directly. Nothing ──
    // ── is routed, nothing is invented, no agent runs yet. ──────────────────────
    if (detection?.is_command && detection.needs_clarification) {
      const clarifySystemPrompt = `${memorySystemPrompt}

DeAnna just asked for work, but there isn't enough detail yet to route it to an agent without guessing at things she didn't say. Ask her exactly this one clarifying question, in your own natural voice — do not invent an answer, do not route anything, do not claim any work is in motion:

"${detection.clarifying_question}"

Keep it short — 1-2 sentences, warm and direct, just the question.`;

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 300, stream: true, system: clarifySystemPrompt, messages: cleanMessages }),
      });

      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text();
        return new Response(JSON.stringify({ error: `Anthropic error: ${anthropicRes.status}`, detail: errText }), { status: anthropicRes.status, headers: { ...CORS, "Content-Type": "application/json" } });
      }

      const [clientStream1, usageStream1] = anthropicRes.body!.tee();
      logStreamUsage(usageStream1, "claude-haiku-4-5-20251001").catch(() => {});
      return new Response(clientStream1, { headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" } });
    }

    // ── Case: request is clear enough to route. ─────────────────────────────────
    if (detection?.is_command && !detection.needs_clarification) {
      const { agent_id, agent_name, task } = detection;

      const baseUrl = "https://app.druaiconsulting.com";
      let routingSucceeded = true;
      let agentPreview = "";
      try {
        const routeRes = await fetch(`${baseUrl}/api/twin-on-demand`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_id, task, attachments: attachmentBlocks }),
        });
        if (!routeRes.ok) {
          routingSucceeded = false;
          console.error(`[twin] twin-on-demand returned ${routeRes.status}`);
        } else {
          // twin-on-demand already runs the agent synchronously and hands back its
          // real output as `preview` before this response even returns — Twin just
          // never read it before. That's what lets us respond honestly below.
          const routeData = await routeRes.json();
          agentPreview = typeof routeData?.preview === "string" ? routeData.preview : "";
        }
      } catch (err) {
        routingSucceeded = false;
        console.error("[twin] twin-on-demand call failed:", err);
      }

      if (!routingSucceeded) {
        return new Response(
          JSON.stringify({ error: `Routing to ${agent_name} failed — the request did not actually fire. Please try again.` }),
          { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
        );
      }

      const commandSystemPrompt = `${memorySystemPrompt}

DeAnna just commanded that "${task}" be routed to ${agent_name}. Here is exactly what ${agent_name} actually sent back — read it for real, do not assume:

---
${agentPreview || "(no output returned)"}
---

Decide which of these it actually is, based on the text above, and respond accordingly:

CASE A — ${agent_name} is asking DeAnna a real question, is missing information, or is presenting options for her to choose, instead of delivering finished work:
- Relay that question/those options to DeAnna directly, in your own voice, honestly
- Do NOT claim anything is "in motion" or "executing" — nothing is; ${agent_name} is waiting on her answer
- Do NOT invent an answer on her behalf

CASE B — ${agent_name} actually produced real work (a draft, script, copy, etc.):
- Acknowledge honestly — something like "On it" — ${agent_name} has handed off a first draft
- Say it is now headed through compliance and voice review — do NOT claim it has already been reviewed, cleared, or approved, because that has not happened yet
- NEVER give timelines or delivery estimates of any kind
- NEVER claim a "full governance chain" has already executed — say only what has actually happened

FORMATTING RULES — strictly enforced:
- Write in short, punchy paragraphs with a blank line between each
- 2 to 4 paragraphs maximum
- No bullet points, no headers, no numbered lists — flowing paragraphs only
- Each paragraph should be 1 to 3 sentences`;

      const routingMessages = [
        ...cleanMessages.slice(0, -1),
        { role: "user", content: `DeAnna just commanded: "${task}" — routed to ${agent_name}. Respond honestly, in your own voice, based on what ${agent_name} actually sent back — not on an assumption about what should have happened.` },
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

      const [clientStream2, usageStream2] = anthropicRes.body!.tee();
      logStreamUsage(usageStream2, "claude-haiku-4-5-20251001").catch(() => {});
      return new Response(clientStream2, { headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" } });
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

    const [clientStream3, usageStream3] = anthropicRes.body!.tee();
    logStreamUsage(usageStream3, "claude-haiku-4-5-20251001").catch(() => {});
    return new Response(clientStream3, { headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" } });

  } catch (error: unknown) {
    console.error("[twin] Unhandled error:", error instanceof Error ? error.stack ?? error.message : String(error));
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
}
