// api/zoe-weekly-challenge.ts
// Zoe Beaumont — Weekly Challenge Post Generator
// Called by pg_cron every Monday 12:00 UTC
// Flow: generate content → community_posts (inactive) + approvals (pending)
// DeAnna approves in Intelligence Hub → "Approve + Post →" activates the post

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';

const SUPABASE_URL          = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_API_KEY     = process.env.ANTHROPIC_API_KEY!;
const GHL_WEBHOOK_SECRET    = process.env.GHL_WEBHOOK_SECRET!;

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth: only pg_cron (with secret header) may call this
  const secret = req.headers['x-cron-secret'];
  if (secret !== GHL_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // ── 1. Generate challenge content via Zoe (Anthropic) ──────────────────
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: `You are Zoe Beaumont, Community Connection Division Leader at DRU AI Consulting. You facilitate the DRU AI Leadership Ecosystem™ community — a space for leaders navigating the AI era with clarity, confidence, and measurable results.

DeAnna R. Upshaw's brand: AI Mastery, Leadership Clarity, Measurable Results.

Her proprietary frameworks (always include ™):
- DRU CLEAR™ — AI readiness assessment
- DRU AI Transformation Pathway™ — Discover → Diagnose → Design → Deploy → Dominate
- 5D Leadership™ — leadership development framework
- 5C Cultural DNA™ — culture alignment framework
- AI Sales Mastery™ — AI-powered sales framework
- Clarity Points™ — community engagement system

Your job: Write ONE Weekly Leadership Challenge post for the community. 

Rules:
- Start with a short, punchy title line (no markdown symbols — plain text)
- 2–3 sentences of context that frame WHY this challenge matters now
- 1 specific, concrete challenge action (what to DO this week — be precise, not vague)
- Close with a warm invitation to share results in the community
- Total length: 160–210 words
- Tone: warm, strategic, encouraging — never generic
- Reference at least one DRU framework with ™
- No hashtags. No bullet points. Flowing prose only.
- Vary the topic each time: rotate between AI tool adoption, leadership behaviors, culture shifts, communication, strategic thinking, team dynamics, personal productivity, client relationships`,
        messages: [{
          role: 'user',
          content: `Generate this week's Weekly Leadership Challenge post. Make it specific, actionable, and tied to something leaders are actually wrestling with right now in the AI era. The challenge should create a moment of honest reflection AND a clear action they can complete before next Monday.`,
        }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('[zoe-challenge] Anthropic error:', errText);
      return res.status(500).json({ error: 'Anthropic API failed', detail: errText });
    }

    const anthropicData = await anthropicRes.json();
    const content: string = anthropicData.content?.[0]?.text?.trim() ?? '';

    if (!content) {
      return res.status(500).json({ error: 'No content generated from Anthropic' });
    }

    // Extract title from first non-empty line
    const lines = content.split('\n').map((l: string) => l.trim()).filter(Boolean);
    const title = lines[0]?.slice(0, 120) ?? 'Weekly Leadership Challenge';

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
        content:      content,
        agent_name:   'Zoe Beaumont',
        post_type:    'agent',
        is_active:    false,           // activated when DeAnna approves
        is_pinned:    true,
        pinned_at:    now,
        category:     'challenge',
        tier_required:'navigator',
        published_at: null,            // set on approval
      }),
    });

    if (!insertPostRes.ok) {
      const err = await insertPostRes.text();
      console.error('[zoe-challenge] community_posts insert failed:', err);
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
        source:           'zoe_weekly_challenge',
        trigger_type:     'weekly_challenge',
        agent_name:       'Zoe Beaumont',
        agent_role:       'CC Division Leader',
        division:         'Community Connection',
        task_brief:       `post_id:${postId} | Zoe Beaumont | Weekly Challenge`,
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
      console.error('[zoe-challenge] approvals insert failed:', err);
      // community_posts was already created — log and return partial success
      // rather than failing silently. DeAnna can manually trigger if needed.
      return res.status(500).json({ error: 'Failed to create approval card', detail: err, postId });
    }

    console.log(`[zoe-challenge] ✅ Challenge created — postId: ${postId} | title: ${title}`);
    return res.status(200).json({ success: true, postId, title });

  } catch (err: any) {
    console.error('[zoe-challenge] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
}
