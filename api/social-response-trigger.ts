// DRU AI Leadership Ecosystem™ — api/social-response-trigger.ts
// Social Media Response Team — Real-time inbound handler
// Platforms: Facebook, Instagram (LinkedIn handled manually)
// Agents: Dominique (DRU CLEAR™), Isaiah (5D Leadership™), Nadia (5C Cultural DNA™),
//         Elijah (AI Sales Mastery™), Solange (default catch-all)
// Architecture: Make.com List Posts → List Comments → fires here → dedup → classify → dual mode
//   Dedup: social_processed_interactions table — each interaction_id handled exactly once
//   Generic  → returns auto reply text for Make to post immediately
//   Substantive → saves approval card to Intelligence Hub for DeAnna to approve

export const config = { maxDuration: 30 };

const GENIUS_MODE = `You operate in Genius Mode — think and respond at the level of a top 0.1% expert in your field. Apply deep logic, strategic frameworks, creative synthesis, and second-order thinking to every output. Make every sentence earn its place with real specificity and depth.`;

const TM_PAIRS: [RegExp, string][] = [
  [/DRU CLEAR(?!™)/g,                           'DRU CLEAR™'],
  [/DRU AI Leadership Ecosystem(?!™)/g,         'DRU AI Leadership Ecosystem™'],
  [/DRU AI Transformation Pathway(?!™)/g,       'DRU AI Transformation Pathway™'],
  [/5C Cultural DNA(?!™)/g,                     '5C Cultural DNA™'],
  [/5D Leadership(?!™)/g,                       '5D Leadership™'],
  [/AI Sales Mastery(?!™)/g,                    'AI Sales Mastery™'],
  [/From Confusion to Confident with AI(?!™)/g, 'From Confusion to Confident with AI™'],
];

function enforceTM(content: string): string {
  let corrected = content;
  for (const [pattern, replacement] of TM_PAIRS) {
    corrected = corrected.replace(pattern, replacement);
  }
  return corrected;
}

async function callAnthropic(prompt: string, maxTokens = 500): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json();
  await logModelUsage('claude-haiku-4-5-20251001', data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0).catch(() => {});
  return data.content?.[0]?.text ?? '';
}

// Logs every real API call's actual token usage and cost to Supabase so spend
// is visible in the Intelligence Hub instead of estimated by hand.
async function logModelUsage(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const rate = model.startsWith('claude-sonnet') ? { in: 3, out: 15 } : { in: 1, out: 5 };
  const cost_usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  await fetch(`${url}/rest/v1/model_usage_log`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ source_file: 'social-response-trigger', model, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd }) });
}

async function writeToApprovals(record: Record<string, unknown>): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/approvals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    console.error(`[social-response] Approvals write failed: ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  return Array.isArray(data) && data[0]?.id ? data[0].id : null;
}

async function alreadyProcessed(interaction_id: string): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const res = await fetch(
    `${url}/rest/v1/social_processed_interactions?interaction_id=eq.${encodeURIComponent(interaction_id)}&select=interaction_id`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) {
    console.error(`[social-response] Dedup check failed: ${await res.text()}`);
    return false;
  }
  const data = await res.json();
  return Array.isArray(data) && data.length > 0;
}

async function markProcessed(interaction_id: string, platform: string): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const res = await fetch(`${url}/rest/v1/social_processed_interactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'resolution=ignore-duplicates',
    },
    body: JSON.stringify({ interaction_id, platform }),
  });
  if (!res.ok) console.error(`[social-response] Mark processed failed: ${await res.text()}`);
}

const AGENT_MAP: Record<string, { name: string; role: string }> = {
  dominique: { name: 'Dominique Carter', role: 'DRU CLEAR™ Social Response'       },
  isaiah:    { name: 'Isaiah Webb',       role: '5D Leadership™ Social Response'   },
  nadia:     { name: 'Nadia Osei',        role: '5C Cultural DNA™ Social Response' },
  elijah:    { name: 'Elijah Brooks',     role: 'AI Sales Mastery™ Social Response'},
  solange:   { name: 'Solange Dupont',    role: 'Social Response — Entry Point'    },
};

