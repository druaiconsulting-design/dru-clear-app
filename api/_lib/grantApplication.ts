// api/_lib/grantApplication.ts
// Nov 28, 2026 -- built per DeAnna's direction. Every grant application is built
// from the funder's own application questions. This file holds the shared pieces
// used by api/process-on-demand.ts (Kwame's first draft and the Chloe/Isabella
// review) and api/grant-resume.ts (Kwame's revision after DeAnna replies):
//   1. findFunderQuestions -- reads the funder's pages in full (the saved page link,
//      the guidelines, FAQ and application pages it points to, and any PDF form),
//      saves the funder's questions and required documents, word for word.
//   2. assemble/parse helpers -- the funder's question lines are written by code
//      from the saved list, so no review or revision can reword, drop, reorder or
//      add to them.
//   3. The card builders -- the complete application, question by question, with
//      Kwame's answer or a "Needs your feedback" ask under each funder question.


const SUPABASE_URL  = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

export interface FunderQuestion { number: number; question: string }
export type FunderQuestionsStatus = 'found' | 'portal_only' | 'not_found';
export interface FunderQuestionsResult {
  status: FunderQuestionsStatus;
  questions: FunderQuestion[];
  documents: string[];
  sourceUrl: string | null;
  note: string;
}

// ─── Small shared helpers ────────────────────────────────────────────────────

