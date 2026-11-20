// api/course-deck-pdf.ts
// Builds the PDF for one lesson's deck from Theo Nguyen's deck script (the card on the Approvals page,
// using DeAnna's edited version when she edited it), stores it in the private course-decks folder, and
// puts it in that lesson's Resources list titled "Module 1 · Lesson 1 · Critical Thinking — Slides".
// Pressing the button again replaces the earlier PDF and keeps the one Resources entry.
// The lesson stays hidden until DeAnna clicks Show. Only DeAnna's admin login can call this.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { parseDeck, buildDeckPdf } from './_lib/courseDeckPdf.js';

export const config = { maxDuration: 120 };

const ADMIN_EMAIL = 'deanna@druaiconsulting.com';
const COURSE_ID = 'confusion_to_confidence';
const BUCKET = 'course-decks';
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
    const { data: card, error: cErr } = await sb.from('approvals').select('id, agent_name, trigger_type, status, output, edited_output').eq('id', approvalId).maybeSingle();
    if (cErr || !card) { res.status(404).json({ error: 'That card could not be found.' }); return; }
    const m = String(card.trigger_type || '').match(/^course_deck M(\d+) L(\d+) — (.+)$/);
    if (card.agent_name !== 'Theo Nguyen' || !m) { res.status(400).json({ error: 'This card is not one of Theo\'s lesson decks.' }); return; }
    const moduleNumber = Number(m[1]);
    const lessonNumber = Number(m[2]);

    const text = String(card.edited_output || card.output || '').trim();
    if (!text) { res.status(422).json({ error: 'The deck script on this card is empty.' }); return; }
    let deck;
    try { deck = parseDeck(text); } catch (e) { res.status(422).json({ error: (e as Error).message }); return; }

    const { data: mod } = await sb.from('course_modules').select('id, module_number').eq('course_id', COURSE_ID).eq('module_number', moduleNumber).maybeSingle();
    if (!mod) { res.status(404).json({ error: `Module ${moduleNumber} was not found in the course records.` }); return; }
    const { data: lesson } = await sb.from('course_lessons').select('id, title, resources').eq('module_id', mod.id).eq('lesson_number', lessonNumber).maybeSingle();
    if (!lesson) { res.status(404).json({ error: `Module ${moduleNumber} Lesson ${lessonNumber} was not found in the course records.` }); return; }

    const built = await buildDeckPdf(deck);

    const path = `${lesson.id}.pdf`;
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, built.pdf, { contentType: 'application/pdf', upsert: true });
    if (upErr) throw new Error(`The PDF was built but could not be saved: ${upErr.message}`);

    const title = `Module ${moduleNumber} · Lesson ${lessonNumber} · ${lesson.title} — Slides`;
    const existing: any[] = Array.isArray(lesson.resources) ? lesson.resources : [];
    const resources = [...existing.filter(r => r?.kind !== 'deck'), { title, kind: 'deck', path }];
    const { error: rErr } = await sb.from('course_lessons').update({ resources }).eq('id', lesson.id);
    if (rErr) throw new Error(`The PDF was saved but the lesson's Resources list could not be updated: ${rErr.message}`);

    const { data: link } = await sb.storage.from(BUCKET).createSignedUrl(path, 600);
    res.status(200).json({ ok: true, pages: built.pages, title, url: link?.signedUrl ?? null, shrunk: built.shrunk });
  } catch (e) {
    const message = (e as Error)?.message || 'The PDF could not be built.';
    console.error('[course-deck-pdf] failed:', message);
    res.status(500).json({ error: message });
  }
}
