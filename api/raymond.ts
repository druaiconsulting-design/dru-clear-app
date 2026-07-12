// api/raymond.ts
// Daily Synthesis — Raymond Holloway, sole Chief of Staff
// Runs daily at 19:00 UTC via pg_cron job dru-raymond-synthesis-daily (formerly dru-twin-synthesis-daily → cmd-twin.ts)
// Picks up command_approved items, produces division cards + the Daily Briefing
// Fires ONE GHL notification to DeAnna when complete
//
// VOICE RULES (July 2026 rewiring):
//   - Daily Briefing = Raymond's voice, reporting to DeAnna. Decisions are QUESTIONS, never conclusions.
//     Raymond NEVER invents decisions, preferences, or commitments on DeAnna's behalf.
//   - Division cards = the agents' own voices. Each agent gets their own first-person block:
//     what they did + their suggested action plan. No narrator. No editorializing.
//   - Compliance flags: last 24 hours ONLY (date-filtered), compressed to one line per agent.
//     (Previously unfiltered — six weeks of stale flags were re-injected daily.)
//
// PHASE 2: Detects Darius multi-platform JSON → populates linkedin_content, facebook_content, instagram_caption
// The AI Twin no longer runs daily synthesis — she is the face of all video content and retains on-demand chat (twin.ts).

import type { VercelRequest, VercelResponse } from "@vercel/node";
export const config = { maxDuration: 300 };

const SOCIAL_DIVISIONS = ['Content & Brand', 'Marketing'];
const CLIENT_FACING_CATEGORIES = ['linkedin_post','instagram_post','facebook_post','twitter_post','tiktok_post','youtube_post','social_post','email_marketing','outreach','copywriting','press_release','localization','design_brief','content_creation','community_insight','community_lesson','community_challenge','community_edge','community_training','community_engagement','linkedin_article','newsletter_nonmember','newsletter_navigator','newsletter_accelerator'];

// Agents that always get their own standalone Intelligence Hub card
// regardless of division — never buried in division synthesis
const CONTENT_ALWAYS_SURFACE = ['Nia Robinson', 'Chloe', 'Kwame', 'Theo Nguyen', 'Jordan Hayes', 'Simone Laurent', 'Amelia Santos'];

interface CSQItem {
  id: string; agent_id: string; agent_name: string; division: string;
  task: string; category: string; raw_output: string; priority: string;
  retry_count?: number; raymond_notes?: string; travis_notes?: string;
  priya_notes?: string; isabella_flags?: string; correction_notes?: string;
}

interface MultiPlatformPost {
  linkedin_content: string;
  facebook_content: string;
  instagram_caption: string;
  spanish_content?: string;
  hook?: string;
  content_type?: string;
}

async function callSonnet(prompt: string, maxTokens = 2000): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Synthesis error ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

// sinceIso: optional created_at lower bound — used to keep compliance flags to the
// last 24 hours instead of accumulating forever.
async function getCSQItems(status: string, sinceIso?: string): Promise<CSQItem[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const since = sinceIso ? `&created_at=gte.${sinceIso}` : '';
  const res = await fetch(`${url}/rest/v1/chief_of_staff_queue?status=eq.${status}${since}&order=created_at.asc`, {
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

async function writeApproval(record: Record<string, unknown>): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/approvals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=representation' },
    body: JSON.stringify(record),
  });
  if (!res.ok) { console.error(`[approvals] Write failed: ${await res.text()}`); return null; }
  const data = await res.json();
  return data?.[0]?.id ?? null;
}

function getDivisionCategory(division: string): string {
  const map: Record<string, string> = {
    'Revenue, Growth & Sales': 'revenue_growth', 'Content & Brand': 'content_brand',
    'Marketing': 'marketing', 'Legal & Finance': 'legal_finance',
    'AI Governance': 'ai_governance', 'HR': 'hr', 'Client Delivery': 'client_delivery',
    'Customer Support': 'customer_support', 'Community Connection': 'community_connection',
  };
  return map[division] ?? 'division_briefing';
}

