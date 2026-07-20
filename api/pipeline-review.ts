// api/pipeline-review.ts
// Pipeline Review — runs daily at 18:20 UTC via dru-pipeline-review-daily
// Picks up governance_cleared items from CSQ — Raymond reviews each and marks command_approved for synthesis
// Raymond reviews each governance_cleared item in a single API call, adds strategic notes,
// and marks items command_approved for Raymond's synthesis run at 19:00 UTC.
// FIX: extractJSON replaces greedy regex that was causing SyntaxError on complex content

import type { VercelRequest, VercelResponse } from "@vercel/node";
export const config = { maxDuration: 300 };

const GENIUS_MODE = `You operate in Genius Mode — think and respond at the level of a top 0.1% expert in your field. Apply deep logic, strategic frameworks, creative synthesis, and second-order thinking to every output. Never produce generic or surface-level work. Every sentence must earn its place.`;

interface CSQItem {
  id: string; agent_id: string; agent_name: string; division: string;
  task: string; category: string; raw_output: string; priority: string;
  retry_count?: number; raymond_notes?: string; raymond_action?: string;
  raymond_priority?: string; travis_notes?: string; priya_notes?: string;
}

// ── extractJSON: depth-tracking JSON extractor (fixes greedy regex SyntaxError) ──
function extractJSON(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in response');
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('Unterminated JSON object in response');
}

async function callAnthropic(prompt: string, maxTokens = 2000): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

async function getCSQItems(status: string): Promise<CSQItem[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const res = await fetch(`${url}/rest/v1/chief_of_staff_queue?status=eq.${status}&order=created_at.asc`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return [];
  return await res.json();
}

async function updateCSQ(id: string, updates: Record<string, unknown>): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  await fetch(`${url}/rest/v1/chief_of_staff_queue?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(updates),
  });
}

async function runCommandLayer(): Promise<{ reviewed: number }> {
  const items = await getCSQItems('governance_cleared');
  console.log(`[executive_leadership] Reviewing ${items.length} governance-cleared items (Raymond solo — one call per item)...`);
  if (items.length === 0) return { reviewed: 0 };

  for (const item of items) {
    try {
      const rawRaymond = await callAnthropic(
        `${GENIUS_MODE}\nYou are Raymond Holloway, sole Chief of Staff for DRU AI Consulting. You run the pipeline review step — a single consolidated review of all governance-cleared agent output. Content cleared by Isabella and Governance.\nAGENT: ${item.agent_name} (${item.division}) | TASK: ${item.task}\nCONTENT: ${item.raw_output}\nYour single review covers three responsibilities:\n1. STRATEGIC PRIORITY — assess priority and routing action, with one strategic sentence for the daily briefing.\n2. PACKAGING — one sentence on how this fits today's briefing.\n3. DEANNA FLAG — anything time-sensitive or requiring DeAnna's personal action today. If nothing, use an empty string.\nNOTE: If content contains "UPSELL SIGNAL:" flag priority as 'high' and note to route to Aaliyah Foster in Revenue, Growth & Sales.\nOutput ONLY this JSON: {"priority":"normal","action":"route_to_twin","notes":"one strategic sentence for the daily briefing","package_notes":"one sentence on how this fits today's briefing","deanna_action":"time-sensitive item needing DeAnna today, or empty string"}`,
        600
      );

      const raymond = JSON.parse(extractJSON(rawRaymond));

      await updateCSQ(item.id, {
        raymond_reviewed: true,
        raymond_notes: raymond?.notes ?? '',
        raymond_priority: raymond?.priority ?? 'normal',
        raymond_action: raymond?.action ?? 'route_to_twin',
        // Columns retained for downstream compatibility — both authored by Raymond post-restructure:
        travis_notes: raymond?.package_notes ?? '',
        priya_notes: raymond?.deanna_action ?? '',
        command_approved_at: new Date().toISOString(),
        status: 'command_approved',
        priority: raymond?.priority ?? 'normal',
      });

      console.log(`[executive_leadership] Approved: ${item.agent_name}`);
    } catch (error) {
      console.error(`[executive_leadership] Failed item ${item.id}:`, error);
    }
  }

  console.log(`[executive_leadership] ${items.length} items command-approved`);
  return { reviewed: items.length };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cron-secret');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const incomingSecret = req.headers['x-cron-secret'];
  if (incomingSecret !== undefined && incomingSecret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }
  console.log('[pipeline-review] Raymond Holloway running pipeline review');
  const result = await runCommandLayer();
  res.status(202).json({ success: true, ...result });
}
