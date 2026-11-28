// DRU AI Leadership Ecosystem — api/ac-agent-trigger.ts
// P10 Accelerator Circle Division — Matthew (Leader) / Petra (Member Experience) / Renata (Strategy) + upsell scan + reply
// DAILY POST SCHEDULE (Central time): Mon Renata · Tue Renata · Wed Matthew's Mastermind + Renata · Thu Renata · Fri Renata · Sat Petra · Sun Petra
// Matthew's Monday Weekly Challenge runs from api/matthew-weekly-challenge.ts
// Daily posts and challenges go to the Approvals page first. Petra's acknowledgment comments post to the member's thread automatically, then Aaliyah's card goes to DeAnna.
// Mirrors api/cc-agent-trigger.ts (Zoe / Micah / Victor)
// post_type is always 'agent' — daily_insight / strategic_edge belong to Daily Connection only
// TIER: accelerator

export const config = { maxDuration: 60 };

import { GENIUS_MODE, VOICE_DNA, getAgentCorrections } from './_lib/agentKnowledge.js';

// Added after VOICE_DNA for Accelerator Circle writing. The anchor-word line in VOICE_DNA belongs to
// DeAnna's marketing copy; community posts and replies carry her voice through sentence craft.
const AC_COMMUNITY_VOICE = `\nCOMMUNITY WRITING: The voice rules above show up in the sentence craft: a short hook, one sentence that unpacks it, plain words and active voice. The subject of every post is today's topic and what members are living, spoken in everyday leadership language. The word Insight appears where it fits naturally.`;

interface ACAgentRoute { agent_id: string; agent_name: string; task: string; pipeline: string; }

const AC_AGENT_ROUTES: Record<string, ACAgentRoute> = {
  cron_ac_community_seed:      { agent_id: 'ac_seed',       agent_name: 'AC Community Seed',  task: 'ac_daily_seed',             pipeline: 'p10_ac_seed' },
  cron_ac_upsell_scan:         { agent_id: 'ac_upsell_scan',agent_name: 'AC Upsell Scanner',  task: 'ac_upsell_scan',            pipeline: 'p10_ac_upsell_scan' },
  ac_agent_reply:              { agent_id: 'ac_agent',      agent_name: 'AC Agent',           task: 'ac_reply',                  pipeline: 'p10_ac_reply' },
};

const TM_PAIRS: [RegExp, string][] = [
  [/DRU CLEAR(?!™)/g, 'DRU CLEAR™'],
];
function enforceTM(content: string): string {
  let corrected = content;
  for (const [pattern, replacement] of TM_PAIRS) { corrected = corrected.replace(pattern, replacement); }
  return corrected;
}

// Accelerator Circle agents (Matthew, Petra, Renata) run on Sonnet — this file serves only Accelerator Circle content.
async function callAnthropic(prompt: string, maxTokens = 1500, model = 'claude-sonnet-5-5'): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const startedAt = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json();
  await logModelUsage(model, data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0, Date.now() - startedAt).catch(() => {});
  return data.content?.[0]?.text ?? '';
}

// Logs every real API call's actual token usage and cost to Supabase so spend
// is visible in the Intelligence Hub instead of estimated by hand.
async function logModelUsage(model: string, inputTokens: number, outputTokens: number, durationMs: number): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const rate = model.startsWith('claude-sonnet-5') ? { in: 2, out: 10 } : model.startsWith('claude-sonnet') ? { in: 3, out: 15 } : { in: 1, out: 5 };
  const cost_usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  await fetch(`${url}/rest/v1/model_usage_log`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ source_file: 'ac-agent-trigger', model, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd, duration_ms: durationMs }) });
}

async function writeToCommunityPosts(record: Record<string, unknown>): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/community_posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=representation' },
    body: JSON.stringify(record),
  });
  if (!res.ok) { console.error(`[community_posts] Write failed: ${await res.text()}`); return null; }
  const data = await res.json(); return data?.[0]?.id ?? null;
}

async function writeToApprovals(record: Record<string, unknown>): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/approvals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=representation' },
    body: JSON.stringify(record),
  });
  if (!res.ok) { console.error(`[approvals] Write failed: ${await res.text()}`); return null; }
  const data = await res.json(); return data?.[0]?.id ?? null;
}

