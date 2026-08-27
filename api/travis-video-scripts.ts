// api/travis-video-scripts.ts  —  ADMIN REPO (dru-clear-app)
// Travis Wealthy — Video Script Pipeline
//
// Five studio agents write 60-second avatar scripts for DeAnna's brand,
// each from their own lane. Scripts gate through Isabella before landing
// in the Intelligence Hub as video_script approval cards.
//
// Travis-render.ts (members repo) reads those approved cards via shared
// Supabase and submits them to HeyGen. The two files never call each other
// directly — Supabase is the bridge.
//
// Flow per script day:
//   pg_cron fires → agent writes script → Isabella reviews (2 tries)
//   PASS  → approvals (category: video_script, status: pending) + SMS to DeAnna
//   FAIL  → rejection logged to CSQ with both Isabella notes for agent training
//
// Rotation (10am CDT = 15:00 UTC):
//   Monday    (job 212) — Darius King       viral hook / scroll-stopper
//   Wednesday (job 213) — Nia Robinson      authority thought leadership
//   Thursday  (job 214) — Chloe Dubois      CTA / conversion-focused
//   Saturday  (job 215) — Zara Ahmed        launch / momentum energy
//   Sunday    (job 216) — Amelia Santos     transformation storytelling
//
// Tuesday + Friday reserved for DeAnna's text+pic posts — no video cron fires.

import type { VercelRequest, VercelResponse } from "@vercel/node";
export const config = { maxDuration: 300 };

const GENIUS_MODE = `You operate in Genius Mode — think and respond at the level of a top 0.1% expert in your field. Apply deep logic, strategic frameworks, creative synthesis, and second-order thinking to every output. Never produce generic or surface-level work. Every sentence must earn its place.`;

const FALLBACK_TM_MARKS = ['DRU CLEAR™','DRU AI Leadership Ecosystem™','DRU AI Transformation Pathway™','5C Cultural DNA™','5D Leadership™','AI Sales Mastery™','From Confusion to Confident with AI™'];

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
- C — CLARITY: Define the AI vision with precision. Where are you going, why does it matter?
- L — LEADERSHIP: AI fluency, executive sponsorship, strategic conviction top-down and inside-out.
- E — EXECUTION: Close the gap between strategy and action. Identify processes and capabilities.
- A — ALIGNMENT: Unify around a single AI strategy. Break silos, synchronize departments.
- R — RESULTS: Define, measure, and demonstrate ROI. What gets measured gets transformed.

### 5C Cultural DNA™ — Culture | $6,000 | 3 sessions x 90 min
Theme: Learn IT. Live IT. Lead IT. Leadership Thinking with AI.
Most organizations don't have an AI problem — they have a CULTURE problem.
- COMMUNICATION: Foundation. How leaders and teams share vision and create clarity around AI.
- CONNECTION: Relational layer. Trust and meaningful relationships that enable collaboration.
- COLLABORATION: Action layer. Breaking silos so AI initiatives flow through the whole organization.
- COACHING: Development layer. Building confidence and competency from the inside out.
- CULTURE TRANSFORMATION: Outcome. From resistance and fear to ownership and strategic adoption.

### 5D Leadership™ — Leadership | $6,500 | 3 sessions x 90 min
An AI-infused methodology where personal mastery and strategic impact develop together.
- I. SELF: Personal mastery. How a leader thinks, decides, and shows up.
- II. PEOPLE: Relational intelligence. Connects with and develops the individuals around them.
- III. TEAM: Collective effectiveness. Builds cohesion, trust, and high performance.
- IV. ORGANIZATION: Systemic strength. Aligns culture, strategy, and operations.
- V. VISIONARY: Strategic impact. Sees beyond today, positions organization to lead.

### AI Sales Mastery™ — Sales | $6,000 | 3 sessions x 90 min
Combines DISC behavioral insights with AI. Selling stops feeling like selling.
- HYPER-PERSONALIZED OUTREACH AT SCALE: Right person, right message, right time — every time.
- SPEAK YOUR CLIENT'S DECISION LANGUAGE: DISC gives you the map. AI gives you the speed.
- PREDICT OBJECTIONS BEFORE THEY HAPPEN: Stop reacting and start anticipating.
- CLOSE WITH CONFIDENCE, NOT PRESSURE: Clarity makes closing a natural next step.
- BUILD LONG-TERM CLIENT RELATIONSHIPS: Not transactions — transformation.

