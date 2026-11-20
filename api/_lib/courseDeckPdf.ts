// api/_lib/courseDeckPdf.ts
// Builds the PDF of one lesson's deck from Theo Nguyen's deck script (the card on the Approvals page,
// using DeAnna's edited version when she edited it). One 16:9 page per slide, from one fixed template:
// Navy #0A2342, Gold #D4AF37, Magenta #C2185B, Playfair Display headlines, Inter body text. The page
// lays out Theo's slide titles and on-screen text. His visual directions stay on his card as notes.

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { PLAYFAIR_700_WOFF2, INTER_400_WOFF2, INTER_600_WOFF2 } from './courseDeckFonts.js';

const PACK_URL = 'https://github.com/Sparticuz/chromium/releases/download/v138.0.2/chromium-v138.0.2-pack.x64.tar';

async function chromiumPath(): Promise<string> {
  if (process.env.COURSE_DECK_CHROME) return process.env.COURSE_DECK_CHROME;
  try {
    return await chromium.executablePath();
  } catch (err) {
    console.warn('[course-deck-pdf] bundled browser not found, fetching the release pack:', (err as Error)?.message);
    return await chromium.executablePath(PACK_URL);
  }
}

export type DeckSlide = {
  number: number;
  kind: 'content' | 'quiz' | 'answer';
  title: string;
  lines: string[];
  visual: string;
};
export type Deck = { heading: string; slides: DeckSlide[] };

const clean = (s: string) => s.replace(/\*\*/g, '').replace(/__/g, '').replace(/^\s*#{1,6}\s*/, '').trim();
const stripBullet = (s: string) => s.replace(/^\s*(?:[-•*–]|\d+[.)])\s+/, '').trim();

// Reads the deck script layout from Theo's code: a heading line, then "Slide N" blocks, each with
// "Title:", "On-screen text:" and "Visual direction:".
export function parseDeck(text: string): Deck {
  const raw = String(text ?? '').replace(/\r/g, '').split('\n');
  const slideStart = /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*Slide\s+(\d+)\b(.*)$/i;
  let heading = '';
  const slides: DeckSlide[] = [];
  let cur: { number: number; rest: string; body: string[] } | null = null;
  for (const line of raw) {
    const m = line.match(slideStart);
    if (m) {
      if (cur) slides.push(finish(cur));
      cur = { number: Number(m[1]), rest: clean(m[2] ?? '').replace(/^[·:\-—–\s]+/, ''), body: [] };
      continue;
    }
    if (cur) cur.body.push(line);
    else if (!heading && clean(line)) heading = clean(line);
  }
  if (cur) slides.push(finish(cur));
  if (slides.length === 0) throw new Error('The deck script has no slides in the Slide 1 / Title / On-screen text layout, so there is nothing to build.');
  return { heading, slides };
}