async function classifyAndDraft(
  text: string,
  platform: string,
  interaction_type: string,
  author_name: string
): Promise<{ agent: string; is_generic: boolean; reply_text: string }> {

  const prompt = `${GENIUS_MODE}

You are a social media response classifier and drafter for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.

INCOMING ${interaction_type.toUpperCase()} on ${platform}:
From: ${author_name}
Text: "${text}"

PROPRIETARY IP TO RECOGNIZE:
- DRU CLEAR™ (Clarity, Leadership, Execution, Alignment, Results) → agent: dominique
- 5D Leadership™ (leadership dimensions, team, organizational transformation) → agent: isaiah
- 5C Cultural DNA™ (culture, communication, collaboration, connection, commitment) → agent: nadia
- AI Sales Mastery™ (DISC, buyer behavior, AI in sales, revenue, conversion) → agent: elijah
- General / vague / motivational / how to start / first step / catch-all → agent: solange

STEP 1 — CLASSIFY AGENT:
Which agent is best positioned to respond? Pick exactly one: dominique, isaiah, nadia, elijah, solange.

STEP 2 — CLASSIFY MODE:
Generic = single emoji, one-word praise ("Amazing!", "Love this!", "So true!", "Fire!"), brief positivity with no substance or question.
Substantive = any real question, pain point, shared struggle, curiosity, request for help, or insight that deserves a thoughtful response.

STEP 3 — DRAFT RESPONSE:
If generic: Write a warm 1-2 sentence human acknowledgment. Friendly and genuine. No CTA. No links. No framework names.
If substantive: Write a 100-150 word response in the agent's voice. Reference ONE relevant IP framework by name only — never explain the full system. End with one genuine question or invitation to explore further. No CTA links. No prices. No soliciting.

TRADEMARK: Always write DRU CLEAR™, 5D Leadership™, 5C Cultural DNA™, AI Sales Mastery™ with ™.

Return ONLY valid JSON with no preamble or markdown:
{"agent":"...","is_generic":true,"reply_text":"..."}`;

  const raw = await callAnthropic(prompt, 400);

  const firstBrace = raw.indexOf('{');
  const lastBrace  = raw.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON in classification response');

  const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
  return {
    agent:      parsed.agent      || 'solange',
    is_generic: parsed.is_generic === true,
    reply_text: enforceTM(parsed.reply_text || ''),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const {
    platform: rawPlatform,
    interaction_type: rawInteractionType,
    interaction_id,
    text,
    author_name,
    author_handle,
    author_id,
    post_id,
  } = req.body || {};

  // Tolerant normalization: Make may send bundles/blobs/flags — derive clean values here.
  const platformStr = typeof rawPlatform === 'string' ? rawPlatform : JSON.stringify(rawPlatform ?? '');
  const platform = platformStr.toLowerCase().includes('instagram') ? 'instagram' : 'facebook';
  const interaction_type =
    typeof rawInteractionType === 'string' && /^(comment|reply|mention|dm|message)$/i.test(rawInteractionType)
      ? rawInteractionType.toLowerCase()
      : 'comment';

  // Nothing to classify (empty/attachment-only comment) → graceful skip, not an error.
  if (!text || !String(text).trim()) {
    res.status(200).json({
      response_type: 'skip',
      reason: 'empty_text',
      agent: '',
      reply_text: '',
      approval_id: null,
      interaction_id: interaction_id ?? null,
      post_id: post_id ?? null,
    });
    return;
  }

  // Dedup guard: skip anything we've already handled (Make List modules re-send old comments)
  if (interaction_id) {
    const seen = await alreadyProcessed(String(interaction_id));
    if (seen) {
      console.log(`[social-response] Skipping already-processed interaction ${interaction_id}`);
      res.status(200).json({
        response_type: 'skip',
        reason: 'already_processed',
        agent: '',
        reply_text: '',
        approval_id: null,
        interaction_id: interaction_id ?? null,
        post_id: post_id ?? null,
      });
      return;
    }
  }

  console.log(`[social-response] ${platform} ${interaction_type} from @${author_handle ?? author_name}: "${String(text).slice(0, 80)}"`);

  try {
    const { agent, is_generic, reply_text } = await classifyAndDraft(
      String(text),
      String(platform),
      String(interaction_type),
      String(author_name || author_handle || 'someone')
    );

    if (interaction_id) await markProcessed(String(interaction_id), String(platform));

    if (is_generic) {
      // Auto-response: Make.com reads reply_text and posts it immediately
      console.log(`[social-response] Generic → auto-reply via ${agent}`);
      res.status(200).json({
        response_type: 'auto',
        reason: '',
        agent,
        reply_text,
        approval_id: null,
        interaction_id: interaction_id ?? null,
        post_id: post_id ?? null,
      });
      return;
    }

    // Substantive: save to Intelligence Hub for DeAnna to approve and send
    const agentInfo    = AGENT_MAP[agent] ?? AGENT_MAP.solange;
    const platformLabel = platform === 'facebook' ? 'Facebook' : 'Instagram';
    const typeLabel     = String(interaction_type).charAt(0).toUpperCase() + String(interaction_type).slice(1);

    const approval_id = await writeToApprovals({
      source:           'social_response',
      trigger_type:     'social_response',
      agent_name:       agentInfo.name,
      agent_role:       agentInfo.role,
      division:         'Social Media Response',
      task_brief:       `[${platformLabel} ${typeLabel}] from ${author_name || author_handle}: "${String(text).slice(0, 120)}"`,
      original_content: String(text),
      output:           reply_text,
      edited_output:    null,
      status:           'pending',
      ghl_contact_id:   null,
      notify_deanna:    true,
      priority:         'HIGH',
      category:         'social_response',
      platform:         platformLabel,
      context:          JSON.stringify({ interaction_id, post_id, platform, interaction_type, author_name, author_handle, author_id }),
      archived:         false,
    });

    console.log(`[social-response] Substantive → hub card ${approval_id} via ${agent}`);
    res.status(200).json({
      response_type: 'hub',
      reason: '',
      agent,
      reply_text: '',
      approval_id,
      interaction_id: interaction_id ?? null,
      post_id: post_id ?? null,
    });

  } catch (error) {
    console.error('[social-response] Error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
}
