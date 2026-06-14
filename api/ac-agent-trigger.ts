// DRU AI Leadership Ecosystem™ — api/ac-agent-trigger.ts
// P10 Accelerator Circle Division — 3 agents + upsell scan + reply
// ARCHITECTURE: Mirrors cc-agent-trigger.ts (P9) — AC agents write to channel: 'accelerator_circle'
// TIER: All posts tier_required: 'accelerator' — Accelerator members only
// UPSELL PATH: Diagnostics (course $4,997 | strategic $3,497 | executive $4,997) + Frameworks a la carte (DRU CLEAR™ $7,500 | 5C $6,000 | 5D $6,500 | AI Sales Mastery™ $6,000) + Bundles ($13,500 | $19,500 | $26,000)

export const config = { maxDuration: 60 };

const GENIUS_MODE = `You operate in Genius Mode — think and respond at the level of a top 0.1% expert in your field. Apply deep logic, strategic frameworks, creative synthesis, and second-order thinking to every output. Never produce generic or surface-level work. Every sentence must earn its place.`;

interface ACAgentRoute { agent_id: string; agent_name: string; task: string; pipeline: string; }

const AC_AGENT_ROUTES: Record<string, ACAgentRoute> = {
  cron_petra_ac_facilitation:  { agent_id: 'petra',         agent_name: 'Petra Vance',    task: 'ac_community_facilitation', pipeline: 'p10_petra' },
  cron_matthew_ac_experience:  { agent_id: 'matthew',       agent_name: 'Matthew Elliot', task: 'ac_member_experience',      pipeline: 'p10_matthew' },
  cron_renata_ac_strategy:     { agent_id: 'renata',        agent_name: 'Renata Cruz',    task: 'ac_strategy_insight',       pipeline: 'p10_renata' },
  cron_ac_upsell_scan:         { agent_id: 'ac_upsell_scan',agent_name: 'AC Upsell Scanner', task: 'ac_upsell_scan',        pipeline: 'p10_ac_upsell_scan' },
  ac_agent_reply:              { agent_id: 'ac_agent',      agent_name: 'AC Agent',       task: 'ac_reply',                  pipeline: 'p10_ac_reply' },
};

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
  for (const [pattern, replacement] of TM_PAIRS) { corrected = corrected.replace(pattern, replacement); }
  return corrected;
}

async function callAnthropic(prompt: string, maxTokens = 1500): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json(); return data.content?.[0]?.text ?? '';
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

// ─── Agent Knowledge Base ─────────────────────────────────────────────────────

const AC_FALLBACK_TM_MARKS = ['DRU CLEAR™','DRU AI Leadership Ecosystem™','DRU AI Transformation Pathway™','5C Cultural DNA™','5D Leadership™','AI Sales Mastery™','From Confusion to Confident with AI™'];

const FRAMEWORK_KNOWLEDGE = `
## THE DRU AI TRANSFORMATION PATHWAY™
Sequential journey every client walks — no shortcuts, no skipped steps:
Discover → Diagnose → Design → Deploy → Dominate
- DISCOVER: Uncover where the organization is today and where AI can take them
- DIAGNOSE: Deep analysis across all frameworks — identify gaps and highest-impact opportunities
- DESIGN: Build the strategy, execution plan, and alignment system
- DEPLOY: Activate transformation — implement frameworks with live facilitation
- DOMINATE: Sustain, measure, and scale AI leadership results

## THE 4 FRAMEWORKS — TRUE MEANINGS

### DRU CLEAR™ — The Connector (Flagship) | $7,500 | 3 sessions x 90 min
NOT just an assessment. The complete AI readiness diagnosis, strategy design, and
execution alignment system that CONNECTS all four frameworks into a unified strategy.
- C — CLARITY: Define the AI vision with precision.
- L — LEADERSHIP: AI fluency, executive sponsorship, strategic conviction.
- E — EXECUTION: Close the gap between strategy and action.
- A — ALIGNMENT: Unify around a single AI strategy. Break silos.
- R — RESULTS: Define, measure, and demonstrate ROI.

### 5C Cultural DNA™ — Culture | $6,000 | 3 sessions x 90 min
Most organizations don't have an AI problem — they have a CULTURE problem.
- COMMUNICATION: How leaders and teams share vision and create clarity around AI.
- CONNECTION: Trust and meaningful relationships that enable AI collaboration.
- COLLABORATION: Breaking silos so AI initiatives flow through the whole organization.
- COACHING: Building confidence and competency from the inside out.
- CULTURE TRANSFORMATION: From resistance and fear to ownership and strategic adoption.

### 5D Leadership™ — Leadership | $6,500 | 3 sessions x 90 min
Focuses on the WHOLE leader — building from the inside out.
- I. SELF: Personal mastery. How a leader thinks, decides, and shows up.
- II. PEOPLE: Relational intelligence. Connects with and develops individuals.
- III. TEAM: Collective effectiveness. Builds cohesion, trust, and high performance.
- IV. ORGANIZATION: Systemic strength. Aligns culture, strategy, and operations.
- V. VISIONARY: Strategic impact. Sees beyond today, positions organization to lead.

### AI Sales Mastery™ — Sales | $6,000 | 3 sessions x 90 min
Combines DISC behavioral insights with AI. Selling stops feeling like selling.

## HOW THE FRAMEWORKS RELATE
DRU CLEAR™ is the CONNECTOR — anchors every engagement.
Bundles: Full Ecosystem $26,000 | DRU CLEAR + 2 $19,500 | DRU CLEAR + 1 $13,500
Diagnostics: Executive Diagnostic $4,997 (120 min) | Strategic Diagnostic $3,497 (90 min)
Course: From Confusion to Confident with AI™ — On-Demand $4,997
`;

