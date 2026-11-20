// api/_lib/courseDeckPictures.ts
// Pictures for the slides of a lesson's deck. DeAnna picks which slides get one on Theo's deck card:
// the Hub makes it from Theo's visual direction for that slide, or she uploads her own. Pictures sit in the
// private course-decks folder, one file per slide: <lesson id>/slide-<number>.<jpg|png|webp>. A picture is tied
// to the slide's number. Build PDF reads them from there.

import type { SupabaseClient } from '@supabase/supabase-js';
import { parseDeck, normalizeLayout } from './courseDeckPdf.js';
import type { Deck } from './courseDeckPdf.js';

export const DECK_BUCKET = 'course-decks';
const COURSE_ID = 'confusion_to_confidence';
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export type DeckCard = {
  cardText: string;
  deck: Deck;
  moduleNumber: number;
  lessonNumber: number;
  lesson: { id: string; title: string; resources: any };
};

// Finds Theo's deck card, reads its deck script (DeAnna's edited version when she edited it) and the lesson it belongs to.
export async function loadDeckCard(sb: SupabaseClient, approvalId: string): Promise<{ ok: true; card: DeckCard } | { ok: false; status: number; error: string }> {
  const { data: card, error } = await sb.from('approvals').select('id, agent_name, trigger_type, output, edited_output').eq('id', approvalId).maybeSingle();
  if (error || !card) return { ok: false, status: 404, error: 'That card could not be found.' };
  const m = String(card.trigger_type || '').match(/^course_deck M(\d+) L(\d+) — (.+)$/);
  if (card.agent_name !== 'Theo Nguyen' || !m) return { ok: false, status: 400, error: "This card is not one of Theo's lesson decks." };
  const cardText = String(card.edited_output || card.output || '').trim();
  if (!cardText) return { ok: false, status: 422, error: 'The deck script on this card is empty.' };
  let deck: Deck;
  try { deck = parseDeck(cardText); } catch (e) { return { ok: false, status: 422, error: (e as Error).message }; }
  const moduleNumber = Number(m[1]);
  const lessonNumber = Number(m[2]);
  const { data: mod } = await sb.from('course_modules').select('id').eq('course_id', COURSE_ID).eq('module_number', moduleNumber).maybeSingle();
  if (!mod) return { ok: false, status: 404, error: `Module ${moduleNumber} was not found in the course records.` };
  const { data: lesson } = await sb.from('course_lessons').select('id, title, resources').eq('module_id', mod.id).eq('lesson_number', lessonNumber).maybeSingle();
  if (!lesson) return { ok: false, status: 404, error: `Module ${moduleNumber} Lesson ${lessonNumber} was not found in the course records.` };
  return { ok: true, card: { cardText, deck, moduleNumber, lessonNumber, lesson } };
}

export const picturePrefix = (lessonId: string, slide: number) => `${lessonId}/slide-${slide}.`;

// The stored pictures for a lesson, by slide number.
export async function listPictures(sb: SupabaseClient, lessonId: string): Promise<Map<number, { path: string; mime: string }>> {
  const out = new Map<number, { path: string; mime: string }>();
  const { data } = await sb.storage.from(DECK_BUCKET).list(lessonId, { limit: 200 });
  for (const f of data ?? []) {
    const m = f.name.match(/^slide-(\d+)\.(jpg|png|webp)$/);
    if (m) out.set(Number(m[1]), { path: `${lessonId}/${f.name}`, mime: MIME[m[2]] });
  }
  return out;
}

// Saves a picture for a slide, replacing any earlier one for that slide.
export async function savePicture(sb: SupabaseClient, lessonId: string, slide: number, bytes: Buffer, mime: string): Promise<string> {
  const ext = EXT[mime];
  if (!ext) throw new Error('Use a JPG, PNG or WebP picture.');
  const existing = await listPictures(sb, lessonId);
  const old = existing.get(slide);
  const path = `${picturePrefix(lessonId, slide)}${ext}`;
  if (old && old.path !== path) await sb.storage.from(DECK_BUCKET).remove([old.path]);
  const { error } = await sb.storage.from(DECK_BUCKET).upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw new Error(`The picture could not be saved: ${error.message}`);
  return path;
}

export async function removePicture(sb: SupabaseClient, lessonId: string, slide: number): Promise<void> {
  const old = (await listPictures(sb, lessonId)).get(slide);
  if (old) await sb.storage.from(DECK_BUCKET).remove([old.path]);
}

// The lesson's pictures as data links, for Build PDF to lay onto the slides.
export async function loadPictureDataUrls(sb: SupabaseClient, lessonId: string, validSlides: Set<number>): Promise<Record<number, string>> {
  const out: Record<number, string> = {};
  for (const [slide, f] of await listPictures(sb, lessonId)) {
    if (!validSlides.has(slide)) continue;
    const { data } = await sb.storage.from(DECK_BUCKET).download(f.path);
    if (!data) continue;
    out[slide] = `data:${f.mime};base64,${Buffer.from(await data.arrayBuffer()).toString('base64')}`;
  }
  return out;
}

// DeAnna's layout choices for a lesson's slides, by slide number. A slide that has no entry uses the layout Theo wrote.
// They are kept in one small file beside the pictures: <lesson id>/layouts.json.
export async function loadLayouts(sb: SupabaseClient, lessonId: string): Promise<Record<number, string>> {
  const { data } = await sb.storage.from(DECK_BUCKET).download(`${lessonId}/layouts.json`);
  if (!data) return {};
  try {
    const raw = JSON.parse(await data.text());
    const out: Record<number, string> = {};
    for (const [k, v] of Object.entries(raw ?? {})) {
      const id = normalizeLayout(String(v));
      if (id && Number.isInteger(Number(k))) out[Number(k)] = id;
    }
    return out;
  } catch { return {}; }
}

// Saves one slide's layout. An empty layout takes DeAnna's choice away, so the slide goes back to Theo's.
export async function saveLayout(sb: SupabaseClient, lessonId: string, slide: number, layout: string): Promise<void> {
  const cur = await loadLayouts(sb, lessonId);
  const id = normalizeLayout(layout);
  if (id) cur[slide] = id; else delete cur[slide];
  const { error } = await sb.storage.from(DECK_BUCKET).upload(`${lessonId}/layouts.json`, Buffer.from(JSON.stringify(cur)), { contentType: 'application/json', upsert: true });
  if (error) throw new Error(`The layout could not be saved: ${error.message}`);
}