## HOW THE FRAMEWORKS RELATE
DRU CLEAR™ is the CONNECTOR — anchors every engagement.
Bundles: Full Ecosystem $26,000 | DRU CLEAR + 2 $19,500 | DRU CLEAR + 1 $13,500
Diagnostics: Executive Diagnostic $4,997 (120 min) | Strategic Diagnostic $3,497 (90 min)
Course: From Confusion to Confident with AI™ — Self-Paced $1,497 | Cohort $7,997 | Mastermind $12,997
`;

// Logs every real API call's actual token usage and cost to Supabase so spend
// is visible in the Intelligence Hub instead of estimated by hand.
async function logModelUsage(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const rate = model.startsWith('claude-sonnet') ? { in: 3, out: 15 } : { in: 1, out: 5 };
  const cost_usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  await fetch(`${url}/rest/v1/model_usage_log`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ source_file: 'travis-video-scripts', model, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd }) });
}

// ── Anthropic callers ─────────────────────────────────────────────────────────
// Sonnet for Isabella (quality gate), Haiku for agents (cost efficiency)
async function callSonnet(prompt: string, maxTokens = 800): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Sonnet error ${res.status}`);
  const data = await res.json();
  await logModelUsage('claude-sonnet-4-6', data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0).catch(() => {});
  return data.content?.[0]?.text ?? '';
}

async function callHaiku(prompt: string, maxTokens = 1500): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Haiku error ${res.status}`);
  const data = await res.json();
  await logModelUsage('claude-haiku-4-5-20251001', data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0).catch(() => {});
  return data.content?.[0]?.text ?? '';
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
function sbHeaders() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env not set');
  return { url, headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` } };
}

async function sbPost(path: string, body: unknown): Promise<any[] | null> {
  const { url, headers } = sbHeaders();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { console.error(`[sb POST ${path}] ${res.status} ${await res.text()}`); return null; }
  return res.json();
}

// ── Brand marks ───────────────────────────────────────────────────────────────
async function fetchBrandMarks(): Promise<string> {
  try {
    const { url, headers } = sbHeaders();
    const res = await fetch(`${url}/rest/v1/brand_marks?active=eq.true&order=created_at.asc`, { headers });
    if (res.ok) {
      const data: { mark: string }[] = await res.json();
      const marks = data.map(m => m.mark).filter(Boolean);
      if (marks.length > 0) return marks.join(', ');
    }
  } catch { /* fall through */ }
  return FALLBACK_TM_MARKS.join(', ');
}

// ── Brand copy (positioning, hooks, tagline) ────────────────────────────────
const BRAND_COPY_FALLBACK: Record<string,string> = {
  positioning: 'EQ Meets AI: People-Centered Leadership, AI-Powered Insight',
};
async function fetchBrandCopy(key: string): Promise<string> {
  const fallback = BRAND_COPY_FALLBACK[key] || '';
  try {
    const { url, headers } = sbHeaders();
    const res = await fetch(`${url}/rest/v1/brand_copy?key=eq.${key}&select=value`, { headers });
    if (res.ok) {
      const data: { value: string }[] = await res.json();
      if (data[0]?.value) return data[0].value;
    }
  } catch { /* fall through */ }
  return fallback;
}

// ── Write approved script to approvals table ──────────────────────────────────
// output field format: script text + JSON treatment block at end
// parseCreative in travis-render.ts extracts the treatment from this format.
async function writeVideoScriptApproval({
  agentId, agentName, division, title, scriptText, treatment, taskBrief,
  linkedinCaption, facebookCaption, instagramCaption,
}: {
  agentId: string; agentName: string; division: string; title: string;
  scriptText: string; treatment: string; taskBrief: string;
  linkedinCaption: string; facebookCaption: string; instagramCaption: string;
}): Promise<string | null> {
  // Embed treatment as trailing JSON so travis-render.ts parseCreative picks it up
  const output = treatment
    ? `${scriptText}\n${JSON.stringify({ treatment })}`
    : scriptText;

  const rows = await sbPost('approvals', {
    agent_name: agentName,
    agent_role: division,
    division,
    source: `${agentId}_video_script`,
    trigger_type: 'video_script_daily',
    task_brief: taskBrief,
    output,
    edited_output: null,
    category: 'video_script',
    platform: 'Video',
    title,
    status: 'pending',
    priority: 'high',
    notify_deanna: false,
    archived: false,
    linkedin_content: linkedinCaption || scriptText,
    facebook_content: facebookCaption || '',
    instagram_caption: instagramCaption || '',
  });
  return Array.isArray(rows) && rows.length > 0 ? rows[0].id : null;
}