function finish(c: { number: number; rest: string; body: string[] }): DeckSlide {
  let field: 'title' | 'text' | 'visual' | null = null;
  let title = '';
  const lines: string[] = [];
  let visual = '';
  for (const line of c.body) {
    const t = clean(line);
    const lbl = t.match(/^(title|on[- ]screen text|visual direction)\s*:\s*(.*)$/i);
    if (lbl) {
      const name = lbl[1].toLowerCase();
      field = name === 'title' ? 'title' : name.startsWith('on') ? 'text' : 'visual';
      const rest = lbl[2].trim();
      if (field === 'title') title = rest;
      else if (field === 'text' && rest) lines.push(stripBullet(rest));
      else if (field === 'visual') visual = rest;
      continue;
    }
    if (!t) continue;
    if (field === 'title') title = `${title} ${t}`.trim();
    else if (field === 'text') lines.push(stripBullet(t));
    else if (field === 'visual') visual = `${visual} ${t}`.trim();
  }
  const kind: DeckSlide['kind'] = /answer/i.test(c.rest) ? 'answer' : /test your knowledge/i.test(c.rest) ? 'quiz' : 'content';
  if (!title) title = c.rest.replace(/test your knowledge/i, '').replace(/^[·:\-—–\s]+/, '').replace(/answer/i, '').trim() || (kind === 'quiz' ? 'Test your knowledge' : kind === 'answer' ? 'Answer' : `Slide ${c.number}`);
  return { number: c.number, kind, title, lines, visual };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function slideHtml(sl: DeckSlide, index: number, total: number, heading: string): string {
  const num = `<div class="num">${index + 1}</div>`;
  const foot = `<div class="foot">DRU AI Consulting</div>${num}`;
  if (index === 0 && sl.kind === 'content') {
    const sub = sl.lines.map(l => `<p>${esc(l)}</p>`).join('');
    return `<section class="s cover"><div class="bar"></div><div class="kicker">${esc(heading || 'From Confusion to Confidence with AI™')}</div><h1 class="fit-title">${esc(sl.title)}</h1><div class="rule"></div><div class="sub fit">${sub}</div>${foot}</section>`;
  }
  if (sl.kind === 'quiz') {
    const choiceRe = /^([A-D])[.)]\s*(.*)$/i;
    const question = sl.lines.filter(l => !choiceRe.test(l)).map(l => `<p>${esc(l)}</p>`).join('');
    const choices = sl.lines.map(l => l.match(choiceRe)).filter(Boolean).map(m => `<div class="choice"><span>${esc((m as RegExpMatchArray)[1].toUpperCase())}</span><div>${esc((m as RegExpMatchArray)[2])}</div></div>`).join('');
    return `<section class="s dark"><div class="tag mag">Test your knowledge</div><h2 class="fit-title">${esc(sl.title)}</h2><div class="rule"></div><div class="q fit">${question}</div><div class="choices">${choices}</div>${foot}</section>`;
  }
  if (sl.kind === 'answer') {
    const [first, ...rest] = sl.lines;
    return `<section class="s dark"><div class="tag gold">Test your knowledge · Answer</div><h2 class="fit-title">${esc(sl.title)}</h2><div class="rule"></div><div class="ans fit">${first ? `<p class="right">${esc(first)}</p>` : ''}${rest.map(l => `<p>${esc(l)}</p>`).join('')}</div>${foot}</section>`;
  }
  const items = sl.lines.map(l => `<li>${esc(l)}</li>`).join('');
  return `<section class="s light"><div class="side"></div><h2 class="fit-title">${esc(sl.title)}</h2><div class="rule"></div><ul class="body fit">${items}</ul>${foot}</section>`;
}