// Auto-posts a warm acknowledgment to the Accelerator Circle thread (no approval needed)
async function postACKnowledgmentComment(postId: string, firstName: string, signalContext: string): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    const agentCorrections = await getAgentCorrections('Petra Vance');
    const prompt = `${GENIUS_MODE}\n\n${VOICE_DNA}${AC_COMMUNITY_VOICE}${agentCorrections}\n\nYou are Petra Vance, Member Experience for the Accelerator Circle at DRU AI Consulting.\nAn Accelerator member named ${firstName} has been engaging in a meaningful way inside the Accelerator Circle.\nContext: "${signalContext}"\n\nWrite a warm, peer-level community reply of 60-80 words. Acknowledge their engagement naturally and let them know someone from the DRU AI Consulting team will reach out directly to explore how to go deeper together. Keep the reply centered on their engagement: warm, peer-level and genuine. Return the reply text alone.`;
    const acknowledgment = enforceTM(await callAnthropic(prompt, 200));
    await fetch(`${url}/rest/v1/community_comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ post_id: postId, member_id: null, agent_name: 'Petra Vance', content: acknowledgment, is_flagged: false, is_active: true }),
    });
    console.log(`[petra] AC acknowledgment posted to post ${postId} for ${firstName}`);
  } catch (err) { console.error('[ac_acknowledgment] Failed:', err); }
}

// ─── Core AC Agent Runner ─────────────────────────────────────────────────────

async function runACAgent(
  agentId: string,
  agentName: string,
  task: string,
  postType: string,
  category: string,
  prompt: string,
): Promise<{ approval_id: string | null; post_id: string | null }> {
  try {
    const agentCorrections = await getAgentCorrections(agentName);
    const raw = await callAnthropic(
      `${GENIUS_MODE}\n\n${VOICE_DNA}${AC_COMMUNITY_VOICE}${agentCorrections}\n\n${prompt}\n\nReturn valid JSON in exactly this shape, with nothing before or after it: {"title":"...","content":"..."}`,
      1500,
    );
    let title = ''; let content = '';
    try {
      const cleaned = raw.replace(/```json\s*|```/g, '').trim();
      const firstBrace = cleaned.indexOf('{'); const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON found');
      const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      title = parsed.title || agentName; content = parsed.content || raw;
    } catch {
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' });
      title = `${agentName} — ${dateStr}`; content = raw;
    }
    title = enforceTM(title); content = enforceTM(content);

    const post_id = await writeToCommunityPosts({
      title, content, post_type: postType,
      tier_required: 'accelerator',
      agent_id: agentId, agent_name: agentName,
      published_at: new Date().toISOString(), is_active: false,
    });

    const approval_id = await writeToApprovals({
      source: `${agentId}_ac`, trigger_type: category,
      agent_name: agentName, agent_role: 'Accelerator Circle',
      division: 'Accelerator Circle',
      task_brief: post_id ? `post_id:${post_id} | ${agentName} | ${task.replace(/_/g, ' ')}` : `${agentName} | ${task.replace(/_/g, ' ')}`,
      original_content: null, output: `${title}\n\n${content}`,
      edited_output: null, status: 'pending', ghl_contact_id: null,
      notify_deanna: false, priority: 'NORMAL',
      category: 'community_post', platform: 'Accelerator Circle',
      context: null, archived: false,
    });

    console.log(`[${agentId}] AC post → approvals: ${approval_id ?? 'failed'} | community_posts: ${post_id ?? 'failed'}`);
    return { approval_id, post_id };
  } catch (error) {
    console.error(`[${agentId}] AC agent error:`, error);
    return { approval_id: null, post_id: null };
  }
}

// ─── Matthew Elliot — AC Leader ──────────────────────────────────────────────

async function runMatthew(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let recentACPosts = 'No recent Accelerator Circle activity available.';
  if (url && key) {
    const since = new Date(); since.setHours(since.getHours() - 48);
    const r = await fetch(
      `${url}/rest/v1/community_posts?tier_required=eq.accelerator&published_at=gte.${since.toISOString()}&order=published_at.desc&limit=8`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (r.ok) {
      const posts = await r.json();
      if (posts.length > 0) recentACPosts = posts.map((p: Record<string, string>) => `${p.agent_name}: ${p.title}`).join('\n');
    }
  }
  return runACAgent(
    'matthew', 'Matthew Elliot', 'ac_community_facilitation', 'agent', 'ac_community_facilitation',
    `You are Matthew Elliot, the Accelerator Circle Leader at DRU AI Consulting. Today: ${today}.
You speak with intelligence and depth in your conversation, and every post carries a sharp, specific insight.
Recent Accelerator Circle activity (last 48 hours):
${recentACPosts}
Write a mastermind conversation starter of 100-150 words. Build on the recent Circle activity so the post continues what members are already discussing. Your voice is a fellow leader sharing something you have observed, questioned or been sitting with at the intersection of AI and organizational transformation, the kind of insight that gets a room leaning in. Close with one high-stakes question for the room. The post is a conversation, and its purpose is the room's reply.`,
  );
}