function extractJSON(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

async function logModelUsage(inputTokens: number, outputTokens: number): Promise<void> {
  const cost_usd = (inputTokens / 1_000_000) * 1 + (outputTokens / 1_000_000) * 5;
  await fetch(`${SUPABASE_URL}/rest/v1/model_usage_log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify({ source_file: 'grant-application-questions', model: 'claude-haiku-4-5-20251001', input_tokens: inputTokens, output_tokens: outputTokens, cost_usd }),
  }).catch(() => {});
}

async function callHaiku(prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic Haiku error ${res.status}`);
  const data = await res.json();
  await logModelUsage(data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0);
  return data.content?.[0]?.text ?? '';
}

// ─── Reading what is saved on a grant row ────────────────────────────────────

export function getFunderQuestions(grantRow: Record<string, unknown> | null): FunderQuestion[] {
  const raw = grantRow?.funder_application_questions;
  if (!Array.isArray(raw)) return [];
  const out: FunderQuestion[] = [];
  for (const item of raw as unknown[]) {
    const q = item as { number?: unknown; question?: unknown };
    const question = String(q?.question ?? '').replace(/\s+/g, ' ').trim();
    const number = Number(q?.number);
    if (question && Number.isFinite(number)) out.push({ number, question });
  }
  return out.sort((a, b) => a.number - b.number);
}

export function getFunderDocuments(grantRow: Record<string, unknown> | null): string[] {
  const raw = grantRow?.funder_required_documents;
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).map(d => String(d ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// ─── Reading the funder's pages ──────────────────────────────────────────────

interface FetchedPage { url: string; text: string; links: { text: string; href: string }[] }

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&ndash;|&mdash;/g, '-')
    .replace(/&#(\d+);/g, (_m, n) => { try { return String.fromCodePoint(Number(n)); } catch { return ' '; } });
}

function htmlToText(html: string): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|h[1-6]|tr|ul|ol|table|section|article|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(cleaned)
    .split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
}

function extractLinks(html: string, baseUrl: string): { text: string; href: string }[] {
  const links: { text: string; href: string }[] = [];
  const seen = new Set<string>();
  const re = /<a\s[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const abs = new URL(decodeEntities(m[1]), baseUrl);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') continue;
      abs.hash = '';
      const href = abs.toString();
      if (seen.has(href)) continue;
      seen.add(href);
      const text = decodeEntities(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
      links.push({ text: text || '(no link text)', href });
    } catch { /* skip malformed link */ }
  }
  return links;
}

async function fetchPage(url: string): Promise<FetchedPage | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DRUAIConsultingGrantResearch/1.0)', Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5' },
    });
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') ?? '').toLowerCase();
    if (type.includes('pdf') || /\.pdf(\?|$)/i.test(url)) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 15_000_000) return null;
      // Loaded only when a PDF is read, so the rest of the chain never depends on it.
      // @ts-ignore -- the library's inner file has no type declarations
      const pdfModule = await import('pdf-parse/lib/pdf-parse.js');
      const pdfParse = (pdfModule.default ?? pdfModule) as (data: Buffer) => Promise<{ text?: string }>;
      const parsed = await pdfParse(buf);
      return { url: res.url || url, text: String(parsed.text ?? '').split('\n').map(l => l.trim()).filter(Boolean).join('\n'), links: [] };
    }
    if (!type.includes('html') && !type.includes('text')) return null;
    const html = await res.text();
    return { url: res.url || url, text: htmlToText(html), links: extractLinks(html, res.url || url) };
  } catch (error) {
    console.warn(`[grant-questions] Could not read ${url}:`, error instanceof Error ? error.message : error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Verifying the funder's wording against the page text ────────────────────

function normalizeForMatch(s: string): string {
  return s.toLowerCase()
    .replace(/[‘’‛]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// A question counts as the funder's own wording when it appears in the pages
// that were read -- exactly, or (for long questions) when nearly all of its
// four-word runs appear there.
function appearsInPages(question: string, pagesNorm: string): boolean {
  const qn = normalizeForMatch(question);
  if (!qn) return false;
  if (pagesNorm.includes(qn)) return true;
  const words = qn.split(' ');
  if (words.length < 6) return false;
  let total = 0; let hits = 0;
  for (let i = 0; i + 4 <= words.length; i++) {
    total++;
    if (pagesNorm.includes(words.slice(i, i + 4).join(' '))) hits++;
  }
  return total > 0 && hits / total >= 0.85;
}

// ─── Finding the funder's questions ──────────────────────────────────────────

const URL_IN_TEXT = /https?:\/\/[^\s<>"')\]]+/gi;

async function pickPages(grantRow: Record<string, unknown>, start: FetchedPage): Promise<string[]> {
  if (start.links.length === 0) return [];
  const linkList = start.links.slice(0, 160).map((l, i) => `${i + 1}. ${l.text.slice(0, 90)} | ${l.href}`).join('\n');
  const prompt = `You are helping find where a funder publishes its application questions.\n\nGRANT: ${grantRow.opportunity_name ?? ''}\nFUNDER: ${grantRow.funder ?? ''}\n\nTHE PAGE ALREADY OPEN (${start.url}) BEGINS:\n${start.text.slice(0, 2500)}\n\nLINKS ON THAT PAGE:\n${linkList}\n\nChoose up to 5 links most likely to hold this grant's application questions, application form, grant guidelines, checklist, or FAQ, including PDF forms. Choose from the list only.\n\nRespond with ONLY a single JSON object, no preamble, no markdown fences:\n{"urls": ["https://...", "https://..."]}`;
  try {
    const raw = await callHaiku(prompt, 600);
    const parsed = extractJSON(raw) as { urls?: unknown } | null;
    const allowed = new Set(start.links.map(l => l.href));
    return (Array.isArray(parsed?.urls) ? parsed!.urls as unknown[] : [])
      .map(u => String(u)).filter(u => allowed.has(u)).slice(0, 5);
  } catch (error) {
    console.warn('[grant-questions] Page picking failed:', error);
    return [];
  }
}

async function findFunderQuestionsInner(grantRow: Record<string, unknown>, researchText: string): Promise<FunderQuestionsResult> {
  const startUrl = String(grantRow.source_url ?? '').trim();
  const pages: FetchedPage[] = [];
  const have = new Set<string>();
  const add = (p: FetchedPage | null) => { if (p && p.text.length > 80 && !have.has(p.url)) { have.add(p.url); pages.push(p); } };

  let startPage: FetchedPage | null = null;
  if (/^https?:\/\//i.test(startUrl)) {
    startPage = await fetchPage(startUrl);
    add(startPage);
  }

  const followUrls: string[] = [];
  if (startPage) followUrls.push(...await pickPages(grantRow, startPage));
  // Pages named in Kwame's earlier web research.
  const fromResearch = (researchText.match(URL_IN_TEXT) ?? []).map(u => u.replace(/[.,;:]+$/, ''));
  for (const u of fromResearch) { if (followUrls.length < 8 && !followUrls.includes(u)) followUrls.push(u); }

  const fetched = await Promise.all(followUrls.filter(u => !have.has(u)).slice(0, 8).map(u => fetchPage(u)));
  fetched.forEach(add);

  if (pages.length === 0) {
    return { status: 'not_found', questions: [], documents: [], sourceUrl: startUrl || null, note: "The funder's pages could not be opened this time." };
  }

  const PAGE_CAP = 30000; const TOTAL_CAP = 90000;
  let used = 0;
  const labeled: string[] = [];
  const includedText: string[] = [];
  for (const p of pages) {
    const room = Math.min(PAGE_CAP, TOTAL_CAP - used);
    if (room <= 0) break;
    const t = p.text.slice(0, room);
    used += t.length;
    labeled.push(`=== PAGE: ${p.url} ===\n${t}`);
    includedText.push(t);
  }
  const pagesNorm = normalizeForMatch(includedText.join('\n'));

  const prompt = `You are reading a funder's own pages to find the questions an applicant must answer.\n\nGRANT: ${grantRow.opportunity_name ?? ''}\nFUNDER: ${grantRow.funder ?? ''}\n\n${labeled.join('\n\n')}\n\nFind the funder's application questions: the prompts, sections, or items the applicant is asked to answer or write about, in the funder's order. Copy each one exactly as the funder words it, character for character, leaving out only list numbering. Where the funder groups questions under headings, keep the funder's order and number them 1, 2, 3 straight through.\n\nAlso list the documents the funder requires with the application (for example formation papers, quotes, financial statements).\n\nSet status as follows:\n- "found" when the pages state the application questions.\n- "portal_only" when the pages say the questions appear only after logging in to, or starting, the funder's online application portal.\n- "not_found" when the pages state neither.\n\nRespond with ONLY a single JSON object, no preamble, no markdown fences:\n{\n  "status": "found" | "portal_only" | "not_found",\n  "questions": [{"number": 1, "question": "..."}],\n  "required_documents": ["..."],\n  "questions_page_url": "the page address where the questions appear, or empty",\n  "note": "one plain sentence about what was found"\n}`;

  interface Extraction { status?: string; questions?: { number?: number; question?: string }[]; required_documents?: string[]; questions_page_url?: string; note?: string }
  let parsed = null as Extraction | null;
  try {
    const raw = await callHaiku(prompt, 6000);
    parsed = extractJSON(raw) as Extraction | null;
  } catch (error) {
    console.error('[grant-questions] Extraction call failed:', error);
  }
  if (!parsed) {
    return { status: 'not_found', questions: [], documents: [], sourceUrl: startUrl || null, note: "The funder's pages were read but the questions could not be pulled out this time." };
  }

  const candidate: FunderQuestion[] = (parsed.questions ?? [])
    .map((q, i) => ({ number: Number.isFinite(Number(q?.number)) && Number(q?.number) > 0 ? Number(q?.number) : i + 1, question: String(q?.question ?? '').replace(/\s+/g, ' ').trim() }))
    .filter(q => q.question);
  const verified = candidate.filter(q => appearsInPages(q.question, pagesNorm));
  const documents = (parsed.required_documents ?? []).map(d => String(d ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const pageUrl = String(parsed.questions_page_url ?? '').trim();
  const sourceUrl = /^https?:\/\//i.test(pageUrl) ? pageUrl : (startUrl || pages[0].url);

  // Every question must be the funder's own wording. When any question cannot be
  // matched to the pages, the list is not trusted.
  if (candidate.length > 0 && verified.length === candidate.length) {
    return {
      status: 'found',
      questions: verified.map((q, i) => ({ number: i + 1, question: q.question })),
      documents,
      sourceUrl,
      note: String(parsed.note ?? '').trim() || "The funder's application questions were found on the funder's pages.",
    };
  }
  if (candidate.length > 0) {
    return { status: 'not_found', questions: [], documents: [], sourceUrl, note: "Questions were found, but their wording could not be matched to the funder's pages, so none were saved." };
  }
  const status: FunderQuestionsStatus = parsed.status === 'portal_only' ? 'portal_only' : 'not_found';
  return { status, questions: [], documents, sourceUrl, note: String(parsed.note ?? '').trim() || (status === 'portal_only' ? "The funder shows its questions only inside its application portal." : "The funder's pages do not state the application questions.") };
}

// Finds the funder's questions and saves them on the grant row. A saved list
// is reused on later drafts of the same grant.
export async function findFunderQuestions(grantRow: Record<string, unknown>, researchText: string): Promise<FunderQuestionsResult> {
  const existing = getFunderQuestions(grantRow);
  if (existing.length > 0 && grantRow.funder_questions_status === 'found') {
    return { status: 'found', questions: existing, documents: getFunderDocuments(grantRow), sourceUrl: String(grantRow.funder_questions_source_url ?? '') || null, note: String(grantRow.funder_questions_note ?? '') };
  }
  let result: FunderQuestionsResult;
  try {
    result = await Promise.race([
      findFunderQuestionsInner(grantRow, researchText),
      new Promise<FunderQuestionsResult>(resolve => setTimeout(() => resolve({ status: 'not_found', questions: [], documents: [], sourceUrl: String(grantRow.source_url ?? '') || null, note: "Reading the funder's pages took too long this time." }), 75000)),
    ]);
  } catch (error) {
    console.error('[grant-questions] Finding the funder questions failed:', error);
    result = { status: 'not_found', questions: [], documents: [], sourceUrl: String(grantRow.source_url ?? '') || null, note: "The funder's pages could not be read this time." };
  }
  if (grantRow.id) {
    await fetch(`${SUPABASE_URL}/rest/v1/grant_opportunities?id=eq.${String(grantRow.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({
        funder_application_questions: result.questions,
        funder_required_documents: result.documents,
        funder_questions_source_url: result.sourceUrl,
        funder_questions_status: result.status,
        funder_questions_note: result.note,
        funder_questions_checked_at: new Date().toISOString(),
      }),
    }).catch(err => console.error('[grant-questions] Saving the funder questions failed:', err));
  }
  return result;
}

export function withFunderQuestions(grantRow: Record<string, unknown> | null, result: FunderQuestionsResult): Record<string, unknown> | null {
  if (!grantRow) return grantRow;
  return {
    ...grantRow,
    funder_application_questions: result.questions,
    funder_required_documents: result.documents,
    funder_questions_source_url: result.sourceUrl,
    funder_questions_status: result.status,
    funder_questions_note: result.note,
  };
}

// ─── Instructions given to Kwame, Chloe and Isabella ─────────────────────────

// Used in place of the general [DEANNA: ...] guidance whenever the funder's
// questions are known, so asks follow the funder's questions.
export const DEANNA_MARKER_FOR_FUNDER_QUESTIONS = `When a numbered funder question calls for something specific that lives outside the facts given -- a vendor, an exact cost, a date, a concrete client story, a metric -- ask DeAnna for it directly, inside that question's answer, at the spot it belongs: [DEANNA: ...]. Name exactly what that numbered question needs. The funder's questions decide what the application contains, so asks stay tied to what each question requests. Write the surrounding sentences so the answer reads as complete and confident with her reply dropped in.`;

export function funderQuestionsForKwame(grantRow: Record<string, unknown> | null): string {
  const qs = getFunderQuestions(grantRow);
  if (qs.length === 0) return '';
  const docs = getFunderDocuments(grantRow);
  const list = qs.map(q => `${q.number}. ${q.question}`).join('\n');
  const docLine = docs.length > 0 ? `\n\nThe funder also requires these documents, which DeAnna gathers herself (no answer needed here):\n${docs.map(d => `- ${d}`).join('\n')}` : '';
  return `THE FUNDER'S APPLICATION QUESTIONS (the funder's own wording, in the funder's order):\n${list}${docLine}\n\nThe application is exactly these questions. Write one answer for each number, in this order. Each answer speaks to what its question asks, using the real facts above. Honor any word or character limit written into a question. Where a question does not apply to DRU AI Consulting, answer N/A with a short reason. The budget categories among the facts apply when a question asks for a budget. The funder's question lines are added to the application by the system, so your answers carry the text only.`;
}

export function funderQuestionsReviewerNote(grantRow: Record<string, unknown> | null): string {
  const qs = getFunderQuestions(grantRow);
  if (qs.length === 0) return '';
  const list = qs.map(q => `${q.number}. ${q.question}`).join('\n');
  return `\n\nTHE FUNDER'S APPLICATION QUESTIONS: this draft is organized under the funder's own numbered questions, listed here. The question lines in the draft are the funder's wording and stay as they are. Review the answers under each question, and check that every numbered question has an answer that addresses it. Ask for changes to answers, within the questions the funder asks.\n${list}`;
}

// Chloe's R.E.A.L. check, scoped to the funder's questions. R.E.A.L. stays the standard
// for how each answer is written; the funder's questions decide what the application holds.
export function funderQuestionsChloeScope(grantRow: Record<string, unknown> | null): string {
  if (getFunderQuestions(grantRow).length === 0) return '';
  return `\n\nSCOPE OF YOUR REVIEW: R.E.A.L. is judged inside the answers to the funder's numbered questions. An R.E.A.L. element counts where a funder question gives it room. An element with no funder question to live in is left alone, and the application keeps exactly the funder's questions. Each correction note names the question number it belongs to and asks for changes to that answer.`;
}

export function chloeHitsRealMeaning(grantRow: Record<string, unknown> | null): string {
  if (getFunderQuestions(grantRow).length === 0) return 'true only if the draft fully satisfies all four R.E.A.L. elements';
  return "true when every R.E.A.L. element that a funder question gives room for is satisfied in the answers";
}

// ─── Assembling and reading the draft ────────────────────────────────────────

const QUESTION_LINE = /^Question (\d+):\s*(.*)$/;

export function assembleApplicationDraft(questions: FunderQuestion[], answers: Map<number, string>): string {
  return questions.map(q => {
    const answer = (answers.get(q.number) ?? '').trim() || `[DEANNA: What should the answer to funder question ${q.number} say?]`;
    return `Question ${q.number}: ${q.question}\n\n${answer}`;
  }).join('\n\n');
}

export function parseApplicationDraft(draft: string): Map<number, string> {
  const answers = new Map<number, string>();
  let current: number | null = null;
  let buf: string[] = [];
  const flush = () => { if (current !== null) answers.set(current, buf.join('\n').trim()); };
  for (const line of draft.split('\n')) {
    const m = line.match(QUESTION_LINE);
    if (m) { flush(); current = Number(m[1]); buf = []; continue; }
    if (current !== null) buf.push(line);
  }
  flush();
  return answers;
}

export function parseAnswersJson(raw: string): Map<number, string> {
  const parsed = extractJSON(raw) as { answers?: { number?: unknown; answer?: unknown }[] } | null;
  const out = new Map<number, string>();
  for (const a of parsed?.answers ?? []) {
    const n = Number(a?.number);
    const text = String(a?.answer ?? '').trim();
    if (Number.isFinite(n) && text) out.set(n, text);
  }
  return out;
}

// ─── Card text ───────────────────────────────────────────────────────────────

export function buildGrantHeader(cleanName: string, grantRow: Record<string, unknown> | null): string {
  const lines = [`**${cleanName}** — ${grantRow?.funder ?? ''}`.trim()];
  lines.push(`Amount: ${grantRow?.amount_range ?? 'See link'} | Deadline: ${grantRow?.deadline ?? ''}`);
  if (grantRow?.eligibility) lines.push(`Eligibility: ${grantRow.eligibility}`);
  const page = String(grantRow?.funder_questions_source_url ?? '') || String(grantRow?.source_url ?? '');
  if (page) lines.push(`Funder's application page: ${page}`);
  return lines.join('\n');
}

// R.E.A.L. spelled out under the header of every Kwame draft card and DeAnna's finished draft.
// The four words come from REAL_STANDARD in agentKnowledge.ts.
export const REAL_SPELLED_OUT = 'R.E.A.L. = Relatable, Educational, Actionable, Lovable';

export function buildDraftHeader(cleanName: string, grantRow: Record<string, unknown> | null): string {
  return `${buildGrantHeader(cleanName, grantRow)}\n\n${REAL_SPELLED_OUT}`;
}

const PLACEHOLDER = /\[DEANNA:\s*([^\]]*)\]/g;

// The complete application, question by question. Returns null when the funder's
// questions are not saved for this grant (older drafts keep their own layout).
export function buildApplicationBody(draft: string, grantRow: Record<string, unknown> | null): string | null {
  const qs = getFunderQuestions(grantRow);
  if (qs.length === 0) return null;
  const answers = parseApplicationDraft(draft);
  let answered = 0;
  const blocks: string[] = [];
  for (const q of qs) {
    const answer = (answers.get(q.number) ?? '').trim();
    const asks = Array.from(answer.matchAll(PLACEHOLDER)).map(m => m[1].trim()).filter(Boolean);
    const needsFeedback = !answer || asks.length > 0;
    if (!needsFeedback) answered++;
    const lines = [`### Question ${q.number}`, `**Funder's question:** ${q.question}`];
    const onlyPlaceholders = answer.replace(PLACEHOLDER, '').trim() === '';
    if (answer && !onlyPlaceholders) { lines.push(`**Kwame's answer:**`, answer); }
    if (!answer) lines.push(`**Needs your feedback:** Kwame has no answer for this question yet.`);
    else if (asks.length > 0) { lines.push(`**Needs your feedback:**`, ...asks.map(a => `- ${a}`)); }
    blocks.push(lines.join('\n'));
  }
  const summary = `**Application status:** ${answered} of ${qs.length} funder questions answered; ${qs.length - answered} need your feedback.`;
  const docs = getFunderDocuments(grantRow);
  const docBlock = docs.length > 0 ? `\n\n### Documents the funder requires\n${docs.map(d => `- ${d}`).join('\n')}` : '';
  return `${summary}\n\n${blocks.join('\n\n')}${docBlock}`;
}

// Card for a draft that is waiting on DeAnna. Returns null for grants without
// saved funder questions.
export function buildStuckCardOutput(cleanName: string, grantRow: Record<string, unknown> | null, draft: string, summary: string): string | null {
  const body = buildApplicationBody(draft, grantRow);
  if (!body) return null;
  const why = summary && summary !== 'none' ? `\n\n**Waiting on:** ${summary}` : '';
  return `${buildDraftHeader(cleanName, grantRow)}${why}\n\n---\n\n${body}`;
}

// Card for a grant where the funder's questions are not available, so no draft was written.
export function buildNoQuestionsCardOutput(cleanName: string, grantRow: Record<string, unknown> | null, result: FunderQuestionsResult): string {
  const reason = result.status === 'portal_only'
    ? "This funder shows its application questions only inside its own application portal."
    : "The funder's application questions were not found on the funder's pages.";
  return `${buildGrantHeader(cleanName, grantRow)}\n\n**No draft written.** ${reason} Kwame writes a draft once the funder's questions are saved.\n\n${result.note}`;
}