// ── Log hard rejection to CSQ for agent training ──────────────────────────────
async function logRejection(
  agentId: string, agentName: string, division: string,
  script: string, reason1: string, reason2: string
): Promise<void> {
  await sbPost('chief_of_staff_queue', {
    agent_id: agentId, agent_name: agentName, division,
    task: 'video_script_daily', category: 'video_script',
    raw_output: script,
    priority: 'normal', status: 'rejected', retry_count: 2,
    correction_notes: `ATTEMPT 1 REJECTION:\n${reason1}\n\nATTEMPT 2 REJECTION:\n${reason2}\n\nHard rejection after 2 attempts. Study both notes to improve future scripts.`,
  });
}

// ── SMS to DeAnna when script passes Isabella ─────────────────────────────────
async function fireVideoScriptSMS(agentName: string, approvalId: string): Promise<void> {
  const webhookUrl = process.env.GHL_NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'druaiconsulting@gmail.com',
        phone: '+19796186671',
        first_name: 'DeAnna',
        last_name: 'Upshaw',
        agent_name: agentName,
        division: 'Video Production',
        task: 'video_script_daily',
        approval_id: approvalId,
        summary: `📝 ${agentName} has a new video script ready for your review.`,
        triggered_at: new Date().toISOString(),
        review_url: 'https://app.druaiconsulting.com/admin-approvals',
        sms_body: `DRU AI Consulting | 📝 ${agentName} video script ready.\n\nReview: app.druaiconsulting.com/admin-approvals`,
        email_subject: `DRU AI Consulting — ${agentName} Video Script Ready`,
        email_body: `${agentName} has submitted a video script for Travis's pipeline.\n\nReview and approve:\nhttps://app.druaiconsulting.com/admin-approvals\n\n— DRU AI Leadership Ecosystem™`,
      }),
    });
    console.log(`[travis-video-scripts] SMS sent for ${agentName}`);
  } catch (err) { console.warn('[travis-video-scripts] SMS failed (non-fatal):', err); }
}

// ── Isabella compliance gate ──────────────────────────────────────────────────
// Sonnet only — this is a quality gate, not a cost-optimization task.
async function runIsabellaReview(
  script: string, agentName: string, attempt: number, priorReason?: string
): Promise<{ pass: boolean; reason: string }> {
  const brandMarks = await fetchBrandMarks();
  const priorContext = priorReason
    ? `\n\nPRIOR REJECTION (attempt ${attempt - 1}):\n${priorReason}\nThe agent has rewritten based on this feedback. Review with that in mind.`
    : '';

  const raw = await callSonnet(
    `${GENIUS_MODE}\n\nYou are Isabella Moreno, Director of Compliance for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.\n\nReview this video script for compliance before it enters the approval queue.\n\nFRAMEWORK REFERENCE — verify all claims against these exact definitions:\n${FRAMEWORK_KNOWLEDGE}\n\nCOMPLIANCE CHECKLIST:\n1. TRADEMARK ACCURACY — All framework references must use ™ and match exact definitions above. Invented or paraphrased framework content = FAIL.\n2. SERVICE CLASS RULES — Content within Classes 35, 41, 42 only. No medical, financial, legal advice = FAIL.\n3. FACTUAL ACCURACY — No false claims about DeAnna's credentials, frameworks, or results.\n4. BRAND VOICE — Authority tone. Never desperate, never vague, never off-brand.\n5. NO INVENTED CONTENT — No fabricated client results, testimonials, or statistics.\n\nAPPROVED TRADEMARK MARKS: ${brandMarks}\n${priorContext}\n\nSCRIPT TO REVIEW:\n${script}\n\nRespond ONLY with valid JSON — no markdown fences, no preamble:\n{"pass":true,"reason":"Brief confirmation of what was checked and passed."}\nOR\n{"pass":false,"reason":"Specific violation(s) found with exact quote from script and what the correct version should say. Be precise so the agent can fix it."}`,
    600
  );

  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON found');
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return { pass: !!parsed.pass, reason: parsed.reason ?? 'No reason provided' };
  } catch {
    return { pass: false, reason: 'Isabella review failed to parse — treating as rejection for safety' };
  }
}

