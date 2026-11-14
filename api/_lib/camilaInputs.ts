// DRU AI Leadership Ecosystem™ — api/_lib/camilaInputs.ts
// Camila Flores' weekly strategy: what she reads, how she picks the week's theme and sources,
// and the prompt she writes the brief from. Shared by api/ghl-agent-trigger.ts and
// api/ac-agent-trigger.ts so both files run the identical job.
//
// What Camila reads (raw words from the outside world, newest first, no date limit):
//   Aaliyah's prospect leads · social comments and the replies drafted (Dominique, Solange,
//   Isaiah Webb, Nadia, Elijah) · support requests (Isaiah Carter, Priscilla) · community
//   member comments and posts with the agents' replies (Marco, Zoe, Micah, Victor, Matthew,
//   Petra, Renata) · website chat questions · Nia's published pieces · her own last briefs.
// She works in two steps: (1) she picks the theme and up to 3 sources from the catalog of
// Supabase material, (2) the code pulls the text of those sources and she writes the brief.
// Step 1 is a forced tool call whose source numbers can only be numbers that exist in the
// catalog, so her pick always reads cleanly.

const IP_BUCKET = 'social-media-ip-content';
const EXTRACT_URL = 'https://app.druaiconsulting.com/api/extract-docx';
const MODEL = 'claude-haiku-4-5-20251001';
const ITEM_CHARS = 600;        // each comment, request, lead or reply is cut here
const OWN_BRIEF_CHARS = 2500;  // each of her own earlier briefs is cut here
const SOURCE_CHARS = 60000;    // each chosen source is cut here
const MAX_SOURCES = 3;

const IP_TITLES: Record<string, string> = {
  'dru-clear.docx': 'DRU CLEAR™',
  '5c-cultural-dna.docx': '5C Cultural DNA™',
  '5d-leadership.docx': '5D Leadership™',
  'ai-sales-mastery.docx': 'AI Sales Mastery™',
};

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type CatalogItem = { n: number; kind: 'ip' | 'licensed' | 'training'; title: string; ref: string };

