// api/course-deck-picture.ts
// The pictures and layouts on a lesson deck's slides, from Theo Nguyen's deck card on the Approvals page.
//   GET  ?approval_id=…                              -> every slide on the card with its visual direction and its picture (if any)
//   POST {action:'make',   approval_id, slide}       -> the Hub makes a picture from that slide's visual direction
//   POST {action:'upload', approval_id, slide, data_url} -> DeAnna's own picture for that slide
//   POST {action:'remove', approval_id, slide}       -> takes the picture off that slide
//   POST {action:'layout', approval_id, slide, layout} -> DeAnna's layout for that slide (empty = back to Theo's choice)
// Pictures are saved in the private course-decks folder and tied to the slide number. Each made picture is logged
// on the Usage tab. Only DeAnna's admin login can call this.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { logActivity } from './_lib/hubShared.js';
import { makePicture, parseDataUrl } from './_lib/studioImages.js';
import { loadDeckCard, listPictures, savePicture, removePicture, loadLayouts, saveLayout, DECK_BUCKET } from './_lib/courseDeckPictures.js';
import { LAYOUTS, normalizeLayout } from './_lib/courseDeckPdf.js';

export const config = { maxDuration: 120 };

const ADMIN_EMAIL = 'deanna@druaiconsulting.com';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// The picture sits in a 480 by 720 strip on the slide.
const PICTURE_SIZE = '1024x1536';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) { res.status(403).json({ error: 'Sign in first.' }); return; }
  const { data: u, error: uErr } = await sb.auth.getUser(h.slice(7));
  if (uErr || (u.user?.email || '').toLowerCase() !== ADMIN_EMAIL) { res.status(403).json({ error: 'Only DeAnna can use this.' }); return; }

  const body = req.method === 'POST' ? (req.body ?? {}) : {};
  const approvalId = String((req.method === 'POST' ? body.approval_id : req.query.approval_id) || '').trim();
  if (!approvalId) { res.status(400).json({ error: 'No deck card was chosen.' }); return; }

  try {
    const loaded = await loadDeckCard(sb, approvalId);
    if (!loaded.ok) { res.status(loaded.status).json({ error: loaded.error }); return; }
    const { deck, lesson, moduleNumber, lessonNumber } = loaded.card;

    if (req.method === 'GET') {
      const pics = await listPictures(sb, lesson.id);
      const paths = [...pics.values()].map(p => p.path);
      const signed = paths.length ? (await sb.storage.from(DECK_BUCKET).createSignedUrls(paths, 3600)).data ?? [] : [];
      const urlByPath = new Map(signed.map(s => [s.path, s.signedUrl]));
      const chosen = await loadLayouts(sb, lesson.id);
      res.status(200).json({
        ok: true,
        layouts: LAYOUTS,
        slides: deck.slides.map((s, i) => {
          const p = pics.get(s.number);
          return {
            number: s.number, title: s.title, kind: s.kind, visual: s.visual, picture_url: p ? urlByPath.get(p.path) ?? null : null,
            layout_applies: i > 0 && s.kind === 'content',
            theo_layout: s.layout || 'standard',
            layout: chosen[s.number] || s.layout || 'standard',
            layout_changed: !!chosen[s.number],
          };
        }),
      });
      return;
    }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const slideNo = Number(body.slide);
    const slide = deck.slides.find(s => s.number === slideNo);
    if (!slide) { res.status(400).json({ error: `Slide ${body.slide} is not on this card.` }); return; }
    const action = String(body.action || '');

    if (action === 'remove') {
      await removePicture(sb, lesson.id, slideNo);
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'layout') {
      const wanted = String(body.layout || '');
      if (wanted && !normalizeLayout(wanted)) { res.status(400).json({ error: 'Choose one of the layouts on the list.' }); return; }
      await saveLayout(sb, lesson.id, slideNo, wanted);
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'upload') {
      const parsed = parseDataUrl(String(body.data_url || ''));
      if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }
      await savePicture(sb, lesson.id, slideNo, parsed.bytes, parsed.mime);
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'make') {
      const direction = slide.visual.trim();
      if (!direction) { res.status(422).json({ error: `Slide ${slideNo} has no visual direction on the card, so there is nothing to make the picture from.` }); return; }
      const prompt = [
        `An illustration for a slide titled "${slide.title}" in a leadership course.`,
        `Visual direction from the presentation designer: ${direction}`,
        'Style: clean, modern editorial illustration with a calm, professional feel. Brand colors: navy #0A2342, gold #D4AF37 and magenta #C2185B on a soft light background.',
        'The picture holds no words, letters, numbers or logos, because the slide carries the text. The subject sits in the middle of a tall portrait frame.',
      ].join('\n');
      const cfg = { url: SUPABASE_URL, serviceKey: SERVICE_KEY };
      const made = await makePicture(cfg, { prompt, size: PICTURE_SIZE, quality: 'medium', refs: [], projectId: null, action: 'course slide picture', detail: `Module ${moduleNumber} Lesson ${lessonNumber} Slide ${slideNo}` });
      if (!made.ok) { res.status(502).json({ error: made.error }); return; }
      await savePicture(sb, lesson.id, slideNo, made.bytes, made.mime);
      res.status(200).json({ ok: true, cost: Math.round(made.cost * 10000) / 10000 });
      return;
    }

    res.status(400).json({ error: 'Choose make, upload, remove or layout.' });
  } catch (e) {
    const message = (e as Error)?.message || 'That did not work.';
    console.error('[course-deck-picture] failed:', message);
    res.status(500).json({ error: message });
  }
}
