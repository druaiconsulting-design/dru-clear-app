// api/cmd-governance.ts
// Governance Panel — runs daily at 18:00 UTC via dru-governance-legal-review-daily
// Picks up isabella_cleared items, applies governance/legal review
// FIX: extractJSON replaces greedy regex that was causing SyntaxError on complex content

import type { VercelRequest, VercelResponse } from "@vercel/node";
export const config = { maxDuration: 300 };

const GENIUS_MODE = `You operate in Genius Mode — think and respond at the level of a top 0.1% expert in your field. Apply deep logic, strategic frameworks, creative synthesis, and second-order thinking to every output. Never produce generic or surface-level work. Every sentence must earn its place.`;

const INTERNAL_CATEGORIES = ['coaching','sales_support','lead_intelligence','proposals','product_knowledge','product_launch','digital_marketing','analytics_report','seo_sem','legal_briefing','expense_report','financial_report','tax_strategy','disclaimer_review','privacy_policy','contract_review','brand_monitoring','ai_intelligence','recruiting','onboarding','helpdesk','client_onboarding','community_management','feedback_coaching','creative_direction','course_architecture','presentation_design','video_production','issue_resolution','multichannel_comms'];
const CLIENT_FACING_CATEGORIES = ['linkedin_post','instagram_post','facebook_post','twitter_post','tiktok_post','youtube_post','social_post','email_marketing','outreach','copywriting','press_release','localization','design_brief','content_creation','community_insight','community_lesson','community_challenge','community_edge','community_training','community_engagement'];

interface CSQItem {
  id: string; agent_id: string; agent_name: string; division: string;
  task: string; category: string; raw_output: string; priority: string;
  retry_count?: number; correction_notes?: string;
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

async function runGovernancePanel(): Promise<{ reviewed: number; cleared: number; blocked: number }> {
  const items = await getCSQItems('isabella_cleared');
  console.log(`[governance] Reviewing ${items.length} Isabella-cleared items...`);
  if (items.length === 0) return { reviewed: 0, cleared: 0, blocked: 0 };
  let cleared = 0; let blocked = 0;
  const updates: Promise<void>[] = [];

  for (const item of items) {
    try {
      const isInternal = INTERNAL_CATEGORIES.includes(item.category);
      const isClientFacing = CLIENT_FACING_CATEGORIES.includes(item.category);
      let rulesBlock = '';
      if (isInternal) {
        rulesBlock = `INTERNAL OPERATIONAL CONTENT. Goes to AI Twin only. Never published.\nBLOCK ONLY IF: (1) specific factual error misleading DeAnna, (2) false credential claim about DeAnna, (3) named contractual obligation, (4) false financial figure vs known pricing: Strategic Diagnostic $3,497 | Executive Diagnostic $4,997 | Course $1,497-$12,997.\nIf NONE present, MUST return cleared:true.`;
      } else if (isClientFacing) {
        rulesBlock = `CLIENT-FACING CONTENT. Will be published or sent to clients/community subscribers.\nBLOCK ONLY IF: (1) income guarantee without disclaimer, (2) false credential claim, (3) named privacy violation, (4) contractual guarantee creating legal liability, (5) false financial figure vs known pricing.\nIf NONE present, MUST return cleared:true.`;
      } else {
        rulesBlock = `Unclassified. Apply internal rules. BLOCK ONLY IF factual error, false credential, named contractual obligation, or false financial figure. If NONE, MUST return cleared:true.`;
      }

      const raw = await callAnthropic(
        `${GENIUS_MODE}\nYou are the AI Governance and Legal & Finance panel for DRU AI Consulting. Isabella has already cleared trademark and service class compliance — FINAL. Do NOT re-check.\n${rulesBlock}\nAGENT: ${item.agent_name} | DIVISION: ${item.division} | CATEGORY: ${item.category} | TASK: ${item.task}\nCONTENT: ${item.raw_output}\nOutput ONLY this JSON:\nIf cleared: {"cleared":true,"compliance_score":9,"governance_notes":"Panel reviewed. No blocking conditions present.","legal_notes":"No legal risk detected.","flags":"none"}\nIf blocked: {"cleared":false,"compliance_score":3,"governance_notes":"Condition violated: [exact text]","legal_notes":"[issue]","flags":"[exact phrase]"}`,
        800
      );

      const result = JSON.parse(extractJSON(raw));

      if (result.cleared) {
        cleared++;
        updates.push(updateCSQ(item.id, {
          governance_cleared: true,
          compliance_score: result.compliance_score ?? 8,
          governance_notes: result.governance_notes ?? '',
          legal_notes: result.legal_notes ?? '',
          governance_flags: result.flags ?? 'none',
          governance_cleared_at: new Date().toISOString(),
          status: 'governance_cleared',
        }));
      } else {
        blocked++;
        updates.push(updateCSQ(item.id, {
          governance_cleared: false,
          governance_notes: result.governance_notes ?? 'Blocked',
          governance_flags: result.flags ?? 'review_failed',
          governance_cleared_at: new Date().toISOString(),
          status: 'rejected',
        }));
      }
    } catch (error) {
      console.error(`[governance] Failed item ${item.id}:`, error);
      blocked++;
      updates.push(updateCSQ(item.id, {
        governance_cleared: false,
        governance_notes: 'Governance review failed.',
        governance_cleared_at: new Date().toISOString(),
        status: 'governance_error',
      }));
    }
  }

  await Promise.all(updates);
  console.log(`[governance] ${items.length} reviewed: ${cleared} cleared, ${blocked} blocked`);
  return { reviewed: items.length, cleared, blocked };
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
  console.log('[cmd-governance] Governance panel triggered');
  const result = await runGovernancePanel();
  res.status(202).json({ success: true, ...result });
}
