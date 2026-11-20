// api/course-deck-pdf.ts
// Builds the PDF for one lesson's deck from Theo Nguyen's deck script (the card on the Approvals page,
// using DeAnna's edited version when she edited it), with the pictures and layouts she chose for its slides,
// stores it in the private course-decks folder, and puts it in that lesson's Resources list titled
// "Module 1 · Lesson 1 · Critical Thinking — Slides".
// Pressing the button again replaces the earlier PDF and keeps the one Resources entry.
// The lesson stays hidden until DeAnna clicks Show. Only DeAnna's admin login can call this.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { buildDeckPdf } from './_lib/courseDeckPdf.js';
import { loadDeckCard, loadPictureDataUrls, loadLayouts, DECK_BUCKET } from './_lib/courseDeckPictures.js';

export const config = { maxDuration: 120 };

const ADMIN_EMAIL = 'deanna@druaiconsulting.com';
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use the Build PDF button on the deck card.' }); return; }
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) { res.status(403).json({ error: 'Sign in first.' }); return; }
  const { data: u, error: uErr } = await sb.auth.getUser(h.slice(7));
  if (uErr || (u.user?.email || '').toLowerCase() !== ADMIN_EMAIL) { res.status(403).json({ error: 'Only DeAnna can build this.' }); return; }

  const approvalId = String((req.body ?? {}).approval_id || '').trim();
  if (!approvalId) { res.status(400).json({ error: 'No deck card was chosen.' }); return; }

  try {
    const loaded = await loadDeckCard(sb, approvalId);
    if (!loaded.ok) { res.status(loaded.status).json({ error: loaded.error }); return; }
    const { deck, moduleNumber, lessonNumber, lesson } = loaded.card;

    const pictures = await loadPictureDataUrls(sb, lesson.id, new Set(deck.slides.map(s => s.number)));
    const layouts = await loadLayouts(sb, lesson.id);
    const built = await buildDeckPdf(deck, pictures, layouts);

    const path = `${lesson.id}.pdf`;
    const { error: upErr } = await sb.storage.from(DECK_BUCKET).upload(path, built.pdf, { contentType: 'application/pdf', upsert: true });
    if (upErr) throw new Error(`The PDF was built but could not be saved: ${upErr.message}`);

    const title = `Module ${moduleNumber} · Lesson ${lessonNumber} · ${lesson.title} — Slides`;
    const existing: any[] = Array.isArray(lesson.resources) ? lesson.resources : [];
    const resources = [...existing.filter(r => r?.kind !== 'deck'), { title, kind: 'deck', path }];
    const { error: rErr } = await sb.from('course_lessons').update({ resources }).eq('id', lesson.id);
    if (rErr) throw new Error(`The PDF was saved but the lesson's Resources list could not be updated: ${rErr.message}`);

    const { data: link } = await sb.storage.from(DECK_BUCKET).createSignedUrl(path, 600);
    res.status(200).json({ ok: true, pages: built.pages, pictures: Object.keys(pictures).length, title, url: link?.signedUrl ?? null, shrunk: built.shrunk });
  } catch (e) {
    const message = (e as Error)?.message || 'The PDF could not be built.';
    console.error('[course-deck-pdf] failed:', message);
    res.status(500).json({ error: message });
  }
}
