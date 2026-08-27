// api/twin-new-chat.ts
// Called when DeAnna starts a "New Chat" in the Twin interface. Does two things
// before the active thread is cleared client-side:
//   1. Archives the full transcript (nothing is ever actually deleted)
//   2. Distills durable facts from the conversation into twin_memory — merged
//      with existing memory, not appended endlessly — so Twin still remembers
//      who DeAnna is and what's ongoing, without replaying the raw transcript
//      into every future conversation forever.

export const config = { runtime: "edge" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Logs every real API call's actual token usage and cost to Supabase so spend
// is visible in the Intelligence Hub instead of estimated by hand.
async function logModelUsage(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const rate = model.startsWith("claude-sonnet") ? { in: 3, out: 15 } : { in: 1, out: 5 };
  const cost_usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  await fetch(`${url}/rest/v1/model_usage_log`, { method: "POST", headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ source_file: "twin-new-chat", model, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd }) });
}

const MEMORY_DISTILL_PROMPT = `You maintain durable long-term memory for DeAnna R. Upshaw's AI Twin — a command interface for her DRU AI Consulting business.

EXISTING MEMORY (facts already known from past conversations):
{EXISTING_MEMORY}

NEW CONVERSATION TO INCORPORATE:
{TRANSCRIPT}

Produce an UPDATED memory document. Rules:
- Keep genuinely durable facts: ongoing projects, standing preferences, key business context, unresolved items she'll likely reference again.
- Merge with existing memory — do not duplicate what's already captured, do not simply append.
- Drop anything now stale, resolved, or clearly one-off/trivial from this conversation.
- Write as concise bullet points, organized by topic if helpful.
- Keep the total under roughly 600 words. If it's growing too long, prioritize what's most likely to matter in future conversations and drop the least relevant older items.
- Output ONLY the updated memory document — no preamble, no commentary.`;

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...CORS, "Content-Type": "application/json" } });

  try {
    const { messages } = await req.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!apiKey || !supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Missing required environment variables" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const cleanMessages = (messages as { role: string; content: string }[] | undefined ?? [])
      .filter((m) => m.content && m.content.trim() !== "");

    // Nothing to archive or learn from — just acknowledge
    if (cleanMessages.length === 0) {
      return new Response(JSON.stringify({ success: true, skipped: "empty_conversation" }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // ── Archive the full transcript, unconditionally ──────────────────────
    await fetch(`${supabaseUrl}/rest/v1/twin_conversation_archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      body: JSON.stringify({ transcript: cleanMessages, message_count: cleanMessages.length }),
    });

    // ── Fetch existing memory ──────────────────────────────────────────────
    const memRes = await fetch(`${supabaseUrl}/rest/v1/twin_memory?id=eq.1&select=content`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    const memRows = await memRes.json();
    const existingMemory = memRows[0]?.content || "(no prior memory yet)";

    // ── Distill this conversation + existing memory into an updated memory doc ──
    const transcriptText = cleanMessages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const prompt = MEMORY_DISTILL_PROMPT
      .replace("{EXISTING_MEMORY}", existingMemory)
      .replace("{TRANSCRIPT}", transcriptText);

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      // Archive still succeeded even if memory distillation fails — not fatal
      console.error("[twin-new-chat] Memory distillation failed:", await anthropicRes.text());
      return new Response(JSON.stringify({ success: true, archived: true, memory_updated: false }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const anthropicData = await anthropicRes.json();
    await logModelUsage("claude-haiku-4-5-20251001", anthropicData.usage?.input_tokens ?? 0, anthropicData.usage?.output_tokens ?? 0).catch(() => {});
    const updatedMemory: string = anthropicData.content?.[0]?.text?.trim() ?? existingMemory;

    await fetch(`${supabaseUrl}/rest/v1/twin_memory?id=eq.1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      body: JSON.stringify({ content: updatedMemory, updated_at: new Date().toISOString() }),
    });

    return new Response(JSON.stringify({ success: true, archived: true, memory_updated: true }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[twin-new-chat] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
}
