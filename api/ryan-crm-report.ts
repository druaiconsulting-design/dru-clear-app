// api/ryan-crm-report.ts
// Starts Ryan Nakamura's daily CRM Review: Ryan reads the DRU AI Consulting GHL account and writes ONE
// card (16 sections, one per job) to DeAnna's approvals. This run only reads GHL — it changes nothing there.
// The changes themselves are made later by api/ryan-apply.ts, after DeAnna approves the card.
//
// Called by the pg_cron job (x-cron-secret header required). Answers right away (202) and keeps
// working in the background for up to 300 seconds. Add { "wait": true } to the body to hold the
// connection open and get the result back (used for test runs).

import { waitUntil } from '@vercel/functions';
import { generateRyanReport } from './_lib/ryanCrm.js';

export const config = { maxDuration: 300 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers['x-cron-secret'] !== expected) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const wait = req.body?.wait === true;
  if (wait) {
    const result = await generateRyanReport();
    res.status(200).json({ success: true, ...result });
    return;
  }

  waitUntil(
    generateRyanReport()
      .then(r => console.log(`[ryan-crm-report] card ${r.approval_id ?? 'NOT WRITTEN'} | sections with changes: ${r.sections_with_changes} | read errors: ${r.read_errors}${r.note ? ` | ${r.note}` : ''}`))
      .catch(err => console.error('[ryan-crm-report] run failed:', err))
  );
  res.status(202).json({ success: true, status: 'started' });
}
