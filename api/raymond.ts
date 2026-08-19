// api/raymond.ts
// Daily Synthesis — Raymond Holloway, Master Orchestrator and Chief of Staff
// Runs daily at 19:00 UTC via pg_cron job dru-raymond-synthesis-daily (formerly dru-twin-synthesis-daily → cmd-twin.ts)
// Picks up pipeline_approved items, produces division cards + the Daily Briefing
// Fires ONE GHL notification to DeAnna when complete
//
// VOICE RULES (July 2026 rewiring):
//   - Daily Briefing = Raymond's voice, reporting to DeAnna. Informational only — Executive Summary +
//     Tomorrow's Priorities. No decisions, no questions, no asks of any kind.
//     Raymond NEVER invents decisions, preferences, or commitments on DeAnna's behalf.
//   - Division cards = the agents' own actual work, lightly formatted by Raymond.
//     Raymond removes metadata preambles but NEVER summarizes, compresses, or rewrites deliverables.
//     No "Done:" prefix. The work speaks for itself.
//   - "Needs Attention" section: last 24 hours ONLY (date-filtered). One brief line per agent
//     showing the actual reason — so DeAnna can see who needs support without opening the queue.
//     Flagged agents also get a ⚠️ inline on their card block. (Previously: verbose counts, stale flags.)
//
// PHASE 2: Detects Darius multi-platform JSON → populates linkedin_content, facebook_content, instagram_caption
// The AI Twin no longer runs daily synthesis — she is the face of all video content and retains on-demand chat (twin.ts).

import type { VercelRequest, VercelResponse } from "@vercel/node";
export const config = { maxDuration: 300 };

const SOCIAL_DIVISIONS = ['Content & Brand', 'Marketing'];
const CLIENT_FACING_CATEGORIES = ['linkedin_post','instagram_post','facebook_post','twitter_post','tiktok_post','youtube_post','social_post','email_marketing','outreach','copywriting','press_release','localization','design_brief','content_creation','community_insight','community_lesson','community_challenge','community_edge','community_training','community_engagement','linkedin_article','newsletter_nonmember','newsletter_freetier','newsletter_navigator','newsletter_accelerator'];

// Internal-reasoning marker — must match the exact instruction given to Nia in
// ghl-agent-trigger.ts (INTERNAL_NOTES_INSTRUCTION). Everything before this marker is
// sendable content; everything after is split off into original_content and shown on the
// card as "Internal Notes — Not Sent" (see AdminApprovals.tsx getOriginalColumn). Never sent.
const INTERNAL_NOTES_MARKER = '===INTERNAL NOTES===';

// Agents that always get their own standalone Intelligence Hub card
// regardless of division — never buried in division synthesis
const CONTENT_ALWAYS_SURFACE = ['Nia Robinson', 'Jaylen Brooks', 'Chloe', 'Kwame', 'Theo Nguyen', 'Jordan Hayes', 'Simone Laurent', 'Amelia Santos', 'Camila Flores', 'Zara Ahmed'];

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
    linkedin_article: 'LinkedIn', newsletter_nonmember: 'Email', newsletter_freetier: 'Email', newsletter_navigator: 'Email', newsletter_accelerator: 'Email',
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