// ─── Petra Vance — AC Member Experience ──────────────────────────────────────

async function runPetra(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let memberContext = 'No recent Accelerator member data available.';
  if (url && key) {
    const r = await fetch(
      `${url}/rest/v1/profiles?tier=eq.accelerator&order=updated_at.desc&limit=8&select=id,first_name,updated_at`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (r.ok) {
      const members = await r.json();
      if (members.length > 0) memberContext = `Active Accelerator members: ${members.length}. Most recently active: ${members.slice(0, 3).map((m: Record<string, string>) => m.first_name).join(', ')}.`;
    }
  }
  return runACAgent(
    'petra', 'Petra Vance', 'ac_member_experience', 'agent', 'ac_member_experience',
    `You are Petra Vance, Member Experience for the Accelerator Circle at DRU AI Consulting. Today: ${today}.
You speak with intelligence and depth in your conversation, and every post carries a sharp, specific insight.
Member context: ${memberContext}
Write a thought-provoking weekend post of 100-150 words, built around a question. Your voice is warm and honest at depth: you are a peer who names what is actually happening in the room, celebrating a real win or opening up a genuine implementation challenge, like a message to a trusted peer group in the same territory. Invite others to share where they are. Close with one high-stakes question that makes people think. The post is a conversation, and its purpose is the room's reply.`,
  );
}

// ─── Renata Cruz — AC Strategy Agent ─────────────────────────────────────────

async function runRenata(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });

  const lenses: Record<string, string> = {
    Monday:    'AI Implementation friction',
    Tuesday:   'Leadership culture under AI pressure',
    Wednesday: 'Execution gap and organizational drift',
    Thursday:  'Leader identity in the AI era',
    Friday:    'Where strategy and culture collide',
  };
  const todayLens = lenses[dayOfWeek] ?? lenses['Monday'];

  return runACAgent(
    'renata', 'Renata Cruz', 'ac_strategy_insight', 'agent', 'ac_strategy_insight',
    `You are Renata Cruz, a strategy and culture thinker in the Accelerator Circle at DRU AI Consulting. Today: ${today}.
You speak with intelligence and depth in your conversation, and every post carries a sharp, specific insight drawn from real transformation patterns.
Today's lens: ${todayLens}
Write a mastermind conversation starter of 150-200 words at the highest strategic level. Your voice is peer-to-peer strategic depth: you are a fellow thinker who sees AI implementation and leadership culture as one discipline. Share a specific tension, pattern or insight that only someone inside the transformation sees, concrete enough that a sharp leader could act on it. Close with one high-stakes question that has no easy answer. The post is a conversation, and its purpose is the room's reply.`,
  );
}

// ─── Daily AC Seed — weekday schedule (Central time) ─────────────────────────
// Mon Renata · Tue Renata · Wed Matthew + Renata · Thu Renata · Fri Renata · Sat Petra · Sun Petra
// Matthew's Monday Weekly Challenge runs from api/matthew-weekly-challenge.ts.
async function runACCommunitySeed(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
  if (weekday === 'Saturday' || weekday === 'Sunday') return runPetra();
  if (weekday === 'Wednesday') {
    const [matthew, renata] = await Promise.all([runMatthew(), runRenata()]);
    console.log(`[ac_seed] Wednesday — Matthew approval ${matthew.approval_id ?? 'failed'} | Renata approval ${renata.approval_id ?? 'failed'}`);
    return matthew;
  }
  return runRenata();
}

// ─── AC Agent Reply ───────────────────────────────────────────────────────────