// ── Parse agent JSON output ───────────────────────────────────────────────────
function parseAgentOutput(raw: string): {
  script: string; treatment: string;
  linkedinCaption: string; facebookCaption: string; instagramCaption: string;
} {
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON');
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return {
      script:           parsed.script           ?? raw,
      treatment:        parsed.treatment         ?? '',
      linkedinCaption:  parsed.linkedin_caption  ?? parsed.script ?? raw,
      facebookCaption:  parsed.facebook_caption  ?? '',
      instagramCaption: parsed.instagram_caption ?? '',
    };
  } catch {
    return { script: raw, treatment: '', linkedinCaption: raw, facebookCaption: '', instagramCaption: '' };
  }
}

// ── Shared orchestrator: 2 tries through Isabella, SMS on pass, log on fail ───
async function runWithIsabellaGate(
  agentId: string, agentName: string, division: string, title: string, taskBrief: string,
  generateScript: () => Promise<string>,
  generateScriptWithFeedback: (reason: string) => Promise<string>,
): Promise<{ approvalId: string | null; result: 'passed' | 'rejected' | 'error' }> {
  try {
    // Attempt 1
    const raw1 = await generateScript();
    const parsed1 = parseAgentOutput(raw1);
    const review1 = await runIsabellaReview(parsed1.script, agentName, 1);

    if (review1.pass) {
      const approvalId = await writeVideoScriptApproval({ agentId, agentName, division, title, taskBrief, ...parsed1 });
      if (approvalId) await fireVideoScriptSMS(agentName, approvalId);
      console.log(`[travis-video-scripts] ${agentName} passed Isabella (attempt 1) → approval ${approvalId}`);
      return { approvalId, result: 'passed' };
    }
    console.log(`[travis-video-scripts] ${agentName} attempt 1 rejected: ${review1.reason}`);

    // Attempt 2 — agent receives Isabella's exact feedback
    const raw2 = await generateScriptWithFeedback(review1.reason);
    const parsed2 = parseAgentOutput(raw2);
    const review2 = await runIsabellaReview(parsed2.script, agentName, 2, review1.reason);

    if (review2.pass) {
      const approvalId = await writeVideoScriptApproval({ agentId, agentName, division, title, taskBrief, ...parsed2 });
      if (approvalId) await fireVideoScriptSMS(agentName, approvalId);
      console.log(`[travis-video-scripts] ${agentName} passed Isabella (attempt 2) → approval ${approvalId}`);
      return { approvalId, result: 'passed' };
    }

    // Hard rejection — log both reasons for training
    console.warn(`[travis-video-scripts] ${agentName} hard rejected after 2 attempts`);
    await logRejection(agentId, agentName, division, parsed2.script, review1.reason, review2.reason);
    return { approvalId: null, result: 'rejected' };

  } catch (err: any) {
    console.error(`[travis-video-scripts] ${agentName} error:`, err?.message ?? err);
    return { approvalId: null, result: 'error' };
  }
}

// ── Agent: Darius King — Viral hook, scroll-stopper energy ───────────────────
async function runDariusVideoScript(): Promise<{ approvalId: string | null; result: string }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const brandMarks = await fetchBrandMarks();
  const positioning = await fetchBrandCopy('positioning');

  const buildPrompt = (feedback = '') => `${GENIUS_MODE}\n\nYou are Darius King, Viral Scripter for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.\nPositioning: "${positioning}." Every script stops the scroll in the first 3 seconds.\nTRADEMARK RULES: Only use frameworks with ™. APPROVED: ${brandMarks}\nSERVICE CLASS RULES: Classes 35, 41, 42 only.\n\nFRAMEWORK REFERENCE — use exact definitions, never paraphrase or invent:\n${FRAMEWORK_KNOWLEDGE}\n${feedback ? `\nISABELLA COMPLIANCE FEEDBACK — fix these issues before rewriting:\n${feedback}\n` : ''}\nToday: ${today}\n\nWrite a 60-second avatar video script for DeAnna R. Upshaw.\nFormat: scroll-stopping hook (first 3 seconds — create a feeling), sharp insight from one DRU framework, clear CTA to assessment.druaiconsulting.com.\nEnergy: punchy, high-energy, never stiff. This is Darius — make it hit.\n\nReturn ONLY valid JSON — no markdown fences, no preamble:\n{"script":"full word-for-word script DeAnna speaks to camera","treatment":"Darius direction: energy level, pacing, wardrobe vibe, any visual note","linkedin_caption":"60-90 word LinkedIn caption for when this video posts","facebook_caption":"60-90 word Facebook caption","instagram_caption":"50-70 word Instagram caption with 5-7 hashtags"}`;

  return runWithIsabellaGate(
    'darius', 'Darius King', 'Content & Brand',
    `🎬 Darius — Viral Script | ${today}`,
    `Viral hook script — Darius King | ${today}`,
    () => callHaiku(buildPrompt()),
    (reason) => callHaiku(buildPrompt(reason)),
  );
}

