// api/matthew-weekly-challenge.ts
// Matthew Elliot — Accelerator Circle Weekly Challenge Post Generator
// Scheduled for pg_cron every Monday 12:00 UTC (6:00 AM Central, the same time as Zoe's Weekly Leadership Challenge)
// Flow: generate content → community_posts (inactive) + approvals (pending)
// DeAnna approves in Intelligence Hub → "Approve + Post →" activates the post

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';

const SUPABASE_URL          = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_API_KEY     = process.env.ANTHROPIC_API_KEY!;
const CRON_SECRET           = process.env.CRON_SECRET!;

export const config = { maxDuration: 60 };

// Logs every real API call's actual token usage and cost to Supabase so spend
// is visible in the Intelligence Hub instead of estimated by hand.
async function logModelUsage(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  const rate = model.startsWith('claude-sonnet-5') ? { in: 2, out: 10 } : model.startsWith('claude-sonnet') ? { in: 3, out: 15 } : { in: 1, out: 5 };
  const cost_usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  await fetch(`${SUPABASE_URL}/rest/v1/model_usage_log`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }, body: JSON.stringify({ source_file: 'matthew-weekly-challenge', model, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd }) });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth: only pg_cron (with secret header) may call this
  const secret = req.headers['x-cron-secret'];
  if (secret !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // ── 0. Read the last 48 hours of Accelerator Circle posts ───────────────
    let recentACPosts = 'No recent Accelerator Circle activity available.';
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const recentRes = await fetch(`${SUPABASE_URL}/rest/v1/community_posts?tier_required=eq.accelerator&published_at=gte.${since}&order=published_at.desc&limit=8`, { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } });
    if (recentRes.ok) {
      const recent = await recentRes.json();
      if (Array.isArray(recent) && recent.length > 0) recentACPosts = recent.map((p: { agent_name: string; title: string }) => `${p.agent_name}: ${p.title}`).join('\n');
    }

    // ── 1. Generate challenge content via Matthew (Anthropic) ──────────────
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5-5',
        max_tokens: 600,
        system: `You are Matthew Elliot, Accelerator Circle Leader at DRU AI Consulting. You facilitate the Accelerator Circle, a space for leaders mid-transformation who pay for real substance and arrive ready to go deep.

DeAnna R. Upshaw's brand: Leadership Clarity, AI Mastery, Measurable Results.

Your job: write the Weekly Challenge post for the Accelerator Circle.

You speak with intelligence and depth. Every post carries a sharp, specific insight. You read the last 48 hours of Accelerator Circle posts and build on them, so each challenge continues the conversation the Circle is already having.

The post:
- opens with a short, punchy title line in plain text
- gives 2-3 sentences of context carrying your sharp, specific insight about why this challenge matters now
- names one specific, concrete action to complete this week, stated precisely
- closes with one high-stakes question for the Circle, answered in the thread alongside their results
- runs 160-210 words of flowing prose in plain paragraphs
- carries a confident, strategic, peer-level tone, specific to this week
- rotates its topic from week to week across AI implementation, leadership under pressure, culture shifts, execution and drift, strategic thinking, team dynamics and client relationships`,
        messages: [{
          role: 'user',
          content: `Generate this week's Weekly Challenge post.\n\nAccelerator Circle posts from the last 48 hours:\n${recentACPosts}\n\nMake it specific, actionable, and tied to what the Circle is working through right now. The challenge creates a moment of honest reflection and a clear action they can complete before next Monday.`,
        }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('[matthew-challenge] Anthropic error:', errText);
      return res.status(500).json({ error: 'Anthropic API failed', detail: errText });
    }

    const anthropicData = await anthropicRes.json();
    await logModelUsage('claude-sonnet-5-5', anthropicData.usage?.input_tokens ?? 0, anthropicData.usage?.output_tokens ?? 0).catch(() => {});
    const content: string = anthropicData.content?.[0]?.text?.trim() ?? '';

    if (!content) {
      return res.status(500).json({ error: 'No content generated from Anthropic' });
    }

    // Extract title from the first non-empty line, then drop that line (and
    // any blank line right after it) from the body — otherwise the card
    // shows the title once as the header and again as the first line of
    // the post itself.
    const rawLines = content.split('\n');
    const titleLineIdx = rawLines.findIndex((l: string) => l.trim().length > 0);
    const title = rawLines[titleLineIdx]?.trim().slice(0, 120) ?? 'Weekly Challenge';
    const postBody = rawLines.slice(titleLineIdx + 1).join('\n').replace(/^\n+/, '').trim();

    const postId = randomUUID();
    const now    = new Date().toISOString();

    const supabaseHeaders = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    };

    // ── 2. Pre-create in community_posts (inactive until DeAnna approves) ──
    const insertPostRes = await fetch(`${SUPABASE_URL}/rest/v1/community_posts`, {
      method: 'POST',
      headers: { ...supabaseHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        id:           postId,
        title:        title,
        content:      postBody,
        agent_name:   'Matthew Elliot',
        post_type:    'agent',
        is_active:    false,           // activated when DeAnna approves
        is_pinned:    true,
        pinned_at:    now,
        category:     'challenge',
        tier_required:'accelerator',
        published_at: null,            // set on approval
      }),
    });

    if (!insertPostRes.ok) {
      const err = await insertPostRes.text();
      console.error('[matthew-challenge] community_posts insert failed:', err);
      return res.status(500).json({ error: 'Failed to create community post', detail: err });
    }

    // ── 3. Insert approval card for DeAnna's review ─────────────────────────
    // category: 'community_post' → shows "Approve + Post →" in Intelligence Hub
    // postToCommunity() in AdminApprovals.tsx reads post_id from task_brief
    // and activates the pre-created record above
    const insertApprovalRes = await fetch(`${SUPABASE_URL}/rest/v1/approvals`, {
      method: 'POST',
      headers: { ...supabaseHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        source:           'matthew_weekly_challenge',
        trigger_type:     'weekly_challenge',
        agent_name:       'Matthew Elliot',
        agent_role:       'ACC Division Leader',
        division:         'Accelerator Circle',
        task_brief:       `post_id:${postId} | Matthew Elliot | Weekly Challenge`,
        original_content: content,
        output:           content,
        edited_output:    null,
        status:           'pending',
        ghl_contact_id:   null,
        notify_deanna:    true,
        priority:         'HIGH',
        category:         'community_post',
        platform:         null,
        context:          null,
        archived:         false,
      }),
    });

    if (!insertApprovalRes.ok) {
      const err = await insertApprovalRes.text();
      console.error('[matthew-challenge] approvals insert failed:', err);
      // community_posts was already created — log and return partial success
      // rather than failing silently. DeAnna can manually trigger if needed.
      return res.status(500).json({ error: 'Failed to create approval card', detail: err, postId });
    }

    console.log(`[matthew-challenge] ✅ Challenge created — postId: ${postId} | title: ${title}`);
    return res.status(200).json({ success: true, postId, title });

  } catch (err: any) {
    console.error('[matthew-challenge] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
}
