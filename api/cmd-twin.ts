// api/cmd-twin.ts
// AI Twin Synthesis — runs daily at 18:40 UTC via dru-twin-synthesis-daily
// Picks up command_approved items, synthesizes division cards + daily briefing
// Fires ONE GHL notification to DeAnna when complete

import type { VercelRequest, VercelResponse } from "@vercel/node";
export const config = { maxDuration: 300 };

const GENIUS_MODE = `You operate in Genius Mode — think and respond at the level of a top 0.1% expert in your field. Apply deep logic, strategic frameworks, creative synthesis, and second-order thinking to every output. Never produce generic or surface-level work. Every sentence must earn its place.`;

const SOCIAL_DIVISIONS = ['Content & Brand', 'Marketing'];
const CLIENT_FACING_CATEGORIES = ['linkedin_post','instagram_post','facebook_post','twitter_post','tiktok_post','youtube_post','social_post','email_marketing','outreach','copywriting','press_release','localization','design_brief','content_creation','community_insight','community_lesson','community_challenge','community_edge','community_training','community_engagement'];

interface CSQItem {
  id: string; agent_id: string; agent_name: string; division: string;
  task: string; category: string; raw_output: string; priority: string;
  retry_count?: number; raymond_notes?: string; travis_notes?: string;
  priya_notes?: string; isabella_flags?: string; correction_notes?: string;
}

async function callTwin(prompt: string, maxTokens = 2000): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Twin error ${res.status}`);
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
  };
  return map[category] ?? 'Social';
}

function getDivisionPrompt(division: string, today: string, content: string): string {
  const instructions: Record<string, string> = {
    'Revenue, Growth & Sales': `Synthesize the Revenue, Growth & Sales division's work for today. Cover: lead intelligence (Omar/Ryan), sales support (Mateo), coaching insight (Serena), outreach created (Aaliyah), email campaign (Jaylen), copy asset (Chloe), launch readiness (Zara), product knowledge (Elena), proposal work (Kwame). 250-350 words. First person. Flag any high-intent leads or urgent pipeline actions.`,
    'Content & Brand': `Synthesize the Content & Brand division's work. Cover: content queue strategy (Camila), design brief (Ravi), press release activity (Ingrid), localization work (Yara). Note: Darius King's post is in the Social Media card. 200-300 words. First person.`,
    'Marketing': `Synthesize the Marketing division's strategic work. Cover: digital campaign status (Luca), analytics and funnel insights (Hyun-Ji), SEO/SEM priorities (Andre). Note: Nia's published content is in the Social Media card. 200-300 words. First person.`,
    'Legal & Finance': `Synthesize the Legal & Finance division's weekly work. Cover: legal briefing highlights (Amara), expense health (Diego), financial projections (Yuki), business financial planning intelligence (Marcus). 200-300 words. First person. Flag anything requiring DeAnna's signature or financial decision.`,
    'AI Governance': `Synthesize the AI Governance division's daily work. Cover: disclaimer status (Khalid), privacy compliance (Sofia), contract readiness (James), brand protection (Mei Lin), AI landscape intelligence (Rafael). 200-300 words. First person. Flag any compliance risks or urgent governance actions.`,
    'HR': `Synthesize the HR division's daily work. Cover: recruiting pipeline (Naomi), onboarding readiness (Aiden), internal operations health (Fatima). 150-250 words. First person. Flag any staffing decisions or internal issues needing DeAnna's attention.`,
    'Client Delivery': `Synthesize the Client Delivery division's work. Cover: client onboarding (Keisha), community engagement (Marco), feedback insights (Leila), creative production — Jordan orchestrating Simone/Theo/Amelia. 200-300 words. First person.`,
    'Customer Support': `Synthesize the Customer Support division's work. Cover: support ticket status (Isaiah), multi-channel communication health (Priscilla). 150-250 words. First person. Flag any unresolved escalations.`,
    'Community Connection': `Synthesize the Community Connection division's work. Cover: DRU CLEAR™ insights (Dominique/Elijah), 5D Leadership™ content (Solange/Isaiah Webb), 5C Cultural DNA™ posts (Nadia/Victor), AI Sales Mastery™ (Sasha/Tariq), community facilitation and upsell signals (Zoe/Micah). 200-300 words. First person.`,
  };
  const instruction = instructions[division] ?? `Synthesize this division's work. 200-300 words. First person.`;
  return `You are DeAnna R. Upshaw's AI Twin synthesizing the ${division} division's work. Today: ${today}.
BRAND: "AI Mastery. Leadership Clarity. Measurable Results."
FRAMEWORKS (always ™): DRU CLEAR™ | DRU AI Leadership Ecosystem™ | DRU AI Transformation Pathway™ | 5C Cultural DNA™ | 5D Leadership™ | AI Sales Mastery™ | From Confusion to Confident with AI™
${division.toUpperCase()} DIVISION OUTPUTS:
${content}
${instruction}
Write as DeAnna speaking to herself. Start with ## ${division}.`;
}