function creds(): { url: string; key: string } | null {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

// One Supabase read. Returns [] when the read fails so one missing source never stops the others.
async function rest(path: string): Promise<Row[]> {
  const c = creds(); if (!c) return [];
  try {
    const res = await fetch(`${c.url}/rest/v1/${path}`, { headers: { apikey: c.key, Authorization: `Bearer ${c.key}` } });
    if (!res.ok) { console.error(`[camila-inputs] read failed (${res.status}): ${path.split('?')[0]}`); return []; }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) { console.error('[camila-inputs] read error:', err); return []; }
}

const cut = (s: unknown, n: number): string => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

// ─── The outside world, in its own words ──────────────────────────────────────────────────

async function aaliyahLeads(): Promise<string> {
  const rows = await rest('prospect_opportunities?order=found_at.desc&limit=8&select=prospect_name,organization,signal_summary,fit_reasoning');
  if (!rows.length) return '';
  return `AALIYAH FOSTER — newest prospect leads (real people and organizations found by live web search):\n` +
    rows.map(r => `- ${cut(r.prospect_name, 120)} (${cut(r.organization, 120)}): ${cut(r.signal_summary, ITEM_CHARS)} — ${cut(r.fit_reasoning, ITEM_CHARS)}`).join('\n');
}

async function socialComments(): Promise<string> {
  const rows = await rest('approvals?source=eq.social_response&order=created_at.desc&limit=15&select=agent_name,platform,original_content,output');
  if (!rows.length) return '';
  return `SOCIAL MEDIA RESPONSE TEAM — newest comments and messages from followers, with the reply drafted for each:\n` +
    rows.map(r => `- [${cut(r.platform, 40)} — handled by ${cut(r.agent_name, 60)}] "${cut(r.original_content, ITEM_CHARS)}" → reply drafted: "${cut(r.output, ITEM_CHARS)}"`).join('\n');
}

async function supportRequests(): Promise<string> {
  const rows = await rest('support_requests?order=created_at.desc&limit=10&select=category,member_tier,question');
  if (!rows.length) return '';
  return `SUPPORT REQUESTS (Isaiah Carter, Priscilla Okonkwo) — newest member questions:\n` +
    rows.map(r => `- [${cut(r.member_tier || 'unknown tier', 40)} — ${cut(r.category || 'general', 60)}] ${cut(r.question, ITEM_CHARS)}`).join('\n');
}

async function communityVoices(): Promise<string> {
  const comments = await rest('community_comments?member_id=not.is.null&is_flagged=not.is.true&order=created_at.desc&limit=15&select=id,content');
  const posts = await rest('community_posts?user_id=not.is.null&is_flagged=not.is.true&order=created_at.desc&limit=10&select=title,content');
  const ids = comments.map(c => c.id).filter(Boolean);
  const replies = ids.length ? await rest(`community_comments?parent_comment_id=in.(${ids.join(',')})&select=parent_comment_id,agent_name,content`) : [];
  const parts: string[] = [];
  if (comments.length) {
    parts.push(`COMMUNITY MEMBER COMMENTS (Marco, Zoe, Micah, Victor, Matthew, Petra, Renata) — newest first, with the replies given:\n` +
      comments.map(c => {
        const rs = replies.filter(r => r.parent_comment_id === c.id).map(r => `   ↳ ${cut(r.agent_name || 'agent', 60)}: ${cut(r.content, ITEM_CHARS)}`);
        return `- "${cut(c.content, ITEM_CHARS)}"${rs.length ? '\n' + rs.join('\n') : ''}`;
      }).join('\n'));
  }
  if (posts.length) {
    parts.push(`COMMUNITY MEMBER POSTS — newest first:\n` + posts.map(p => `- ${cut(p.title, 160)}: ${cut(p.content, ITEM_CHARS)}`).join('\n'));
  }
  return parts.join('\n\n');
}

async function websiteChat(): Promise<string> {
  const rows = await rest('website_chat_questions?order=created_at.desc&limit=15&select=question,language');
  if (!rows.length) return '';
  return `WEBSITE CHAT — newest questions visitors asked on druaiconsulting.com:\n` +
    rows.map(r => `- [${cut(r.language || 'en', 8)}] ${cut(r.question, ITEM_CHARS)}`).join('\n');
}

async function niaPublished(): Promise<string> {
  const rows = await rest('content_theme_log?agent_id=eq.nia&order=created_at.desc&limit=15&select=format,theme,framework_covered,hook');
  if (!rows.length) return '';
  return `NIA ROBINSON (Marketing) — newest pieces she published:\n` +
    rows.map(r => `- [${cut(r.format, 60)}] ${cut(r.theme, ITEM_CHARS)}${r.framework_covered ? ` (${cut(r.framework_covered, 80)})` : ''}${r.hook ? ` | Hook: "${cut(r.hook, ITEM_CHARS)}"` : ''}`).join('\n');
}

async function ownBriefs(): Promise<string> {
  const rows = await rest('chief_of_staff_queue?agent_id=eq.camila&order=created_at.desc&limit=4&select=raw_output,run_date,context');
  if (!rows.length) return '';
  return rows.map(r => `[${cut(r.run_date, 20)}${r.context ? ` — ${cut(r.context, 160)}` : ''}]\n${String(r.raw_output ?? '').slice(0, OWN_BRIEF_CHARS)}`).join('\n\n---\n\n');
}

export async function readOutsideWords(): Promise<{ outside: string; own: string }> {
  const [leads, social, support, community, chat, nia, own] = await Promise.all([
    aaliyahLeads(), socialComments(), supportRequests(), communityVoices(), websiteChat(), niaPublished(), ownBriefs(),
  ]);
  return { outside: [leads, social, support, community, chat, nia].filter(Boolean).join('\n\n'), own };
}

// ─── The catalog of Supabase source material ──────────────────────────────────────────────

export async function buildCatalog(): Promise<{ text: string; items: CatalogItem[] }> {
  const c = creds();
  const items: CatalogItem[] = [];
  const blocks: string[] = [];
  let n = 0;

  // Her own framework documents (the bucket she uploads to).
  if (c) {
    try {
      const res = await fetch(`${c.url}/storage/v1/object/list/${IP_BUCKET}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: c.key, Authorization: `Bearer ${c.key}` },
        body: JSON.stringify({ prefix: '', limit: 100, sortBy: { column: 'name', order: 'asc' } }),
      });
      if (res.ok) {
        const files = (await res.json()) as Row[];
        const lines: string[] = [];
        for (const f of Array.isArray(files) ? files : []) {
          const name = String(f?.name ?? '');
          if (!name.toLowerCase().endsWith('.docx')) continue;
          const title = IP_TITLES[name] ?? name;
          n++; items.push({ n, kind: 'ip', title, ref: name }); lines.push(`[${n}] ${title}`);
        }
        if (lines.length) blocks.push(`DeAnna's own framework documents (her writing, EQ-first):\n${lines.join('\n')}`);
      }
    } catch (err) { console.error('[camila-inputs] framework list error:', err); }
  }

  // The licensed course library (already extracted to text in Supabase).
  const lic = await rest('licensed_course_materials?status=eq.processed&order=bundle.asc,licensed_title.asc&limit=500&select=id,bundle,licensed_title');
  if (lic.length) {
    const lines = lic.map(r => { n++; const title = `${r.bundle} — ${r.licensed_title}`; items.push({ n, kind: 'licensed', title, ref: String(r.id) }); return `[${n}] ${title}`; });
    blocks.push(`Licensed course library:\n${lines.join('\n')}`);
  }

  // Training material (the DISC Sales Assessment).
  const tr = await rest('training_materials?status=eq.processed&limit=100&select=id,original_filename');
  if (tr.length) {
    const lines = tr.map(r => { n++; const title = String(r.original_filename).replace(/\.[a-z0-9]+$/i, ''); items.push({ n, kind: 'training', title, ref: String(r.id) }); return `[${n}] ${title}`; });
    blocks.push(`Training material:\n${lines.join('\n')}`);
  }

  return { text: blocks.join('\n\n'), items };
}

async function ipDocText(filename: string): Promise<string> {
  const c = creds(); if (!c) return '';
  try {
    const fileRes = await fetch(`${c.url}/storage/v1/object/${IP_BUCKET}/${encodeURIComponent(filename)}`, { headers: { apikey: c.key, Authorization: `Bearer ${c.key}` } });
    if (!fileRes.ok) return '';
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const extractRes = await fetch(EXTRACT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: buffer.toString('base64'), filename }) });
    if (!extractRes.ok) return '';
    const parsed = (await extractRes.json()) as { text?: string };
    return parsed.text || '';
  } catch { return ''; }
}