async function getAgentKnowledge(): Promise<string> {
  let tmMarks: string[] = [];
  try {
    const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const res = await fetch(`${url}/rest/v1/brand_marks?active=eq.true&order=created_at.asc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      if (res.ok) { const data = await res.json(); tmMarks = (data as { mark: string }[]).map(m => m.mark).filter(Boolean); }
    }
  } catch (err) { console.error('[agentKnowledge] fetch error:', err); }
  if (tmMarks.length === 0) tmMarks = AC_FALLBACK_TM_MARKS;
  const tmList = tmMarks.map(m => `  - ${m}`).join('\n');
  return `=== DRU AI CONSULTING — AGENT KNOWLEDGE BASE ===

PROTECTED IP MARKS — TM REQUIRED ON EVERY USE, NO EXCEPTIONS:
${tmList}

RULES: Every mark above MUST include TM every time. NO other terms carry TM.
Do NOT add TM to anything not on this list. 'DRU AI Consulting' = business name, NO TM.
REQUIRED CTA: assessment.druaiconsulting.com (ONLY entry point into the ecosystem)
${FRAMEWORK_KNOWLEDGE}
=== END AGENT KNOWLEDGE BASE ===`.trim();
}

// ─── Core AC Agent Runner ─────────────────────────────────────────────────────
// Writes to channel: 'accelerator_circle' with tier_required: 'accelerator'

async function runACAgent(
  agentId: string,
  agentName: string,
  task: string,
  postType: string,
  category: string,
  prompt: string,
): Promise<{ approval_id: string | null; post_id: string | null }> {
  try {
    const agentKnowledge = await getAgentKnowledge();
    const raw = await callAnthropic(
      `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${prompt}\n\nReturn ONLY valid JSON with no preamble or markdown: {"title":"...","content":"..."}`,
      1500,
    );
    let title = ''; let content = '';
    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      title = parsed.title || agentName; content = parsed.content || raw;
    } catch {
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' });
      title = `${agentName} — ${dateStr}`; content = raw;
    }
    title = enforceTM(title); content = enforceTM(content);

    // ── AC posts: accelerator_circle channel, accelerator tier ──────────────
    const post_id = await writeToCommunityPosts({
      title,
      content,
      post_type:    postType,
      channel:      'accelerator_circle',
      tier_required:'accelerator',
      agent_id:     agentId,
      agent_name:   agentName,
      published_at: new Date().toISOString(),
      is_active:    false,
    });

    const approval_id = await writeToApprovals({
      source:           `${agentId}_ac`,
      trigger_type:     category,
      agent_name:       agentName,
      agent_role:       'Accelerator Circle',
      division:         'Accelerator Circle',
      task_brief:       post_id ? `post_id:${post_id} | ${agentName} | ${task.replace(/_/g, ' ')}` : `${agentName} | ${task.replace(/_/g, ' ')}`,
      original_content: null,
      output:           `${title}\n\n${content}`,
      edited_output:    null,
      status:           'pending',
      ghl_contact_id:   null,
      notify_deanna:    false,
      priority:         'NORMAL',
      category:         'community_post',
      platform:         'Accelerator Circle',
      context:          null,
      archived:         false,
    });

    console.log(`[${agentId}] AC post → approvals: ${approval_id ?? 'failed'} | community_posts: ${post_id ?? 'failed'}`);
    return { approval_id, post_id };
  } catch (error) {
    console.error(`[${agentId}] AC agent error:`, error);
    return { approval_id: null, post_id: null };
  }
}

// ─── Petra Vance — AC Community Leader ───────────────────────────────────────

async function runPetra(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let recentACPosts = 'No recent Accelerator Circle activity available.';
  if (url && key) {
    const since = new Date(); since.setHours(since.getHours() - 48);
    const r = await fetch(
      `${url}/rest/v1/community_posts?channel=eq.accelerator_circle&published_at=gte.${since.toISOString()}&order=published_at.desc&limit=8`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (r.ok) {
      const posts = await r.json();
      if (posts.length > 0) recentACPosts = posts.map((p: Record<string, string>) => `${p.agent_name} (${p.post_type}): ${p.title}`).join('\n');
    }
  }
  return runACAgent(
    'petra', 'Petra Vance', 'ac_community_facilitation', 'strategic_edge', 'ac_community_facilitation',
    `You are Petra Vance, Accelerator Circle Division Leader for DRU AI Consulting. Today: ${today}.
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
AUDIENCE: Accelerator members — senior leaders and executives already committed to AI transformation. These are your most advanced community members. Speak to them accordingly.
RECENT ACCELERATOR CIRCLE ACTIVITY (last 48 hours):
${recentACPosts}
Write a daily Accelerator Circle facilitation post (200-250 words). Voice: sophisticated authority — the executive in the room who has seen what AI transformation actually costs when done wrong.
Structure: One premium opening insight that only an Accelerator-level leader would recognize. Connect to a DRU framework at depth — not surface level. Pose one high-stakes executive reflection question.
After the post, on a new line write: "UPSELL SIGNAL: [one sentence identifying any Accelerator member showing readiness for From Confusion to Confident with AI™ course ($4,997), Strategic Diagnostic ($3,497), or Executive Diagnostic ($4,997) — route to Aaliyah Foster]"
CTA: assessment.druaiconsulting.com`,
  );
}

// ─── Matthew Elliot — AC Member Experience ───────────────────────────────────

async function runMatthew(): Promise<{ approval_id: string | null; post_id: string | null }> {
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
    'matthew', 'Matthew Elliot', 'ac_member_experience', 'daily_insight', 'ac_member_experience',
    `You are Matthew Elliot, Accelerator Circle Member Experience Manager for DRU AI Consulting. Today: ${today}.
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
AUDIENCE: Accelerator members — executives mid-implementation on AI transformation. They need momentum, clarity, and accountability — not motivation fluff.
MEMBER CONTEXT: ${memberContext}
Write an Accelerator Circle member experience post (150-200 words). Voice: warm executive authority — you hold the space between encouragement and accountability.
Focus on: where Accelerator members typically stall in the DRU AI Transformation Pathway™ (Design → Deploy phase), one specific implementation move they can make this week, a sense that someone is tracking their progress alongside them.
Reference the DRU AI Transformation Pathway™ specifically.
After the post, on a new line write: "UPSELL SIGNAL: [one sentence identifying any Accelerator member showing readiness for From Confusion to Confident with AI™ ($4,997), Strategic Diagnostic ($3,497), or Executive Diagnostic ($4,997) — route to Aaliyah Foster]"
CTA: assessment.druaiconsulting.com`,
  );
}

// ─── Renata Cruz — AC Strategy Agent ─────────────────────────────────────────

async function runRenata(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });

  // Alternates between AI Implementation and Leadership Culture each day
  const focus: Record<string, { lens: string; framework: string }> = {
    Monday:    { lens: 'Advanced AI Implementation',           framework: 'DRU AI Transformation Pathway™ — Deploy phase' },
    Tuesday:   { lens: 'Leadership Culture & Transformation',  framework: '5C Cultural DNA™ — Culture Transformation dimension' },
    Wednesday: { lens: 'Advanced AI Implementation',           framework: 'DRU CLEAR™ — Execution & Results' },
    Thursday:  { lens: 'Leadership Culture & Transformation',  framework: '5D Leadership™ — Organization & Visionary dimensions' },
    Friday:    { lens: 'AI Implementation + Culture woven',    framework: 'Full DRU AI Leadership Ecosystem™ synthesis' },
  };
  const todayFocus = focus[dayOfWeek] ?? focus['Monday'];

  return runACAgent(
    'renata', 'Renata Cruz', 'ac_strategy_insight', 'strategic_edge', 'ac_strategy_insight',
    `You are Renata Cruz, Accelerator Circle Strategy Agent for DRU AI Consulting. Today: ${today}.
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
AUDIENCE: Accelerator members — senior executives who already understand AI at a strategic level. Do not explain basics. Go deep.
TODAY'S LENS: ${todayFocus.lens}
TODAY'S FRAMEWORK: ${todayFocus.framework}
Write an Accelerator Circle strategy insight (250-300 words). Voice: global executive strategist who synthesizes AI implementation and leadership culture into one coherent movement — never treating them as separate disciplines.
Structure: One premium-level strategic insight that connects AI implementation to the cultural conditions that make it succeed or fail. Apply today's framework at depth. One executive-grade action that separates leaders who transform organizations from those who just adopt tools.
This is content that Accelerator members cannot get anywhere else. Make it feel that way.
CTA: assessment.druaiconsulting.com`,
  );
}

// ─── AC Agent Reply ───────────────────────────────────────────────────────────
// Routes to Petra (strategic) or Matthew (warm/experience)

async function runACAgentReply(
  postId: string,
  postTitle: string,
  postContent: string,
  postType: string,
  routeTo: 'petra' | 'matthew',
): Promise<{ approval_id: string | null }> {
  const isPetra = routeTo === 'petra';
  const agentId   = isPetra ? 'petra'   : 'matthew';
  const agentName = isPetra ? 'Petra Vance' : 'Matthew Elliot';
  const agentRole = isPetra ? 'AC Community Leader' : 'AC Member Experience Manager';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });

  const petraInstructions = `- Reply with the authority of a division leader who has seen this pattern before
- Connect to a DRU framework at depth — not surface level
- Add one strategic insight that elevates the conversation beyond where the member left it
- Invite further executive-level reflection
- Voice: sophisticated, grounded, purposeful`;

  const matthewInstructions = `- Acknowledge the member's implementation reality — make them feel genuinely seen
- Validate what they're navigating with executive specificity
- Add warmth that holds them accountable without pressure
- Voice: warm executive authority — encouraging and steady`;

  const prompt = `${GENIUS_MODE}

You are ${agentName}, ${agentRole} for DRU AI Consulting. Today: ${today}.
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
CONTEXT: You are replying inside the Accelerator Circle — a premium space for Accelerator members only. Your reply should feel exclusive and executive.
POST TYPE: ${postType.replace(/_/g, ' ')}
POST TITLE: ${postTitle}
POST CONTENT:
${postContent.slice(0, 800)}
Write a reply comment (100-150 words):
${isPetra ? petraInstructions : matthewInstructions}
Write ONLY the reply. ${isPetra ? 'End with a high-stakes question or executive invitation.' : 'End with a warm, momentum-building close.'}
If CTA fits naturally: assessment.druaiconsulting.com`;

  try {
    const raw = await callAnthropic(prompt, 600);
    const corrected = enforceTM(raw);
    const displayTitle = postTitle ? `"${postTitle.slice(0, 80)}"` : 'AC post reply';
    const approval_id = await writeToApprovals({
      source:           'ac_agent_reply',
      trigger_type:     'ac_agent_reply',
      agent_name:       agentName,
      agent_role:       agentRole,
      division:         'Accelerator Circle',
      task_brief:       `${displayTitle} | post_id:${postId}`,
      original_content: postContent.slice(0, 500),
      output:           corrected,
      edited_output:    null,
      status:           'pending',
      ghl_contact_id:   null,
      notify_deanna:    true,
      priority:         'NORMAL',
      category:         'community_comment_reply',
      platform:         null,
      context:          null,
      archived:         false,
    });
    console.log(`[${agentId}] AC reply → approvals: ${approval_id ?? 'failed'} for post ${postId}`);
    return { approval_id };
  } catch (error) {
    console.error(`[${agentId}] AC reply error:`, error);
    return { approval_id: null };
  }
}

// ─── AC Upsell Scan ───────────────────────────────────────────────────────────
// Scans Accelerator Circle member posts for course / diagnostic readiness signals

async function hasRecentACUpsellCard(memberId: string): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `${url}/rest/v1/approvals?category=eq.ac_upsell_outreach&task_brief=ilike.*${memberId}*&created_at=gte.${sevenDaysAgo}&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) return false;
  const data = await res.json(); return Array.isArray(data) && data.length > 0;
}

async function fireACUpsellCard(
  memberId: string,
  firstName: string,
  email: string | null,
  phone: string | null,
  signalReason: string,
  upsellTarget: string,
  postTitle: string,
): Promise<void> {
  const ctaMap: Record<string, string> = {
    // Diagnostics
    course:           'From Confusion to Confident with AI™ — On-Demand $4,997 → https://link.druaiconsulting.com/course-on-demand',
    strategic:        'Strategic Diagnostic $3,497 → https://link.druaiconsulting.com/payment-link/69dc8f8d557558e89e51f222',
    executive:        'Executive Diagnostic $4,997 → https://link.druaiconsulting.com/payment-link/69dc91c480425dc02fbc7645',
    // Frameworks — a la carte
    dru_clear:        'DRU CLEAR™ — $7,500 → https://link.druaiconsulting.com/payment-link/69e41757557558e89e520dec',
    five_c:           '5C Cultural DNA™ — $6,000 → https://link.druaiconsulting.com/payment-link/69e4194e557558e89e520def',
    five_d:           '5D Leadership™ — $6,500 → https://link.druaiconsulting.com/payment-link/69e418197dd3512d920772fc',
    ai_sales_mastery: 'AI Sales Mastery™ — $6,000 → https://link.druaiconsulting.com/payment-link/69e419bb7dd3512d920772fe',
    // Bundles
    bundle_full:      'Full Ecosystem Bundle — $26,000 (DRU CLEAR™ + all 3 frameworks) → https://link.druaiconsulting.com/payment-link/69e41a287dd3512d920772ff',
    bundle_plus_two:  'DRU CLEAR™ + 2 Frameworks Bundle — $19,500 → https://link.druaiconsulting.com/payment-link/69dc91c480425dc02fbc7645',
    bundle_plus_one:  'DRU CLEAR™ + 1 Framework Bundle — $13,500 → https://link.druaiconsulting.com/payment-link/69dc91c480425dc02fbc7645',
  };
  const cta = ctaMap[upsellTarget] ?? ctaMap['course'];

  const prompt = `${GENIUS_MODE}

You are Aaliyah Foster, Outreach Specialist for DRU AI Consulting.
An Accelerator member named ${firstName} is showing strong signals of readiness to go deeper: ${signalReason}
Recent post: "${postTitle}"
Write a warm, personalized outreach message (100-120 words) inviting ${firstName} to take the next step. Feel personal and specific. Reference their Accelerator engagement. Make the offer feel like a natural next move, not a pitch.
Offer: ${cta}
Write ONLY the message.`;

  const outreach = enforceTM(await callAnthropic(prompt, 400));
  const emailLine = email && !email.includes('not found') ? `Email: ${email}` : '⚠ Email not found';
  const phoneLine = phone && !phone.includes('not found') ? `Phone: ${phone}` : '⚠ Phone not found';

  await writeToApprovals({
    source:           'ac_upsell_scan',
    trigger_type:     'ac_upsell_scan',
    agent_name:       'Aaliyah Foster',
    agent_role:       'Outreach',
    division:         'Accelerator Circle',
    task_brief:       `MEMBER_ID:${memberId} | ${emailLine} | ${phoneLine} | Target: ${upsellTarget} | Signal: ${signalReason}`,
    original_content: `AC post: "${postTitle}" — Accelerator member showing ${upsellTarget} readiness`,
    output:           outreach,
    edited_output:    null,
    status:           'pending',
    ghl_contact_id:   null,
    notify_deanna:    true,
    priority:         'HIGH',
    category:         'ac_upsell_outreach',
    platform:         null,
    context:          null,
    archived:         false,
  });
  console.log(`[aaliyah] AC upsell card → ${firstName} | target: ${upsellTarget}`);
}

async function runACUpsellScan(): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('[ac_upsell_scan] Missing env vars'); return; }

  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const postsRes = await fetch(
    `${url}/rest/v1/community_posts?post_type=eq.member_post&channel=eq.accelerator_circle&is_active=eq.true&published_at=gte.${threeHoursAgo}&order=published_at.desc&limit=20`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!postsRes.ok) { console.error('[ac_upsell_scan] Failed to fetch posts:', await postsRes.text()); return; }
  const posts = await postsRes.json();
  if (!Array.isArray(posts) || !posts.length) { console.log('[ac_upsell_scan] No recent AC member posts — scan complete'); return; }

  let signalsFound = 0;
  for (const post of posts) {
    const memberId = post.agent_id; if (!memberId) continue;
    const profileRes = await fetch(
      `${url}/rest/v1/profiles?id=eq.${memberId}&tier=eq.accelerator&select=id,first_name,email,phone&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!profileRes.ok) continue;
    const profiles = await profileRes.json(); if (!Array.isArray(profiles) || !profiles.length) continue;
    const profile = profiles[0];

    const alreadyFlagged = await hasRecentACUpsellCard(memberId);
    if (alreadyFlagged) { console.log(`[ac_upsell_scan] ${profile.first_name} — card exists, skipping`); continue; }

    const detectionPrompt = `${GENIUS_MODE}

You are Petra Vance, Accelerator Circle Division Leader.
An Accelerator member named ${profile.first_name} posted:
TITLE: ${post.title}
CONTENT: ${(post.content || '').slice(0, 600)}
Is this member showing buying signals for any DRU AI Consulting offer? Scan for signals of:
DIAGNOSTICS:
1. course — From Confusion to Confident with AI™ ($4,997): mentions AI learning, course, training, skill-building
2. strategic — Strategic Diagnostic ($3,497): mentions needing clarity, assessment, strategy session (90 min)
3. executive — Executive Diagnostic ($4,997): mentions deep-dive, executive-level clarity, comprehensive strategy (120 min)
FRAMEWORKS (a la carte):
4. dru_clear — DRU CLEAR™ ($7,500): mentions clarity framework, AI readiness, connecting strategy, DRU CLEAR
5. five_c — 5C Cultural DNA™ ($6,000): mentions culture, communication, collaboration, cultural shift, 5C
6. five_d — 5D Leadership™ ($6,500): mentions leadership development, team, organizational leadership, 5D
7. ai_sales_mastery — AI Sales Mastery™ ($6,000): mentions sales, DISC, revenue, client relationships, sales mastery
BUNDLES:
8. bundle_full — Full Ecosystem $26,000 (all 4 frameworks): mentions full transformation, entire program, everything
9. bundle_plus_two — DRU CLEAR + 2 frameworks $19,500: mentions two frameworks, combination
10. bundle_plus_one — DRU CLEAR + 1 framework $13,500: mentions adding a framework, pairing with DRU CLEAR
Pick the SINGLE strongest signal only. Respond EXACTLY in one of these formats:
UPSELL SIGNAL: YES | MEMBER_ID: ${memberId} | TARGET: course | REASON: [one sentence]
UPSELL SIGNAL: YES | MEMBER_ID: ${memberId} | TARGET: strategic | REASON: [one sentence]
UPSELL SIGNAL: YES | MEMBER_ID: ${memberId} | TARGET: executive | REASON: [one sentence]
UPSELL SIGNAL: YES | MEMBER_ID: ${memberId} | TARGET: dru_clear | REASON: [one sentence]
UPSELL SIGNAL: YES | MEMBER_ID: ${memberId} | TARGET: five_c | REASON: [one sentence]
UPSELL SIGNAL: YES | MEMBER_ID: ${memberId} | TARGET: five_d | REASON: [one sentence]
UPSELL SIGNAL: YES | MEMBER_ID: ${memberId} | TARGET: ai_sales_mastery | REASON: [one sentence]
UPSELL SIGNAL: YES | MEMBER_ID: ${memberId} | TARGET: bundle_full | REASON: [one sentence]
UPSELL SIGNAL: YES | MEMBER_ID: ${memberId} | TARGET: bundle_plus_two | REASON: [one sentence]
UPSELL SIGNAL: YES | MEMBER_ID: ${memberId} | TARGET: bundle_plus_one | REASON: [one sentence]
UPSELL SIGNAL: NO`;

    const detection = await callAnthropic(detectionPrompt, 150);
    if (!detection.includes('UPSELL SIGNAL: YES')) { console.log(`[ac_upsell_scan] No signal for ${profile.first_name}`); continue; }

    const reasonMatch = detection.match(/REASON:\s*(.+)/);
    const targetMatch = detection.match(/TARGET:\s*(course|strategic|executive|dru_clear|five_c|five_d|ai_sales_mastery|bundle_full|bundle_plus_two|bundle_plus_one)/);
    const reason     = reasonMatch?.[1]?.trim() ?? 'Member showing readiness to go deeper';
    const target     = targetMatch?.[1]?.trim() ?? 'course';

    await fireACUpsellCard(memberId, profile.first_name, profile.email ?? null, profile.phone ?? null, reason, target, post.title);
    signalsFound++;
  }
  console.log(`[ac_upsell_scan] Complete — ${posts.length} posts scanned, ${signalsFound} signals fired`);
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

  // ── AC Upsell Scan ──────────────────────────────────────────────────────────
  if (route.pipeline === 'p10_ac_upsell_scan') {
    await runACUpsellScan();
    res.status(202).json({ success: true, agent: 'AC Upsell Scanner', message: 'Scan complete' });
    return;
  }

  // ── AC Agent Reply ──────────────────────────────────────────────────────────
  if (route.pipeline === 'p10_ac_reply') {
    const { post_id, post_title, post_content, post_type, route_to } = req.body ?? {};
    if (!post_id || !route_to) { res.status(400).json({ error: 'ac_agent_reply requires post_id and route_to' }); return; }
    const result = await runACAgentReply(post_id, post_title ?? '', post_content ?? '', post_type ?? 'community_post', route_to);
    res.status(202).json({ success: true, agent: route_to === 'petra' ? 'Petra Vance' : 'Matthew Elliot', approval_id: result.approval_id, post_id });
    return;
  }

  // ── Content Agents ──────────────────────────────────────────────────────────
  const runners: Record<string, () => Promise<{ approval_id: string | null; post_id: string | null }>> = {
    p10_petra:   runPetra,
    p10_matthew: runMatthew,
    p10_renata:  runRenata,
  };

  const runner = runners[route.pipeline];
  if (!runner) { res.status(400).json({ error: `No runner for pipeline: ${route.pipeline}` }); return; }

  const result = await runner();
  res.status(202).json({ success: true, agent: route.agent_name, approval_id: result.approval_id, post_id: result.post_id });
}

/*
─── pg_cron Schedule — add these in Supabase SQL Editor ────────────────────────

SELECT cron.schedule('petra-ac-facilitation',  '0 14 * * *', $$SELECT net.http_post(url:='https://app.druaiconsulting.com/api/ac-agent-trigger', body:='{"trigger_type":"cron_petra_ac_facilitation","source":"pg_cron"}'::jsonb, headers:='{"Content-Type":"application/json"}'::jsonb)$$);
SELECT cron.schedule('matthew-ac-experience',   '30 14 * * *', $$SELECT net.http_post(url:='https://app.druaiconsulting.com/api/ac-agent-trigger', body:='{"trigger_type":"cron_matthew_ac_experience","source":"pg_cron"}'::jsonb, headers:='{"Content-Type":"application/json"}'::jsonb)$$);
SELECT cron.schedule('renata-ac-strategy',      '0 15 * * *', $$SELECT net.http_post(url:='https://app.druaiconsulting.com/api/ac-agent-trigger', body:='{"trigger_type":"cron_renata_ac_strategy","source":"pg_cron"}'::jsonb, headers:='{"Content-Type":"application/json"}'::jsonb)$$);
SELECT cron.schedule('ac-upsell-scan',          '30 15 * * *', $$SELECT net.http_post(url:='https://app.druaiconsulting.com/api/ac-agent-trigger', body:='{"trigger_type":"cron_ac_upsell_scan","source":"pg_cron"}'::jsonb, headers:='{"Content-Type":"application/json"}'::jsonb)$$);

────────────────────────────────────────────────────────────────────────────────
*/