// ── Agent: Nia Robinson — Authority thought leadership ────────────────────────
async function runNiaVideoScript(): Promise<{ approvalId: string | null; result: string }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const brandMarks = await fetchBrandMarks();

  const buildPrompt = (feedback = '') => `${GENIUS_MODE}\n\nYou are Nia Robinson, Content Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.\nTRADEMARK RULES: Only use frameworks with ™. APPROVED: ${brandMarks}\nSERVICE CLASS RULES: Classes 35, 41, 42 only.\n\nFRAMEWORK REFERENCE — use exact definitions, never paraphrase or invent:\n${FRAMEWORK_KNOWLEDGE}\n${feedback ? `\nISABELLA COMPLIANCE FEEDBACK — fix these issues before rewriting:\n${feedback}\n` : ''}\nToday: ${today}\n\nWrite a 60-second avatar video script for DeAnna R. Upshaw.\nNia's angle: authority thought leadership. Position DeAnna as the expert senior leaders turn to when they need clarity on AI — not a tool vendor, not a coach, the strategic authority. One insight, one framework reference, one moment where the viewer thinks "she gets exactly where I am."\nCTA: assessment.druaiconsulting.com\n\nReturn ONLY valid JSON — no markdown fences, no preamble:\n{"script":"full word-for-word script DeAnna speaks to camera","treatment":"Nia direction: tone, pacing, authority level, visual note","linkedin_caption":"60-90 word LinkedIn caption","facebook_caption":"60-90 word Facebook caption","instagram_caption":"50-70 word Instagram caption with 5-7 hashtags"}`;

  return runWithIsabellaGate(
    'nia', 'Nia Robinson', 'Marketing',
    `🎬 Nia — Authority Script | ${today}`,
    `Authority thought leadership script — Nia Robinson | ${today}`,
    () => callHaiku(buildPrompt()),
    (reason) => callHaiku(buildPrompt(reason)),
  );
}

// ── Agent: Chloe Dubois — CTA-focused, conversion copy ───────────────────────
async function runChloeVideoScript(): Promise<{ approvalId: string | null; result: string }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const brandMarks = await fetchBrandMarks();

  const buildPrompt = (feedback = '') => `${GENIUS_MODE}\n\nYou are Chloe Dubois, Copy Writer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.\nTRADEMARK RULES: Only use frameworks with ™. APPROVED: ${brandMarks}\nSERVICE CLASS RULES: Classes 35, 41, 42 only.\n\nFRAMEWORK REFERENCE — use exact definitions, never paraphrase or invent:\n${FRAMEWORK_KNOWLEDGE}\n${feedback ? `\nISABELLA COMPLIANCE FEEDBACK — fix these issues before rewriting:\n${feedback}\n` : ''}\nToday: ${today}\n\nWrite a 60-second avatar video script for DeAnna R. Upshaw.\nChloe's angle: conversion copy. Every word earns its place. The hook creates urgency, the body removes the last objection standing between this viewer and taking action, the close makes assessment.druaiconsulting.com feel like the only logical next step. RGS energy — this script moves people.\n\nReturn ONLY valid JSON — no markdown fences, no preamble:\n{"script":"full word-for-word script DeAnna speaks to camera","treatment":"Chloe direction: CTA emphasis, pacing, energy level, visual note","linkedin_caption":"60-90 word LinkedIn caption","facebook_caption":"60-90 word Facebook caption","instagram_caption":"50-70 word Instagram caption with 5-7 hashtags"}`;

  return runWithIsabellaGate(
    'chloe', 'Chloe Dubois', 'Revenue, Growth & Sales',
    `🎬 Chloe — Conversion Script | ${today}`,
    `CTA conversion script — Chloe Dubois | ${today}`,
    () => callHaiku(buildPrompt()),
    (reason) => callHaiku(buildPrompt(reason)),
  );
}