async function sourceText(item: CatalogItem): Promise<string> {
  if (item.kind === 'ip') return ipDocText(item.ref);
  const table = item.kind === 'licensed' ? 'licensed_course_materials' : 'training_materials';
  const rows = await rest(`${table}?id=eq.${item.ref}&select=extracted_text`);
  return String(rows[0]?.extracted_text ?? '');
}

// ─── Step 1: she picks the week's theme and sources ───────────────────────────────────────

async function logUsage(inputTokens: number, outputTokens: number, durationMs: number): Promise<void> {
  const c = creds(); if (!c) return;
  const cost_usd = (inputTokens / 1_000_000) * 1 + (outputTokens / 1_000_000) * 5;
  await fetch(`${c.url}/rest/v1/model_usage_log`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: c.key, Authorization: `Bearer ${c.key}` },
    body: JSON.stringify({ source_file: 'camila-inputs', model: MODEL, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd, duration_ms: durationMs }),
  }).catch(() => {});
}

// A forced tool call: the reply is always the theme text plus source numbers drawn from the
// catalog, so there is no free-form answer for the code to misread.
async function chooseWeek(prompt: string, catalogSize: number): Promise<{ theme: string; picks: number[] } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error('[camila-inputs] ANTHROPIC_API_KEY not set'); return null; }
  const properties: Record<string, unknown> = {
    theme: { type: 'string', minLength: 3, description: "A short title for this week's theme, in your own words." },
  };
  const required = ['theme'];
  if (catalogSize > 0) {
    properties.sources = {
      type: 'array', minItems: 1, maxItems: MAX_SOURCES, uniqueItems: true,
      items: { type: 'integer', enum: Array.from({ length: catalogSize }, (_, i) => i + 1) },
      description: `The catalog numbers (1 to ${MAX_SOURCES} of them) this week's theme draws from.`,
    };
    required.push('sources');
  }
  const startedAt = Date.now();
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 800,
        tools: [{ name: 'choose_week', description: "Record this week's theme and the catalog sources it draws from.", input_schema: { type: 'object', properties, required } }],
        tool_choice: { type: 'tool', name: 'choose_week' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) { console.error(`[camila-inputs] choose_week call failed: ${res.status} ${await res.text()}`); return null; }
    const data = await res.json();
    await logUsage(data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0, Date.now() - startedAt);
    const block = (data.content ?? []).find((b: Row) => b?.type === 'tool_use');
    const input = block?.input as { theme?: unknown; sources?: unknown } | undefined;
    const theme = String(input?.theme ?? '').trim();
    const picks = Array.isArray(input?.sources)
      ? Array.from(new Set((input!.sources as unknown[]).map(Number).filter(v => Number.isInteger(v) && v >= 1 && v <= catalogSize))).slice(0, MAX_SOURCES)
      : [];
    return { theme, picks };
  } catch (err) { console.error('[camila-inputs] choose_week error:', err); return null; }
}

// ─── Both steps, ending with the prompt for the brief ─────────────────────────────────────