export function deckHtml(deck: Deck): string {
  const pages = deck.slides.map((s, i) => slideHtml(s, i, deck.slides.length, deck.heading)).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8">
<style>
@font-face { font-family: 'Playfair Display'; font-weight: 700; font-style: normal; src: url(data:font/woff2;base64,${PLAYFAIR_700_WOFF2}) format('woff2'); }
@font-face { font-family: 'Inter'; font-weight: 400; font-style: normal; src: url(data:font/woff2;base64,${INTER_400_WOFF2}) format('woff2'); }
@font-face { font-family: 'Inter'; font-weight: 600; font-style: normal; src: url(data:font/woff2;base64,${INTER_600_WOFF2}) format('woff2'); }
@page { size: 1280px 720px; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #0A2342; }
body { font-family: 'Inter', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.s { width: 1280px; height: 720px; position: relative; overflow: hidden; page-break-after: always; break-after: page; padding: 64px 96px 72px 96px; display: flex; flex-direction: column; }
.s:last-child { page-break-after: auto; break-after: auto; }
h1, h2 { font-family: 'Playfair Display', Georgia, serif; font-weight: 700; line-height: 1.12; }
.light { background: #FAFAF8; color: #0A2342; padding-left: 120px; }
.light .side { position: absolute; left: 0; top: 0; bottom: 0; width: 22px; background: #C2185B; }
.light h2 { font-size: 46px; color: #0A2342; }
.light .rule { width: 96px; height: 5px; background: #D4AF37; margin: 22px 0 30px; }
.light ul { list-style: none; font-size: 30px; line-height: 1.4; flex: 1; min-height: 0; overflow: hidden; }
.light li { position: relative; padding-left: 34px; margin-bottom: 16px; }
.light li::before { content: ''; position: absolute; left: 0; top: 0.5em; width: 12px; height: 12px; background: #D4AF37; transform: rotate(45deg); }
.dark, .cover { background: #0A2342; color: #FFFFFF; }
.dark h2 { font-size: 44px; color: #FFFFFF; }
.dark .rule, .cover .rule { width: 96px; height: 5px; background: #D4AF37; margin: 20px 0 26px; }
.tag { align-self: flex-start; font-size: 15px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; padding: 8px 16px; border-radius: 4px; margin-bottom: 22px; }
.tag.mag { background: #C2185B; color: #FFFFFF; }
.tag.gold { background: #D4AF37; color: #0A2342; }
.q { font-size: 30px; line-height: 1.4; min-height: 0; overflow: hidden; }
.q p { margin-bottom: 12px; }
.choices { margin-top: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.choice { display: flex; gap: 16px; align-items: flex-start; background: rgba(255,255,255,0.08); border: 1px solid rgba(212,175,55,0.5); border-radius: 8px; padding: 14px 18px; font-size: 22px; line-height: 1.3; }
.choice span { flex: none; width: 34px; height: 34px; border-radius: 50%; background: #D4AF37; color: #0A2342; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 18px; }
.ans { font-size: 28px; line-height: 1.45; flex: 1; min-height: 0; overflow: hidden; }
.ans p { margin-bottom: 16px; }
.ans .right { color: #D4AF37; font-weight: 600; font-size: 34px; }
.cover { justify-content: center; padding-left: 130px; }
.cover .bar { position: absolute; left: 0; top: 0; bottom: 0; width: 22px; background: #C2185B; }
.cover .kicker { font-size: 17px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #D4AF37; margin-bottom: 26px; }
.cover h1 { font-size: 68px; color: #FFFFFF; max-width: 1000px; }
.cover .sub { font-size: 28px; line-height: 1.45; color: rgba(255,255,255,0.88); max-width: 980px; max-height: 190px; overflow: hidden; }
.cover .sub p { margin-bottom: 8px; }
.foot { position: absolute; left: 96px; bottom: 26px; font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.6; }
.light .foot { left: 120px; }
.cover .foot { left: 130px; }
.num { position: absolute; right: 56px; bottom: 24px; font-size: 14px; font-weight: 600; color: #D4AF37; }
</style></head><body>
${pages}
</body></html>`;
}

// Runs in the page. Body text steps down until it fits its space; a title steps down until it holds to two lines.
const FIT_SCRIPT = `(() => {
  let changed = 0;
  document.querySelectorAll('.fit').forEach(el => {
    let size = parseFloat(getComputedStyle(el).fontSize);
    let moved = false;
    while (el.scrollHeight > el.clientHeight + 1 && size > 16) {
      size -= 1; moved = true;
      el.style.fontSize = size + 'px';
      el.querySelectorAll('li').forEach(li => { li.style.fontSize = size + 'px'; });
    }
    if (moved) changed++;
  });
  document.querySelectorAll('.fit-title').forEach(el => {
    let size = parseFloat(getComputedStyle(el).fontSize);
    const max = size * 1.12 * 2.1;
    let moved = false;
    while (el.getBoundingClientRect().height > max && size > 24) { size -= 1; moved = true; el.style.fontSize = size + 'px'; }
    if (moved) changed++;
  });
  return changed;
})()`;

export async function buildDeckPdf(deck: Deck): Promise<{ pdf: Buffer; pages: number; fontsLoaded: boolean; shrunk: number }> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromiumPath(),
    headless: 'shell',
    defaultViewport: { width: 1280, height: 720 },
  });
  try {
    const page = await browser.newPage();
    await page.setContent(deckHtml(deck), { waitUntil: 'load', timeout: 45000 });
    await page.evaluate('document.fonts.ready');
    const fontsLoaded = await page.evaluate(`document.fonts.check('700 20px "Playfair Display"') && document.fonts.check('600 20px "Inter"')`) as boolean;
    // Titles and text that run past their space step down in size until they fit.
    const shrunk = await page.evaluate(FIT_SCRIPT) as number;
    const pdf = await page.pdf({ width: '1280px', height: '720px', printBackground: true, preferCSSPageSize: true });
    const buf = Buffer.from(pdf);
    const made = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    if (made !== deck.slides.length) throw new Error(`The PDF came out with ${made} pages for ${deck.slides.length} slides, so it was not saved.`);
    return { pdf: buf, pages: made, fontsLoaded: !!fontsLoaded, shrunk };
  } finally {
    await browser.close();
  }
}