// ─── Division card prompt: light formatting only, never summarize ───────────
// Raymond's job here is to make the work readable, not to describe it.
// The actual deliverable must survive intact — protocols, posts, tables, plans, all of it.
// Cleans one agent's raw output for direct display on a card — NO LLM rewrite, so the
// real content is never paraphrased or compressed away. Only two jobs:
//   1. Strip markdown formatting artifacts (**, *, # headers) so it reads as plain English,
//      not "code."
//   2. Guarantee paragraph spacing. If the agent already wrote real paragraph breaks, that
//      structure is kept as-is. If they wrote one dense block with no breaks at all, force it
//      into 2-3 sentence paragraphs so it's never a wall of text.
function cleanForCard(rawText: string): string {
  let out = rawText;
  const cutoffs = ['## COMPLIANCE AUDIT', 'COMPLIANCE AUDIT', '## Isabella', 'CORRECTION REQUIRED'];
  for (const cutoff of cutoffs) { const idx = out.indexOf(cutoff); if (idx !== -1) out = out.slice(0, idx).trim(); }
  out = out.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
  out = out.replace(/^#{1,6}\s*/gm, '').trim();

  if (/\n\s*\n/.test(out)) {
    // Already has real paragraph breaks — keep that structure. Don't flatten lines that
    // look like a bullet or numbered list — only run-on prose gets its internal breaks joined.
    return out.split(/\n{2,}/).map(p => {
      const looksLikeList = /^\s*([-•*]|\d+[.)])\s+/m.test(p);
      return looksLikeList ? p.trim() : p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    }).filter(p => p.length > 0).join('\n\n');
  }

  // One dense block, no breaks at all — force it into 2-3 sentence paragraphs.
  // The boundary allows an optional closing quote/paren after the period, so a sentence
  // that ends inside quotes (e.g. "...here.") isn't skipped or merged into the next one.
  const sentences = (out.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+[)"'\u201d\u2019]*(?=\s|$)/g) || [out]).map(s => s.trim());
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) {
    paragraphs.push(sentences.slice(i, i + 3).join(' ').trim());
  }
  return paragraphs.filter(p => p.length > 0).join('\n\n');
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
  const items = await getCSQItems('pipeline_approved');
  console.log(`[raymond] Synthesizing ${items.length} pipeline-approved items...`);
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

  // One entry per agent per division — store a brief reason (first sentence of correction_notes)
  // so DeAnna can see what happened at a glance without opening the queue.
  const flagData: Record<string, Record<string, { count: number; reason: string }>> = {};
  for (const f of [...rejectedItems, ...correctionItems]) {
    if (!flagData[f.division]) flagData[f.division] = {};
    if (!flagData[f.division][f.agent_name]) {
      // Take the first sentence of correction_notes as the brief reason
      const full = (f.correction_notes ?? f.isabella_flags ?? '').trim();
      const brief = full.split(/\.\s+/)[0].replace(/\n/g, ' ').slice(0, 120);
      flagData[f.division][f.agent_name] = { count: 1, reason: brief || 'flagged by Isabella' };
    } else {
      flagData[f.division][f.agent_name].count++;
    }
  }

  const triggeredAt = new Date().toISOString();
  const approvalMap: Record<string, string> = {};
  let dailyBriefingApprovalId: string | null = null;
  // Raymond-authored pipeline-review fields: raymond_notes = strategic note, priya_notes column = his DeAnna flag
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
      `You are Raymond Holloway, Master Orchestrator and Chief of Staff for DRU AI Consulting, delivering DeAnna R. Upshaw's daily briefing. Today: ${today}.
HARD RULES:
- You report to DeAnna — you never speak as her, and you NEVER invent decisions, preferences, or commitments on her behalf.
- This is an informational overview ONLY. Do NOT ask DeAnna for decisions, approvals, or actions of any kind. Do NOT include a "Decisions Needed" section. Do NOT phrase anything as a question directed at her.
- Be tight. Every sentence earns its place.

Write the Daily Briefing card with ONLY these two sections:

## Daily Briefing — ${today}

**Executive Summary**
3-4 sentences ("Your team has...") — what was accomplished today across all divisions.

**Tomorrow's Priorities**
3-5 specific bullets of what the team is positioned to execute tomorrow.

TODAY'S TEAM WORK:
${allSummary}`,
      1000
    ).then(async synthesis => {
      const id = await writeApproval({
        source: 'raymond_synthesis', trigger_type: 'cron_raymond_synthesis',
        agent_name: 'Raymond Holloway', agent_role: 'Master Orchestrator and Chief of Staff',
        task_brief: `Daily Briefing — ${today}`, output: synthesis, status: 'pending',
        notify_deanna: true, priority: items.some(i => i.priority === 'critical') ? 'high' : 'normal',
        category: 'daily_briefing', platform: null,
      });
      if (id) { dailyBriefingApprovalId = id; }
      console.log(`[raymond] Daily Briefing card written — Raymond Holloway`);
    }).catch(err => { console.error('[raymond] Daily Briefing synthesis failed:', err); });
  })();

  // Division cards — each agent's actual work, lightly formatted
  const divisionSynthesisPromises = Object.entries(byDivision)
    .filter(([division]) => division !== 'Community Connection' && division !== 'Content & Brand')
    .map(async ([division, divItems]) => {
      // Agent outputs only — Raymond's pipeline-review notes feed the Daily Briefing, not these cards
      // Exclude grants items — Adaeze gets her own standalone Grants card, so she must not
      // also appear inside the RGS division roll-up. Same principle as Community Connection
      // being excluded from division synthesis entirely.
      const cardItems = divItems.filter(i =>
        i.category !== 'grants' &&
        !(SOCIAL_DIVISIONS.includes(division) && CLIENT_FACING_CATEGORIES.includes(i.category))
      );
      if (cardItems.length === 0) return; // whole division was grants-only — no card needed
      try {
        const divFlagData = flagData[division] ?? {};
        const flaggedAgentNames = new Set(Object.keys(divFlagData));
        // One brief line per flagged agent — reason only, no counts, no essays.
        // Purpose: DeAnna sees who needs support at a glance, not a compliance report.
        const flagLines = Object.entries(divFlagData).map(([agent, { reason }]) => `- ${agent} — ${reason}`);

        // No LLM rewrite — each agent's real output, cleaned, under their own plain-text name.
        // Flagged agents get a ⚠️ right on their name so it's visible in context, not just at the bottom.
        const agentBlocks = cardItems.map(i => {
          const nameLine = flaggedAgentNames.has(i.agent_name) ? `${i.agent_name} ⚠️` : i.agent_name;
          return `${nameLine}\n\n${cleanForCard(i.raw_output)}`;
        }).join('\n\n---\n\n');

        const needsAttentionSection = flagLines.length > 0
          ? `\n\n---\n\nNeeds Attention\n${flagLines.join('\n')}`
          : '';

        const divisionHeader = division === 'Client Delivery' ? 'Client Delivery — Daily Update' : division;
        const synthesis = `${divisionHeader}\n\n${agentBlocks}${needsAttentionSection}`;
        const id = await writeApproval({
          source: 'raymond_synthesis', trigger_type: 'cron_raymond_synthesis',
          agent_name: division, agent_role: 'Division Report', division,
          task_brief: division === 'Client Delivery' ? `Client Delivery — Daily Update | ${today}` : `${division} — ${divItems.length} agent${divItems.length > 1 ? 's' : ''} | ${today}`,
          output: synthesis, status: 'pending', notify_deanna: true,
          priority: divItems.some(i => i.priority === 'critical') ? 'high' : 'normal',
          category: getDivisionCategory(division), platform: null,
        });
        if (id) { approvalMap[division] = id; console.log(`[raymond] ${division} card written (agent work, light formatting)`); }
      } catch (err) { console.error(`[raymond] ${division} synthesis failed:`, err); }
    });

  await Promise.all([dailyBriefingPromise, ...divisionSynthesisPromises]);

  // GHL notification — one per day
  // Only HIGH ALERT for genuinely critical items — not routine high-priority work.
  // Agents self-flag most work as 'high' daily, which previously triggered HIGH ALERT every run
  // and blocked DeAnna's standard SMS notification. 'critical' is reserved for true blockers.
  const hasHighPriority = items.some(i => i.priority === 'critical');
  if (dailyBriefingApprovalId) {
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
            agent_name: 'Raymond Holloway', task: 'Daily Briefing',
            approval_id: dailyBriefingApprovalId, summary: label, triggered_at: triggeredAt,
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
          let rawContent = item.raw_output;

          // Split off internal reasoning (Nia's cards specifically, Aug 2026 fix) before any
          // other cleanup runs — it must never be visible to the cleanup logic that produces
          // sendable `output`, and never leak into what actually gets sent/posted.
          let internalNotes = '';
          const notesIdx = rawContent.indexOf(INTERNAL_NOTES_MARKER);
          if (notesIdx !== -1) {
            internalNotes = rawContent.slice(notesIdx + INTERNAL_NOTES_MARKER.length).trim();
            rawContent = rawContent.slice(0, notesIdx).trim();
          }

          let postContent = rawContent;
          const complianceCutoffs = ['## COMPLIANCE AUDIT', 'COMPLIANCE AUDIT', '## Isabella', 'CORRECTION REQUIRED'];
          for (const cutoff of complianceCutoffs) { const idx = postContent.indexOf(cutoff); if (idx !== -1) postContent = postContent.slice(0, idx).trim(); }
          postContent = postContent.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
          postContent = postContent.split(/\n{2,}/).map((p: string) => p.replace(/\n/g, ' ').trim()).filter((p: string) => p.length > 0).join('\n\n');
          const platformLabel = getPlatformLabel(item.category);
          await writeApproval({
            source: `${item.agent_id}_social`, trigger_type: item.category,
            agent_name: item.agent_name, agent_role: item.division, division: item.division,
            task_brief: `${platformLabel} — ${item.agent_name} | ${today}`,
            output: postContent, original_content: internalNotes || null,
            status: 'pending', notify_deanna: false,
            priority: 'normal', category: 'social', platform: platformLabel,
          });
          console.log(`[raymond] Social card: ${item.agent_name} → ${platformLabel}${internalNotes ? ' (internal notes split off)' : ''}`);
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
        const isChloe  = item.agent_name.toLowerCase().includes('chloe');
        const isKwame  = item.agent_name.toLowerCase().includes('kwame');
        const isCamila = item.agent_name.toLowerCase().includes('camila');
        const isJaylen = item.agent_name.toLowerCase().includes('jaylen');

        // Jaylen's content needs the same treatment Nia's gets in the SOCIAL_DIVISIONS path
        // above (markdown cleanup + internal-notes split) — he doesn't go through that path
        // since his division isn't in SOCIAL_DIVISIONS, so it's applied here instead.
        let jaylenOutput = item.raw_output;
        let jaylenInternalNotes = '';
        if (isJaylen) {
          const notesIdx = jaylenOutput.indexOf(INTERNAL_NOTES_MARKER);
          if (notesIdx !== -1) {
            jaylenInternalNotes = jaylenOutput.slice(notesIdx + INTERNAL_NOTES_MARKER.length).trim();
            jaylenOutput = jaylenOutput.slice(0, notesIdx).trim();
          }
          jaylenOutput = jaylenOutput.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
          jaylenOutput = jaylenOutput.split(/\n{2,}/).map((p: string) => p.replace(/\n/g, ' ').trim()).filter((p: string) => p.length > 0).join('\n\n');
        }

        await writeApproval({
          source: `${item.agent_id}_content`,
          trigger_type: item.category,
          agent_name: item.agent_name,
          agent_role: item.division,
          division: item.division,
          task_brief: isCamila
            ? `Weekly LinkedIn Queue — ${item.agent_name} | ${today}`
            : `${item.task.replace(/_/g, ' ')} — ${item.agent_name} | ${today}`,
          output: isJaylen ? jaylenOutput : item.raw_output,
          original_content: isJaylen ? (jaylenInternalNotes || null) : undefined,
          status: 'pending',
          notify_deanna: false,
          priority: item.priority === 'high' ? 'high' : 'normal',
          category: (isChloe || isKwame || isJaylen) ? 'social' : 'content_review',
          platform: isChloe ? 'Copy' : isKwame ? 'Proposal' : isCamila ? 'LinkedIn Queue' : isJaylen ? 'Email' : null,
        });
        console.log(`[raymond] ${(isChloe || isKwame || isJaylen) ? 'Folder' : 'CONTENT_ALWAYS_SURFACE'} standalone card: ${item.agent_name}`);
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

  // Mark all items raymond_processed
  for (const item of items) {
    const divisionApprovalId = approvalMap[item.division] ?? null;
    await updateCSQ(item.id, {
      raymond_processed: true,
      raymond_synthesis: `Division card: ${item.division}`,
      approval_id: divisionApprovalId,
      raymond_processed_at: new Date().toISOString(),
      status: 'raymond_processed',
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