export async function prepareCamilaWeek(opts: { today: string; positioning: string; voiceDna: string }): Promise<{ prompt: string; theme: string; sources: string[] } | null> {
  const [{ outside, own }, catalog] = await Promise.all([readOutsideWords(), buildCatalog()]);
  if (!outside && !own && catalog.items.length === 0) { console.error('[camila-inputs] nothing to read and no catalog — no brief written'); return null; }

  const intro = `You are Camila Flores, Social Media Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Her positioning is "${opts.positioning}." Today: ${opts.today}.`;
  const outsideBlock = outside || 'No outside words have been recorded yet. This week is led by the theme and source material you choose from the catalog.';
  const ownBlock = own || 'No earlier briefs on record.';

  const pickPrompt = `${intro}

Your job in this step: choose this week's theme and the sources it draws from.

WHAT THE OUTSIDE WORLD IS SAYING — raw words, newest first:
${outsideBlock}

YOUR OWN RECENT BRIEFS (for continuity):
${ownBlock}

CATALOG OF SOURCE MATERIAL (choose by number):
${catalog.text || '(the catalog is empty)'}

Call choose_week with this week's theme title and the numbers of the catalog sources it draws from.`;

  const choice = await chooseWeek(pickPrompt, catalog.items.length);
  if (!choice) return null;
  const chosen = choice.picks.map(p => catalog.items[p - 1]).filter(Boolean);
  const theme = choice.theme || chosen[0]?.title || '';
  if (!theme) { console.error('[camila-inputs] no theme came back — no brief written'); return null; }

  const texts = await Promise.all(chosen.map(async it => ({ title: it.title, text: (await sourceText(it)).slice(0, SOURCE_CHARS) })));
  const withText = texts.filter(t => t.text);
  const sourceBlock = withText.length
    ? `\n\nSOURCE MATERIAL you chose for this week:\n\n${withText.map(t => `— ${t.title} —\n${t.text}`).join('\n\n')}\n\nGround everything you write this week in this material's own words and tone. Where the material is DeAnna's own writing, keep its EQ-first tone and blend the AI angle on top of it.`
    : '';
  const sourceTitles = chosen.map(c => c.title);

  const prompt = `${opts.voiceDna}

${intro}

THIS WEEK'S THEME (your own choice): ${theme}${sourceBlock}

WHAT THE OUTSIDE WORLD IS SAYING — raw words from prospects, followers, members, support requests, website chat visitors and Nia's published pieces. Use them to choose which audience each day speaks to, the language that will land with them, and where urgency matters most this week:
${outsideBlock}

YOUR OWN RECENT BRIEFS (for continuity):
${ownBlock}

Begin the brief with these two lines, exactly as written:
THEME: ${theme}
SOURCES: ${sourceTitles.length ? sourceTitles.join(' | ') : 'none'}

Write this week's FULL CONTENT STRATEGY BRIEF for Darius King and Nia Robinson, carrying the theme through every format as one cohesive story.

## THIS WEEK'S THROUGHLINE
Write one or two sentences connecting all seven days into a single story, built from the theme and the source material's own language.

## DARIUS KING — Daily Social Posts (Mon/Tue/Thu/Fri)
Day-by-day direction for Darius:
- Monday: audience angle
- Tuesday: audience angle
- Thursday: audience angle
- Friday: audience angle
Name the audience each day speaks to. CTA alignment: all posts drive to assessment.druaiconsulting.com

## NIA ROBINSON — Thought Leadership & Newsletter (Wed/Thu/Fri/Sat/Sun)
Match each day's structure to the theme:
- Wednesday LinkedIn post angle (200-300 words, educational)
- Thursday LEAD, CLARITY, WIN! Newsletter theme for all 3 editions:
  · Non-member edition: what problem to surface, how deep to go, hook direction
  · Navigator edition: which framework concept to apply, what action step to suggest
  · Accelerator edition: which strategic implementation angle to take
- Friday native article topic and angle (500-700 words)
- Saturday LinkedIn post angle (framework spotlight direction)
- Sunday LinkedIn post angle (executive insight direction)

## KEY MESSAGES TO AMPLIFY
Name what should dominate messaging this week, based on the outside words above.

Every framework reference carries its ™.`;

  return { prompt, theme, sources: sourceTitles };
}

// ─── For Darius, Nia and the other weekly producers ───────────────────────────────────────

// Camila's newest brief with no date limit, plus the theme title she saved with it.
// The theme title rides on the cards of everyone who produces content that week.
export async function getLatestCamilaBrief(maxChars = 12000): Promise<{ brief: string; theme: string }> {
  const rows = await rest('chief_of_staff_queue?agent_id=eq.camila&order=created_at.desc&limit=1&select=raw_output,context');
  const r = rows[0];
  return { brief: r ? String(r.raw_output ?? '').slice(0, maxChars) : '', theme: r?.context ? String(r.context) : '' };
}