async function runACAgentReply(
  postId: string,
  postTitle: string,
  postContent: string,
  postType: string,
  routeTo: 'petra' | 'matthew',
): Promise<{ approval_id: string | null }> {
  const isPetra    = routeTo === 'petra';
  const agentId    = isPetra ? 'petra'        : 'matthew';
  const agentName  = isPetra ? 'Petra Vance'  : 'Matthew Elliot';
  const agentRole  = isPetra ? 'AC Member Experience' : 'Accelerator Circle Leader';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });

  const petraInstructions = `- Acknowledge the member's reality with specifics, so they feel genuinely seen\n- Honor what they are navigating in full\n- Add warmth that holds space\n- Voice: warm peer, encouraging and steady`;
  const matthewInstructions = `- Reply as a peer who has seen this pattern in organizations before\n- Draw on real experience\n- Add a specific, substantive strategic insight that moves the conversation forward\n- Invite further reflection\n- Voice: sophisticated, grounded, purposeful`;

  const agentCorrections = await getAgentCorrections(agentName);
  const prompt = `${GENIUS_MODE}\n\n${VOICE_DNA}${AC_COMMUNITY_VOICE}${agentCorrections}\n\nYou are ${agentName}, ${isPetra ? 'Member Experience' : 'the Accelerator Circle Leader'} in the Accelerator Circle at DRU AI Consulting. Today: ${today}.\nYour reply is peer-level.\nPost type: ${postType.replace(/_/g, ' ')}\nPost title: ${postTitle}\nPost content:\n${postContent.slice(0, 800)}\nWrite a reply comment of 100-150 words:\n${isPetra ? petraInstructions : matthewInstructions}\nReturn the reply text alone. ${isPetra ? 'Close with a warm, momentum-building line.' : 'Close with a high-stakes question.'} The reply shares knowledge and warmth for the member.`;

  try {
    const raw      = await callAnthropic(prompt, 600);
    const corrected = enforceTM(raw);
    const displayTitle = postTitle ? `"${postTitle.slice(0, 80)}"` : 'AC post reply';
    const approval_id = await writeToApprovals({
      source: 'ac_agent_reply', trigger_type: 'ac_agent_reply',
      agent_name: agentName, agent_role: agentRole,
      division: 'Accelerator Circle',
      task_brief: `${displayTitle} | post_id:${postId}`,
      original_content: postContent.slice(0, 500),
      output: corrected, edited_output: null,
      status: 'pending', ghl_contact_id: null, notify_deanna: true,
      priority: 'NORMAL', category: 'community_comment_reply',
      platform: null, context: null, archived: false,
    });
    console.log(`[${agentId}] AC reply → approvals: ${approval_id ?? 'failed'} for post ${postId}`);
    return { approval_id };
  } catch (error) {
    console.error(`[${agentId}] AC reply error:`, error);
    return { approval_id: null };
  }
}

// ─── Matthew's scan — every 4 hours, all brand products ──────────────────────────
// Matthew reads Accelerator Circle member posts that no scan has read yet and lists every opportunity
// each post shows. Petra acknowledges each member on their thread, then Aaliyah writes one card for
// all the members the scan found and sends it to DeAnna. A member already on an earlier card is not
// listed again. Every post read is recorded in community_scan_log (see COMMUNITY_SCAN_LOG.sql).
const AC_SCAN_PRODUCTS: Record<string, { name: string; signal: string }> = {
  course:           { name: 'From Confusion to Confidence with AI course', signal: 'interest in on-demand learning' },
  strategic:        { name: 'Strategic Diagnostic',                      signal: 'interest in a focused 90-minute working session' },
  executive:        { name: 'Executive Diagnostic',                      signal: 'interest in a deeper 120-minute working session' },
  dru_clear:        { name: 'DRU CLEAR™',                                signal: 'clarity, AI readiness, connecting strategy' },
  five_c:           { name: '5C Cultural DNA',                          signal: 'culture, communication, collaboration, cultural shift' },
  five_d:           { name: '5D Leadership',                            signal: 'leadership development, team and organizational leadership' },
  ai_sales_mastery: { name: 'AI Sales Mastery',                         signal: 'sales, DISC, revenue, client relationships' },
  bundle_full:      { name: 'Full Ecosystem Bundle',                     signal: 'the full transformation, the entire program' },
  bundle_plus_two:  { name: 'DRU CLEAR™ + 2 Frameworks',                 signal: 'combining two frameworks' },
  bundle_plus_one:  { name: 'DRU CLEAR™ + 1 Framework',                  signal: 'adding a framework to DRU CLEAR™' },
};