// ── Agent: Zara Ahmed — Launch and momentum energy ────────────────────────────
async function runZaraVideoScript(): Promise<{ approvalId: string | null; result: string }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const brandMarks = await fetchBrandMarks();

  const buildPrompt = (feedback = '') => `${GENIUS_MODE}\n\nYou are Zara Ahmed, Product Launch Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.\nTRADEMARK RULES: Only use frameworks with ™. APPROVED: ${brandMarks}\nSERVICE CLASS RULES: Classes 35, 41, 42 only.\n\nFRAMEWORK REFERENCE — use exact definitions, never paraphrase or invent:\n${FRAMEWORK_KNOWLEDGE}\n${feedback ? `\nISABELLA COMPLIANCE FEEDBACK — fix these issues before rewriting:\n${feedback}\n` : ''}\nToday: ${today}\n\nWrite a 60-second avatar video script for DeAnna R. Upshaw.\nZara's angle: launch and momentum energy. Announcements, milestones, upcoming events, new offers. The script creates excitement and signals that something important is happening in DeAnna's world right now. Tie to a current or upcoming offer. CTA: assessment.druaiconsulting.com.\n\nReturn ONLY valid JSON — no markdown fences, no preamble:\n{"script":"full word-for-word script DeAnna speaks to camera","treatment":"Zara direction: launch energy, excitement level, visual note","linkedin_caption":"60-90 word LinkedIn caption","facebook_caption":"60-90 word Facebook caption","instagram_caption":"50-70 word Instagram caption with 5-7 hashtags"}`;

  return runWithIsabellaGate(
    'zara', 'Zara Ahmed', 'Revenue, Growth & Sales',
    `🎬 Zara — Launch Script | ${today}`,
    `Launch and momentum script — Zara Ahmed | ${today}`,
    () => callHaiku(buildPrompt()),
    (reason) => callHaiku(buildPrompt(reason)),
  );
}

// ── Agent: Amelia Santos — Transformation storytelling ───────────────────────
async function runAmeliaVideoScript(): Promise<{ approvalId: string | null; result: string }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const brandMarks = await fetchBrandMarks();

  const buildPrompt = (feedback = '') => `${GENIUS_MODE}\n\nYou are Amelia Santos, Training Video Producer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.\nTRADEMARK RULES: Only use frameworks with ™. APPROVED: ${brandMarks}\nSERVICE CLASS RULES: Classes 35, 41, 42 only.\n\nFRAMEWORK REFERENCE — use exact definitions, never paraphrase or invent:\n${FRAMEWORK_KNOWLEDGE}\n${feedback ? `\nISABELLA COMPLIANCE FEEDBACK — fix these issues before rewriting:\n${feedback}\n` : ''}\nToday: ${today}\n\nWrite a 60-second avatar video script for DeAnna R. Upshaw.\nAmelia's angle: transformation storytelling. A before state the viewer recognizes in themselves, a turning point built around one DRU framework or methodology, and an after state they can see themselves achieving. Educational, warm, credible — the viewer feels understood and sees a path forward. CTA: assessment.druaiconsulting.com.\n\nReturn ONLY valid JSON — no markdown fences, no preamble:\n{"script":"full word-for-word script DeAnna speaks to camera","treatment":"Amelia direction: storytelling pace, emotional arc, visual note","linkedin_caption":"60-90 word LinkedIn caption","facebook_caption":"60-90 word Facebook caption","instagram_caption":"50-70 word Instagram caption with 5-7 hashtags"}`;

  return runWithIsabellaGate(
    'amelia', 'Amelia Santos', 'Client Delivery',
    `🎬 Amelia — Transformation Script | ${today}`,
    `Transformation storytelling script — Amelia Santos | ${today}`,
    () => callHaiku(buildPrompt()),
    (reason) => callHaiku(buildPrompt(reason)),
  );
}

// ── Handler ───────────────────────────────────────────────────────────────────
const ROUTES: Record<string, () => Promise<{ approvalId: string | null; result: string }>> = {
  cron_darius_video_script: runDariusVideoScript,
  cron_nia_video_script:    runNiaVideoScript,
  cron_chloe_video_script:  runChloeVideoScript,
  cron_zara_video_script:   runZaraVideoScript,
  cron_amelia_video_script: runAmeliaVideoScript,
};

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

  const { trigger_type } = req.body ?? {};
  if (!trigger_type) { res.status(400).json({ error: 'trigger_type is required' }); return; }

  const runFn = ROUTES[trigger_type];
  if (!runFn) { res.status(400).json({ error: `Unknown trigger_type: ${trigger_type}` }); return; }

  console.log(`[travis-video-scripts] ${trigger_type} triggered`);
  try {
    const result = await runFn();
    res.status(202).json({ success: true, trigger_type, ...result });
  } catch (err: any) {
    console.error(`[travis-video-scripts] Unhandled error:`, err?.message ?? err);
    res.status(500).json({ error: err?.message ?? 'pipeline error' });
  }
}
