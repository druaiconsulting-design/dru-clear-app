// DRU AI Leadership Ecosystem™ — api/generate-daily.ts
// Generates fresh Daily Connections content for all 5 pathway stages
// Called by pg_cron at 12:00 UTC daily via Vercel edge

export const config = { maxDuration: 60 };

const STAGES = ['discover', 'diagnose', 'design', 'deploy', 'dominate'];

const FRAMEWORKS_BY_DAY = [
  'From Confusion to Confident with AI™',  // Sunday
  'DRU CLEAR™',                             // Monday
  'DRU AI Leadership Ecosystem™',           // Tuesday
  'DRU AI Transformation Pathway™',         // Wednesday
  '5D Leadership™',                         // Thursday
  '5C Cultural DNA™',                       // Friday
  'AI Sales Mastery™',                      // Saturday
];

const PILLARS_BY_DAY = [
  'Confidence',     // Sunday
  'Clarity',        // Monday
  'Ecosystem',      // Tuesday
  'Transformation', // Wednesday
  'Development',    // Thursday
  'Culture',        // Friday
  'Execution',      // Saturday
];

const STAGE_CONTEXT: Record<string, string> = {
  discover:  'The executive has just completed the DRU CLEAR™ AI Readiness Assessment. They are in the awareness phase — understanding where they are, what is possible, and building confidence to begin.',
  diagnose:  'The executive is doing deep diagnostic work on their organizational AI readiness. They are naming gaps, analyzing barriers, and gathering the intelligence needed to move forward.',
  design:    'The executive is architecting their AI transformation strategy. They are moving from diagnosis to building a concrete roadmap aligned with their business goals and team capacity.',
  deploy:    'The executive is actively implementing AI solutions. They are in execution mode — managing adoption, overcoming change resistance, and integrating AI into daily operations.',
  dominate:  'The executive has deployed AI successfully and is now scaling, optimizing, and building lasting competitive advantage through AI mastery and ecosystem leadership.',
};

const STAGE_LABELS: Record<string, string> = {
  discover: 'Discover',
  diagnose: 'Diagnose',
  design:   'Design',
  deploy:   'Deploy',
  dominate: 'Dominate',
};

async function callSonnet(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

async function writeToSupabase(record: Record<string, unknown>): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const res = await fetch(`${url}/rest/v1/daily_content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(record),
  });
  return res.ok;
}

async function getExistingStages(today: string): Promise<Set<string>> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Set();
  const res = await fetch(`${url}/rest/v1/daily_content?content_date=eq.${today}&select=stage`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return new Set();
  const data = await res.json();
  return new Set((data as { stage: string }[]).map(r => r.stage));
}

async function generateStageContent(
  stage: string, framework: string, badge: string, dateLabel: string
): Promise<{ insight: string; lesson: string; challenge: string; strategic_edge: string } | null> {
  const prompt = `You are DeAnna R. Upshaw's AI content engine for the DRU AI Leadership Ecosystem™ Daily Connections feature.

Today: ${dateLabel}
Featured Framework: ${framework}
Pathway Stage: ${STAGE_LABELS[stage]}
Stage Context: ${STAGE_CONTEXT[stage]}

Generate premium daily content for an executive at the ${STAGE_LABELS[stage]} stage of the DRU AI Transformation Pathway™ (Discover → Diagnose → Design → Deploy → Dominate).

TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™

CONTENT RULES:
- Write as DeAnna speaking directly to the executive ("You are..." / "Your team..." / "I've seen...")
- Content must feel fresh and specific to today — reference ${framework} naturally
- Each field must be distinct — insight is wisdom, lesson is teaching, challenge is action, strategic_edge is advanced thinking
- Never repeat the same framing across fields

Return ONLY valid JSON with no markdown, no preamble, no backticks:
{
  "insight": "2-3 powerful sentences of stage-specific wisdom. Speak directly to the executive. Reference ${framework} naturally.",
  "lesson": "3-4 sentences of deeper teaching tied to ${framework} and the ${STAGE_LABELS[stage]} stage. Name a specific leadership principle executives at this stage commonly face. End with a forward-looking statement.",
  "challenge": "[15 minutes] One specific executable action the executive can take TODAY. Make it concrete — open a specific tool, have a specific conversation, write something specific. Tie it directly to their ${STAGE_LABELS[stage]} stage.",
  "strategic_edge": "1-2 sentences of advanced insight for executives thinking three moves ahead. Sharp, strategic, and not obvious. This is the Accelerator tier exclusive."
}`;

  try {
    const raw = await callSonnet(prompt);
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (err) {
    console.error(`[generate-daily] Failed for stage ${stage}:`, err);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cron-secret');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const incomingSecret = req.headers['x-cron-secret'];
  if (incomingSecret !== undefined && incomingSecret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }

  const today      = new Date().toISOString().split('T')[0];
  const dayOfWeek  = new Date().getDay();
  const framework  = FRAMEWORKS_BY_DAY[dayOfWeek];
  const pillar     = PILLARS_BY_DAY[dayOfWeek];
  const badge      = `${framework} · Pillar: ${pillar}`;
  const dateLabel  = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Chicago',
  });

  try {
    const existingStages   = await getExistingStages(today);
    const stagesToGenerate = STAGES.filter(s => !existingStages.has(s));

    if (stagesToGenerate.length === 0) {
      res.status(200).json({ success: true, message: 'Content already generated for today', date: today });
      return;
    }

    // Generate all stages in parallel
    const results = await Promise.all(
      stagesToGenerate.map(async stage => {
        const content = await generateStageContent(stage, framework, badge, dateLabel);
        if (!content) return { stage, success: false };
        const ok = await writeToSupabase({
          content_date:   today,
          stage,
          insight:        content.insight,
          lesson:         content.lesson,
          lesson_badge:   badge,
          challenge:      content.challenge,
          strategic_edge: content.strategic_edge,
          generated_at:   new Date().toISOString(),
        });
        console.log(`[generate-daily] ${ok ? '✓' : '✗'} ${stage}`);
        return { stage, success: ok };
      })
    );

    const generated = results.filter(r => r.success).map(r => r.stage);
    const failed    = results.filter(r => !r.success).map(r => r.stage);

    res.status(202).json({
      success:          true,
      date:             today,
      framework,
      pillar,
      stages_generated: generated,
      stages_skipped:   [...existingStages],
      stages_failed:    failed,
    });

  } catch (err) {
    console.error('[generate-daily] Fatal error:', err);
    res.status(500).json({ success: false, error: String(err) });
  }
}
