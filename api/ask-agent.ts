// ================================================================
// DRU AI Leadership Ecosystem™ — Ask Agent Endpoint
// File: api/ask-agent.ts
// Runtime: Vercel Node.js Serverless
//
// Routes DeAnna's questions directly to the specific agent who
// created the content she is questioning. The agent responds
// in their persona using their full original CSQ output as context.
// ================================================================

export const config = { maxDuration: 30 };

interface ConversationMessage {
  role: 'user' | 'agent';
  text: string;
}

// Logs every real API call's actual token usage and cost to Supabase so spend
// is visible in the Intelligence Hub instead of estimated by hand.
async function logModelUsage(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const rate = model.startsWith('claude-sonnet') ? { in: 3, out: 15 } : { in: 1, out: 5 };
  const cost_usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  await fetch(`${url}/rest/v1/model_usage_log`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ source_file: 'ask-agent', model, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd }) });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const {
    agent_id,
    agent_name,
    agent_role,
    question,
    card_output,
    conversation_history = [],
    csq_id = null, // Set only when this conversation is about a hard-rejected
                    // chief_of_staff_queue item -- second learning channel,
                    // alongside Isabella's automatic note (cmd-isabella.ts).
  } = req.body;

  if (!agent_id || !question) {
    res.status(400).json({ error: 'agent_id and question are required' });
    return;
  }

  const apiKey     = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey) { res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' }); return; }

  // ── Fetch agent's original CSQ output ─────────────────────
  // Try today first, then yesterday (in case chain ran yesterday)
  let agentOriginalOutput = card_output ?? '';

  if (supabaseUrl && supabaseKey && agent_id !== 'twin') {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const r = await fetch(
        `${supabaseUrl}/rest/v1/chief_of_staff_queue?agent_id=eq.${agent_id}&created_at=gte.${yesterday.toISOString()}&order=created_at.desc&limit=1`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (r.ok) {
        const data = await r.json();
        if (data?.[0]?.raw_output) {
          agentOriginalOutput = data[0].raw_output;
          console.log(`[ask-agent] ✅ Fetched original output for ${agent_name} from CSQ`);
        }
      }
    } catch (e) {
      console.warn('[ask-agent] CSQ fetch failed, using card_output as fallback:', e);
    }
  }

  // ── Build conversation messages ────────────────────────────
  const messages = [
    ...(conversation_history as ConversationMessage[]).map(msg => ({
      role: msg.role === 'agent' ? 'assistant' as const : 'user' as const,
      content: msg.text,
    })),
    { role: 'user' as const, content: question },
  ];

  // ── Agent persona system prompt ────────────────────────────
  const isTwin     = agent_id === 'twin';
  const isIsabella = agent_id === 'isabella';

  const systemPrompt = isTwin
    ? `You are DeAnna R. Upshaw's AI Twin — Master Orchestrator of DRU AI Consulting. DeAnna is reviewing the daily briefing you synthesized and has a question. Answer in her voice and with full strategic authority. Draw on everything the team produced today.

YOUR SYNTHESIZED BRIEFING (the content DeAnna is reviewing):
${agentOriginalOutput}

Answer DeAnna's question directly. If she wants more depth on any insight, expand fully. If she asks what to do, give her clear action steps.`
    : `You are ${agent_name}, ${agent_role} for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.

DeAnna R. Upshaw is reviewing your work and has a question for you specifically. You are the expert in your domain — answer from that expertise and in your own professional voice. Be specific, practical, and thorough. This is a direct conversation with your CEO.

YOUR ORIGINAL WORK (what DeAnna is reviewing and asking about):
${agentOriginalOutput}

${isIsabella ? 'Respond with legal precision and compliance authority.' : ''}

Answer DeAnna\'s question directly. If she asks you to expand on something you identified, go deep. If she asks how to implement something you recommended, give her clear actionable steps. Never be vague — she needs specifics.`;

  // ── Use Sonnet for Twin and Isabella, Haiku for all others ─
  const model = (isTwin || isIsabella)
    ? 'claude-sonnet-4-6'
    : 'claude-haiku-4-5-20251001';

  // Second learning channel: DeAnna talking directly to the agent about a
  // hard-rejected item. Only fires when csq_id is present -- ordinary
  // questions about fine cards don't need to train anything.
  async function writeAgentCorrection(note: string): Promise<void> {
    if (!csq_id) return;
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    try {
      let task: string | null = null;
      try {
        const taskRes = await fetch(`${url}/rest/v1/chief_of_staff_queue?id=eq.${csq_id}&select=task`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
        if (taskRes.ok) { const rows = await taskRes.json(); task = rows?.[0]?.task ?? null; }
      } catch { /* task lookup is best-effort -- correction still saves without it */ }
      await fetch(`${url}/rest/v1/agent_corrections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' },
        body: JSON.stringify({ agent_name, correction_note: note, source: 'deanna_conversation', csq_id, ...(task ? { task } : {}) }),
      });
    } catch (err) { console.error(`[ask-agent] Failed to write agent_correction for ${agent_name}:`, err); }
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        system: systemPrompt,
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      console.error('[ask-agent] Anthropic error:', err);
      res.status(500).json({ error: `Anthropic error: ${anthropicRes.status}` });
      return;
    }

    const data     = await anthropicRes.json();
    const response = data.content?.[0]?.text ?? 'I was unable to generate a response. Please try again.';
    await logModelUsage(model, data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0).catch(() => {});

    console.log(`[ask-agent] ✅ ${agent_name} responded to DeAnna's question`);
    await writeAgentCorrection(question);
    res.status(200).json({ response, agent_name, agent_id });

  } catch (error) {
    console.error('[ask-agent] Error:', error);
    res.status(500).json({ error: 'Failed to get agent response' });
  }
}