function getPlatformLabel(category: string): string {
  const map: Record<string, string> = {
    linkedin_post: 'LinkedIn', instagram_post: 'Instagram', facebook_post: 'Facebook',
    twitter_post: 'X', tiktok_post: 'TikTok', youtube_post: 'YouTube', social_post: 'Social',
    content_creation: 'Content', press_release: 'Press', design_brief: 'Design',
    localization: 'Localization', copywriting: 'Copy', email_marketing: 'Email', outreach: 'Outreach',
    linkedin_article: 'LinkedIn', newsletter_nonmember: 'Email', newsletter_navigator: 'Email', newsletter_accelerator: 'Email',
  };
  return map[category] ?? 'Social';
}

function tryParseMultiPlatform(rawOutput: string): MultiPlatformPost | null {
  try {
    const jsonStr = rawOutput.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    if (
      typeof parsed.linkedin_content === 'string' &&
      typeof parsed.facebook_content === 'string' &&
      typeof parsed.instagram_caption === 'string'
    ) {
      return parsed as MultiPlatformPost;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Division card prompt: the agents speak for themselves ──────────────────
function getDivisionPrompt(division: string, today: string, content: string): string {
  return `You are formatting the ${division} division's daily report for DeAnna R. Upshaw of DRU AI Consulting. Today: ${today}.
FRAMEWORKS (always ™): DRU CLEAR™ | DRU AI Leadership Ecosystem™ | DRU AI Transformation Pathway™ | 5C Cultural DNA™ | 5D Leadership™ | AI Sales Mastery™ | From Confusion to Confident with AI™

Each agent speaks for themselves. For EACH agent in the outputs below, write exactly one block in this format:

**[Agent Name] — [what they worked on, 2-5 words]**
Done: 1-2 sentences in the agent's own first-person voice ("I completed...", "I analyzed...") summarizing what they delivered. Preserve their key specifics, numbers, and names.
Action plan: 1-2 short bullets of THEIR suggested next actions, in their voice ("Recommend...", "Next I will...").

HARD RULES:
- Every agent in the outputs gets exactly one block. Never skip an agent. Never merge agents.
- Use ONLY what each agent actually produced. Never invent work, opinions, or recommendations.
- No narrator voice. No introduction, no conclusion, no commentary between blocks, no synthesis.
- Never speak as DeAnna. Never make or imply decisions on her behalf.

${division.toUpperCase()} AGENT OUTPUTS:
${content}

Start with ## ${division}, then the agent blocks, nothing else.`;
}

// Returns the YYYY-MM-DD calendar date string in America/Chicago for a given Date.
// Used to compare calendar days in DeAnna's local timezone rather than raw UTC midnight,
// which previously caused late-night UTC writes (e.g. 00:22 UTC) to be miscounted as
// "today" even though they were still "yesterday evening" in Chicago.
function chicagoDateString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

async function runRaymondSynthesis(): Promise<{ cards_created: number; items_synthesized: number }> {
  const items = await getCSQItems('command_approved');
  console.log(`[raymond] Synthesizing ${items.length} command-approved items...`);
  if (items.length === 0) { console.log('[raymond] No items to synthesize today.'); return { cards_created: 0, items_synthesized: 0 }; }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const byDivision: Record<string, CSQItem[]> = {};
  for (const item of items) { if (!byDivision[item.division]) byDivision[item.division] = []; byDivision[item.division].push(item); }

  // Compliance flags: last 24 hours ONLY. The queue was zeroed of six weeks of stale
  // rejected/needs_correction items on July 11, 2026 — this filter prevents re-accumulation.
  const flagsSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [rejectedItems, correctionItems] = await Promise.all([
    getCSQItems('rejected', flagsSince),
    getCSQItems('needs_correction', flagsSince),
  ]);

  // Compressed: one line per agent per division — counts, not essays. Details live in the queue.
  const flagCounts: Record<string, Record<string, number>> = {};
  for (const f of [...rejectedItems, ...correctionItems]) {
    if (!flagCounts[f.division]) flagCounts[f.division] = {};
    flagCounts[f.division][f.agent_name] = (flagCounts[f.division][f.agent_name] ?? 0) + 1;
  }

  const triggeredAt = new Date().toISOString();
  const approvalMap: Record<string, string> = {};
  // Raymond-authored command-layer fields: raymond_notes = strategic note, priya_notes column = his DeAnna flag
  const allSummary = items.map(i => `${i.agent_name} (${i.division}): ${i.raw_output.slice(0, 150)}... Raymond: ${i.raymond_notes ?? ''}${i.priya_notes ? ` | Needs DeAnna: ${i.priya_notes}` : ''}`).join('\n');

  const sbUrl = process.env.VITE_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Daily Briefing — Raymond's voice (deduplicated per Chicago calendar day)
  const dailyBriefingPromise = (async () => {
    if (sbUrl && sbKey) {
      // Look back 30 hours (covers any Chicago/UTC offset) and compare Chicago calendar
      // dates directly, instead of comparing raw UTC timestamps against UTC midnight.
      const lookbackStart = new Date(Date.now() - 30 * 60 * 60 * 1000);
      const chk = await fetch(`${sbUrl}/rest/v1/approvals?category=eq.daily_briefing&created_at=gte.${lookbackStart.toISOString()}&order=created_at.desc`, {
        headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
      });
      if (chk.ok) {
        const ex = await chk.json();
        const todayChicago = chicagoDateString(new Date());
        const alreadyExists = Array.isArray(ex) && ex.some((row: { created_at: string }) => chicagoDateString(new Date(row.created_at)) === todayChicago);
        if (alreadyExists) {
          console.log('[raymond] Daily briefing already exists for today (America/Chicago) — skipping duplicate');
          return;
        }
      }
    }
    await callSonnet(
      `You are Raymond Holloway, sole Chief of Staff for DRU AI Consulting, delivering DeAnna R. Upshaw's daily briefing. Today: ${today}.
HARD RULES:
- You report to DeAnna — you never speak as her, and you NEVER invent decisions, preferences, or commitments on her behalf.
- Anything requiring her call is presented as a QUESTION, never a conclusion.
- Be tight. Every sentence earns its place.

Write the Daily Briefing card with ONLY these three sections:

## Daily Briefing — ${today}

**Executive Summary**
3-4 sentences ("Your team has...") — what was accomplished today across all divisions.

**Decisions Needed**
Bullet list of questions requiring DeAnna's personal call today — lead with any "Needs DeAnna" flags below. If none: "No decisions required today — the team is executing."

**Tomorrow's Priorities**
3-5 specific bullets of what the team is positioned to execute tomorrow.

TODAY'S TEAM WORK:
${allSummary}`,
      1000
    ).then(async synthesis => {
      const id = await writeApproval({
        source: 'twin_synthesis', trigger_type: 'cron_twin_synthesis',
        agent_name: 'Raymond Holloway', agent_role: 'Chief of Staff', division: 'Command',
        task_brief: `Daily Briefing — ${today}`, output: synthesis, status: 'pending',
        notify_deanna: true, priority: items.some(i => i.priority === 'high') ? 'high' : 'normal',
        category: 'daily_briefing', platform: null,
      });
      if (id) { approvalMap['Command'] = id; }
      console.log(`[raymond] Daily Briefing card written — Raymond Holloway`);
    }).catch(err => { console.error('[raymond] Daily Briefing synthesis failed:', err); });
  })();

  // Division cards — every agent's own voice
  const divisionSynthesisPromises = Object.entries(byDivision)
    .filter(([division]) => division !== 'Community Connection')
    .map(async ([division, divItems]) => {
      // Agent outputs only — Raymond's command-layer notes feed the Daily Briefing, not these cards
      const content = divItems.map(i => `**${i.agent_name}** (${i.task.replace(/_/g, ' ')}):\n${i.raw_output}`).join('\n\n---\n\n');
      try {
        const divFlagCounts = flagCounts[division] ?? {};
        const flagLines = Object.entries(divFlagCounts).map(([agent, n]) => `- ${agent}: ${n} open compliance correction${n > 1 ? 's' : ''} (Isabella) — details in queue`);
        const flagsSection = flagLines.length > 0 ? `\n\nAfter the agent blocks, append exactly this section verbatim:\n## Compliance Flags (last 24h)\n${flagLines.join('\n')}` : '';
        // Mechanical brevity: token budget scales with agent count instead of a flat ceiling
        const maxTokens = Math.min(1400, 200 + 180 * divItems.length);
        const synthesis = await callSonnet(getDivisionPrompt(division, today, content) + flagsSection, maxTokens);
        const id = await writeApproval({
          source: 'twin_synthesis', trigger_type: 'cron_twin_synthesis',
          agent_name: division, agent_role: 'Division Report', division,
          task_brief: `${division} — ${divItems.length} agent${divItems.length > 1 ? 's' : ''} | ${today}`,
          output: synthesis, status: 'pending', notify_deanna: true,
          priority: divItems.some(i => i.priority === 'high') ? 'high' : 'normal',
          category: getDivisionCategory(division), platform: null,
        });
        if (id) { approvalMap[division] = id; console.log(`[raymond] ${division} card written (agent voices)`); }
      } catch (err) { console.error(`[raymond] ${division} synthesis failed:`, err); }
    });

  await Promise.all([dailyBriefingPromise, ...divisionSynthesisPromises]);

  // GHL notification — one per day
  const hasHighPriority = items.some(i => i.priority === 'high');
  const commandApprovalId = approvalMap['Command'] ?? null;
  if (commandApprovalId) {
    const divisionCount = Object.keys(approvalMap).length;
    const label = hasHighPriority
      ? `🚨 HIGH ALERT — Intelligence Hub ready. ${divisionCount} division cards + 1 Daily Briefing. Action required.`
      : `Intelligence Hub is ready. ${divisionCount} division cards + 1 Daily Briefing waiting for review.`;
    const webhookUrl = process.env.GHL_NOTIFICATION_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'druaiconsulting@gmail.com', phone: '+19796186671',
            first_name: 'DeAnna', last_name: 'Upshaw',
            agent_name: 'Raymond Holloway', division: 'Command', task: 'Daily Briefing',
            approval_id: commandApprovalId, summary: label, triggered_at: triggeredAt,
            review_url: 'https://app.druaiconsulting.com/admin-approvals',
            sms_body: `DRU AI Consulting | ${label}\n\nReview: app.druaiconsulting.com/admin-approvals`,
            email_subject: `DRU AI Consulting — ${hasHighPriority ? '🚨 High Alert — ' : ''}Intelligence Hub Ready`,
            email_body: `${label}\n\nReview and approve:\nhttps://app.druaiconsulting.com/admin-approvals\n\n— DRU AI Leadership Ecosystem™`,
          }),
        });
        console.log(`[raymond] ONE daily notification sent — ${hasHighPriority ? 'HIGH ALERT' : 'standard'}`);
      } catch (error) { console.warn('[raymond] Daily notification failed (non-fatal):', error); }
    }
  }

  // Social media approval cards
  // PHASE 2: Detect Darius multi-platform JSON → populate new columns
  // Backward compat: all other agents continue using single-platform string flow
  for (const item of items) {
    if (SOCIAL_DIVISIONS.includes(item.division) && CLIENT_FACING_CATEGORIES.includes(item.category)) {
      try {
        const multiPlatform = tryParseMultiPlatform(item.raw_output);

        if (multiPlatform) {
          // Multi-platform card — Darius Phase 2 structured output
          await writeApproval({
            source: `${item.agent_id}_social`, trigger_type: item.category,
            agent_name: item.agent_name, agent_role: item.division, division: item.division,
            task_brief: `Social — ${item.agent_name} | ${today}`,
            output: multiPlatform.linkedin_content,
            linkedin_content: multiPlatform.linkedin_content,
            facebook_content: multiPlatform.facebook_content,
            instagram_caption: multiPlatform.instagram_caption,
            ...(multiPlatform.spanish_content ? { spanish_content: multiPlatform.spanish_content } : {}),
            status: 'pending', notify_deanna: false,
            priority: 'normal', category: 'social', platform: 'LinkedIn',
          });
          console.log(`[raymond] Multi-platform social card: ${item.agent_name} (LinkedIn + Facebook + Instagram${multiPlatform.spanish_content ? ' + Spanish' : ''})`);
        } else {
          // Single-platform card — existing behavior for all other agents
          let postContent = item.raw_output;
          const complianceCutoffs = ['## COMPLIANCE AUDIT', 'COMPLIANCE AUDIT', '## Isabella', 'CORRECTION REQUIRED'];
          for (const cutoff of complianceCutoffs) { const idx = postContent.indexOf(cutoff); if (idx !== -1) postContent = postContent.slice(0, idx).trim(); }
          postContent = postContent.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
          postContent = postContent.split(/\n{2,}/).map((p: string) => p.replace(/\n/g, ' ').trim()).filter((p: string) => p.length > 0).join('\n\n');
          const platformLabel = getPlatformLabel(item.category);
          await writeApproval({
            source: `${item.agent_id}_social`, trigger_type: item.category,
            agent_name: item.agent_name, agent_role: item.division, division: item.division,
            task_brief: `${platformLabel} — ${item.agent_name} | ${today}`,
            output: postContent, status: 'pending', notify_deanna: false,
            priority: 'normal', category: 'social', platform: platformLabel,
          });
          console.log(`[raymond] Social card: ${item.agent_name} → ${platformLabel}`);
        }
      } catch (err) { console.error(`[raymond] Social card failed for ${item.agent_name}:`, err); }
    }
  }

  // CONTENT_ALWAYS_SURFACE: Force standalone cards for key content agents
  // Skips agents already handled by social card flow to avoid duplicates
  // Chloe and Kwame get their own Copy/Proposal folders — same platform-tag mechanism
  // as Ravi's Designs folder — since their work is reusable deliverable content, not a report.
  for (const item of items) {
    const isAlreadySocial = SOCIAL_DIVISIONS.includes(item.division) && CLIENT_FACING_CATEGORIES.includes(item.category);
    if (isAlreadySocial) continue;
    const shouldSurface = CONTENT_ALWAYS_SURFACE.some(name =>
      item.agent_name.toLowerCase().includes(name.toLowerCase())
    );
    if (shouldSurface) {
      try {
        const isChloe = item.agent_name.toLowerCase().includes('chloe');
        const isKwame = item.agent_name.toLowerCase().includes('kwame');
        await writeApproval({
          source: `${item.agent_id}_content`,
          trigger_type: item.category,
          agent_name: item.agent_name,
          agent_role: item.division,
          division: item.division,
          task_brief: `${item.task.replace(/_/g, ' ')} — ${item.agent_name} | ${today}`,
          output: item.raw_output,
          status: 'pending',
          notify_deanna: false,
          priority: item.priority === 'high' ? 'high' : 'normal',
          category: (isChloe || isKwame) ? 'social' : 'content_review',
          platform: isChloe ? 'Copy' : isKwame ? 'Proposal' : null,
        });
        console.log(`[raymond] ${(isChloe || isKwame) ? 'Folder' : 'CONTENT_ALWAYS_SURFACE'} standalone card: ${item.agent_name}`);
      } catch (err) {
        console.error(`[raymond] Standalone card failed for ${item.agent_name}:`, err);
      }
    }
  }

  // Grants: Adaeze's findings always get their own standalone "Grants" card,
  // untouched by division roll-up rewriting — she reports facts, not commentary.
  for (const item of items) {
    if (item.category === 'grants') {
      try {
        await writeApproval({
          source: `${item.agent_id}_grants`,
          trigger_type: item.category,
          agent_name: item.agent_name,
          agent_role: item.division,
          division: item.division,
          task_brief: `${item.task.replace(/_/g, ' ')} — ${item.agent_name} | ${today}`,
          output: item.raw_output,
          status: 'pending',
          notify_deanna: false,
          priority: item.priority === 'high' ? 'high' : 'normal',
          category: 'grants',
          platform: null,
        });
        console.log(`[raymond] Grants standalone card: ${item.agent_name}`);
      } catch (err) {
        console.error(`[raymond] Grants card failed for ${item.agent_name}:`, err);
      }
    }
  }

  // Mark all items twin_processed (status/column names unchanged — schema untouched)
  for (const item of items) {
    const divisionApprovalId = approvalMap[item.division] ?? null;
    await updateCSQ(item.id, {
      twin_processed: true,
      twin_synthesis: `Division card: ${item.division}`,
      approval_id: divisionApprovalId,
      twin_processed_at: new Date().toISOString(),
      status: 'twin_processed',
    });
  }

  const cardsCreated = Object.keys(approvalMap).length;
  console.log(`[raymond] Synthesis complete — ${cardsCreated + 1} division cards written`);
  return { cards_created: cardsCreated + 1, items_synthesized: items.length };
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
  console.log('[raymond] Daily synthesis triggered — Raymond Holloway, Chief of Staff');
  const result = await runRaymondSynthesis();
  res.status(202).json({ success: true, ...result });
}