interface ACScanOpportunity { product: string; reason: string; }
interface ACScanFinding { memberId: string; firstName: string; tier: string; postId: string; postTitle: string; opportunities: ACScanOpportunity[]; }

async function detectACOpportunities(firstName: string, title: string, content: string, corrections: string): Promise<ACScanOpportunity[] | null> {
  const productLines = Object.entries(AC_SCAN_PRODUCTS).map(([key, p]) => `- ${key}: ${p.name}, shown by ${p.signal}`).join('\n');
  const prompt = `${GENIUS_MODE}${corrections}\n\nYou are Matthew Elliot, the Accelerator Circle Leader at DRU AI Consulting.\nA member named ${firstName} posted in the Accelerator Circle.\nTitle: ${title}\nContent: ${content.slice(0, 600)}\n\nRead the post for buying interest and list every opportunity it shows from this set:\n${productLines}\n\nGive each opportunity a one-sentence reason drawn from the member's own words.\nReturn valid JSON in exactly this shape, with nothing before or after it: {"opportunities":[{"product":"dru_clear","reason":"..."}]}\nA post that shows no buying interest returns {"opportunities":[]}.`;
  try {
    const raw = await callAnthropic(prompt, 500);
    const cleaned = raw.replace(/```json\s*|```/g, '').trim();
    const parsed = JSON.parse(cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1));
    const list: ACScanOpportunity[] = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
    return list.filter(o => o && AC_SCAN_PRODUCTS[o.product] && typeof o.reason === 'string' && o.reason.trim()).map(o => ({ product: o.product, reason: o.reason.trim() }));
  } catch (err) { console.error('[ac_scan] Detection failed:', err); return null; }
}

async function logACScannedPost(postId: string, memberId: string, opportunities: ACScanOpportunity[]): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  await fetch(`${url}/rest/v1/community_scan_log`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ community: 'acc', post_id: postId, member_id: memberId, found: opportunities.length > 0, opportunities }) });
}

async function writeACScanCard(findings: ACScanFinding[]): Promise<void> {
  const sections = findings.map(f => `${f.firstName} (${f.tier})\nPost: "${f.postTitle}"\n${f.opportunities.map(o => `- ${AC_SCAN_PRODUCTS[o.product].name}: ${o.reason}`).join('\n')}`);
  await writeToApprovals({
    source: 'aaliyah_opportunity', trigger_type: 'acc_opportunity',
    agent_name: 'Aaliyah Foster', agent_role: 'Opportunity Intelligence', division: 'Accelerator Circle',
    task_brief: `Accelerator Circle scan | ${findings.length} member${findings.length === 1 ? '' : 's'} | ${findings.map(f => f.firstName).join(', ')}`,
    original_content: null, output: sections.join('\n\n'), edited_output: null,
    status: 'pending', ghl_contact_id: null, notify_deanna: true,
    priority: 'HIGH', category: 'acc_opportunity', platform: null, context: null, archived: false,
  });
}