async function runTwinSynthesis(): Promise<{ cards_created: number; items_synthesized: number }> {
  const items = await getCSQItems('command_approved');
  console.log(`[twin] Synthesizing ${items.length} command-approved items...`);
  if (items.length === 0) { console.log('[twin] No items to synthesize today.'); return { cards_created: 0, items_synthesized: 0 }; }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const byDivision: Record<string, CSQItem[]> = {};
  for (const item of items) { if (!byDivision[item.division]) byDivision[item.division] = []; byDivision[item.division].push(item); }

  const [rejectedItems, correctionItems] = await Promise.all([getCSQItems('rejected'), getCSQItems('needs_correction')]);
  const flagsByDivision: Record<string, string[]> = {};
  for (const r of rejectedItems) {
    if (!flagsByDivision[r.division]) flagsByDivision[r.division] = [];
    flagsByDivision[r.division].push(`${r.agent_name} — REJECTED after max retries: ${r.isabella_flags ?? r.correction_notes ?? 'compliance issue'}`);
  }
  for (const c of correctionItems) {
    if (!flagsByDivision[c.division]) flagsByDivision[c.division] = [];
    flagsByDivision[c.division].push(`${c.agent_name} — CORRECTION PENDING: ${c.correction_notes ?? c.isabella_flags ?? 'compliance review'}`);
  }

  const triggeredAt = new Date().toISOString();
  const approvalMap: Record<string, string> = {};
  const allSummary = items.map(i => `${i.agent_name} (${i.division}): ${i.raw_output.slice(0, 150)}... Raymond: ${i.raymond_notes ?? ''} | Priya: ${i.priya_notes ?? ''}`).join('\n');

  const sbUrl = process.env.VITE_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Daily Briefing (deduplicated)
  const dailyBriefingPromise = (async () => {
    if (sbUrl && sbKey) {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const chk = await fetch(`${sbUrl}/rest/v1/approvals?category=eq.daily_briefing&created_at=gte.${todayStart.toISOString()}&limit=1`, {
        headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
      });
      if (chk.ok) { const ex = await chk.json(); if (Array.isArray(ex) && ex.length > 0) { console.log('[twin] Daily briefing already exists for today — skipping duplicate'); return; } }
    }
    await callTwin(
      `You are DeAnna R. Upshaw's AI Twin. Today: ${today}.\nWrite the Daily Briefing card with ONLY these three sections:\n\n## Daily Briefing — ${today}\n\n**Executive Summary**\n3-4 sentences ("My team has...") — what was accomplished today across all divisions.\n\n**Decisions Needed**\nBullet list of anything requiring DeAnna's personal action today. If none: "No decisions required today — team is executing."\n\n**Tomorrow's Priorities**\n3-5 specific bullets of what the team is positioned to execute tomorrow.\n\nTODAY'S TEAM WORK:\n${allSummary}`,
      1200
    ).then(async synthesis => {
      const id = await writeApproval({
        source: 'twin_synthesis', trigger_type: 'cron_twin_synthesis',
        agent_name: "DeAnna's AI Twin", agent_role: 'Master Orchestrator', division: 'Command',
        task_brief: `Daily Briefing — ${today}`, output: synthesis, status: 'pending',
        notify_deanna: true, priority: items.some(i => i.priority === 'high') ? 'high' : 'normal',
        category: 'daily_briefing', platform: null,
      });
      if (id) { approvalMap['Command'] = id; }
      console.log(`[twin] Daily Briefing card written`);
    }).catch(err => { console.error('[twin] Daily Briefing synthesis failed:', err); });
  })();

  // Division cards
  const divisionSynthesisPromises = Object.entries(byDivision)
    .filter(([division]) => division !== 'Community Connection')
    .map(async ([division, divItems]) => {
      const content = divItems.map(i => `**${i.agent_name}** (${i.task.replace(/_/g, ' ')}):\n${i.raw_output}\nRaymond: ${i.raymond_notes ?? ''} | Travis: ${i.travis_notes ?? ''} | Priya: ${i.priya_notes ?? ''}`).join('\n\n---\n\n');
      try {
        const divFlags = flagsByDivision[division] ?? [];
        const flagsSection = divFlags.length > 0 ? `\n\nCOMPLIANCE FLAGS — include at end of card as "## Compliance Flags" section:\n${divFlags.map(f => `- ${f}`).join('\n')}` : '';
        const synthesis = await callTwin(getDivisionPrompt(division, today, content) + flagsSection, 1500);
        const id = await writeApproval({
          source: 'twin_synthesis', trigger_type: 'cron_twin_synthesis',
          agent_name: "DeAnna's AI Twin", agent_role: 'Master Orchestrator', division,
          task_brief: `${division} — ${divItems.length} agent${divItems.length > 1 ? 's' : ''} | ${today}`,
          output: synthesis, status: 'pending', notify_deanna: true,
          priority: divItems.some(i => i.priority === 'high') ? 'high' : 'normal',
          category: getDivisionCategory(division), platform: null,
        });
        if (id) { approvalMap[division] = id; console.log(`[twin] ${division} card written`); }
      } catch (err) { console.error(`[twin] ${division} synthesis failed:`, err); }
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
            agent_name: "DeAnna's AI Twin", division: 'Command', task: 'Daily Briefing',
            approval_id: commandApprovalId, summary: label, triggered_at: triggeredAt,
            review_url: 'https://app.druaiconsulting.com/admin-approvals',
            sms_body: `DRU AI Consulting | ${label}\n\nReview: app.druaiconsulting.com/admin-approvals`,
            email_subject: `DRU AI Consulting — ${hasHighPriority ? '🚨 High Alert — ' : ''}Intelligence Hub Ready`,
            email_body: `${label}\n\nReview and approve:\nhttps://app.druaiconsulting.com/admin-approvals\n\n— DRU AI Leadership Ecosystem™`,
          }),
        });
        console.log(`[twin] ONE daily notification sent — ${hasHighPriority ? 'HIGH ALERT' : 'standard'}`);
      } catch (error) { console.warn('[twin] Daily notification failed (non-fatal):', error); }
    }
  }

  // Social media approval cards
  for (const item of items) {
    if (SOCIAL_DIVISIONS.includes(item.division) && CLIENT_FACING_CATEGORIES.includes(item.category)) {
      try {
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
        console.log(`[twin] Social card: ${item.agent_name} → ${platformLabel}`);
      } catch (err) { console.error(`[twin] Social card failed for ${item.agent_name}:`, err); }
    }
  }

  // Mark all items twin_processed
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
  console.log(`[twin] Synthesis complete — ${cardsCreated + 1} division cards written`);
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
  console.log('[cmd-twin] Twin synthesis triggered');
  const result = await runTwinSynthesis();
  res.status(202).json({ success: true, ...result });
}