async function runACCommunityScan(): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('[ac_scan] Missing env vars'); return; }
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const postsRes = await fetch(`${url}/rest/v1/community_posts?post_type=eq.member_post&is_active=eq.true&tier_required=eq.accelerator&order=published_at.asc&limit=200`, { headers });
  if (!postsRes.ok) { console.error('[ac_scan] Failed to fetch posts:', await postsRes.text()); return; }
  const allPosts = await postsRes.json();
  if (!Array.isArray(allPosts) || !allPosts.length) { console.log('[ac_scan] No member posts — scan complete'); return; }

  // Posts already read by an earlier scan
  const ids = allPosts.map((p: any) => p.id).join(',');
  const readRes = await fetch(`${url}/rest/v1/community_scan_log?community=eq.acc&post_id=in.(${ids})&select=post_id`, { headers });
  const readIds = new Set<string>(readRes.ok ? (await readRes.json()).map((r: any) => r.post_id) : []);
  const posts = allPosts.filter((p: any) => !readIds.has(p.id)).slice(0, 20);
  if (!posts.length) { console.log('[ac_scan] No new member posts — scan complete'); return; }

  // Members already on an earlier card
  const memberIds = Array.from(new Set(posts.map((p: any) => p.agent_id).filter(Boolean)));
  const foundRes = memberIds.length ? await fetch(`${url}/rest/v1/community_scan_log?community=eq.acc&found=eq.true&member_id=in.(${memberIds.join(',')})&select=member_id`, { headers }) : null;
  const alreadyFound = new Set<string>(foundRes && foundRes.ok ? (await foundRes.json()).map((r: any) => r.member_id) : []);

  const corrections = await getAgentCorrections('Matthew Elliot');
  const findings: ACScanFinding[] = [];
  for (const post of posts) {
    const memberId = post.agent_id;
    if (!memberId) { await logACScannedPost(post.id, 'unknown', []); continue; }
    if (alreadyFound.has(memberId)) { await logACScannedPost(post.id, memberId, []); continue; }
    const profileRes = await fetch(`${url}/rest/v1/profiles?id=eq.${memberId}&tier=eq.accelerator&select=id,first_name,tier&limit=1`, { headers });
    const profiles = profileRes.ok ? await profileRes.json() : [];
    if (!Array.isArray(profiles) || !profiles.length) { await logACScannedPost(post.id, memberId, []); continue; }
    const profile = profiles[0];
    const opportunities = await detectACOpportunities(profile.first_name, post.title ?? '', post.content ?? '', corrections);
    if (opportunities === null) continue; // read again on the next scan
    await logACScannedPost(post.id, memberId, opportunities);
    if (!opportunities.length) { console.log(`[ac_scan] No opportunity for ${profile.first_name}`); continue; }
    alreadyFound.add(memberId);
    await postACKnowledgmentComment(post.id, profile.first_name, opportunities.map(o => o.reason).join(' '));
    findings.push({ memberId, firstName: profile.first_name, tier: profile.tier ?? 'accelerator', postId: post.id, postTitle: post.title ?? '', opportunities });
  }
  if (findings.length) await writeACScanCard(findings);
  console.log(`[ac_scan] Complete — ${posts.length} posts read, ${findings.length} members on the card`);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cron-secret');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method === 'GET' && req.query?.trigger_type) { req.body = { trigger_type: req.query.trigger_type, source: 'vercel_cron' }; }
  else if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const incomingSecret = req.headers['x-cron-secret'];
  if (incomingSecret !== undefined && incomingSecret !== process.env.CRON_SECRET) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const triggerType: string = req.body?.trigger_type;
  if (!triggerType) { res.status(400).json({ error: 'trigger_type is required' }); return; }

  const route = AC_AGENT_ROUTES[triggerType];
  if (!route) { res.status(400).json({ error: `Unknown AC trigger_type: ${triggerType}` }); return; }

  console.log(`[ac-agent-trigger] ${route.agent_name} | Accelerator Circle | ${req.body?.source ?? 'webhook'}`);

  if (route.pipeline === 'p10_ac_upsell_scan') {
    await runACCommunityScan();
    res.status(202).json({ success: true, agent: 'AC Upsell Scanner', message: 'Scan complete' });
    return;
  }

  if (route.pipeline === 'p10_ac_reply') {
    const { post_id, post_title, post_content, post_type, route_to } = req.body ?? {};
    if (!post_id || !route_to) { res.status(400).json({ error: 'ac_agent_reply requires post_id and route_to' }); return; }
    const result = await runACAgentReply(post_id, post_title ?? '', post_content ?? '', post_type ?? 'community_post', route_to);
    res.status(202).json({ success: true, agent: route_to === 'petra' ? 'Petra Vance' : 'Matthew Elliot', approval_id: result.approval_id, post_id });
    return;
  }

  if (route.pipeline === 'p10_ac_seed') {
    const result = await runACCommunitySeed();
    res.status(202).json({ success: true, agent: 'AC Community Seed', approval_id: result.approval_id, post_id: result.post_id });
    return;
  }

  res.status(400).json({ error: `No runner for pipeline: ${route.pipeline}` });
}

/*
─── pg_cron Schedule ────────────────────────────────────────────────────────────
Daily seed: dru-ac-community-seed (0 15 * * *) posts to /api/ac-agent-trigger with trigger_type cron_ac_community_seed.
Scan: dru-ac-upsell-scan posts with trigger_type cron_ac_upsell_scan (runs every 4 hours once turned on).
Monday challenge: runs from api/matthew-weekly-challenge.ts.
All scheduled jobs stay off until DeAnna says to turn them on.
────────────────────────────────────────────────────────────────────────────────
*/
