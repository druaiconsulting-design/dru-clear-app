// api/support-weekly-report.ts
// Starts Isaiah Carter's weekly ticket report: every Saturday at 2:00 PM CST the schedule calls this, and the
// report for the 7 days before it is saved for the Weekly report tab on the Support Tickets page.
//
// Called by the pg_cron job (x-cron-secret header required). Answers right away (202) and keeps working in
// the background. Add { "wait": true } to the body to hold the connection open and get the result back.

import { waitUntil } from '@vercel/functions';
import { generateWeeklyReport } from './_lib/isaiahWeeklyReport.js';

export const config = { maxDuration: 60 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers['x-cron-secret'] !== expected) { res.status(401).json({ error: 'Unauthorized' }); return; }

  if (req.body?.wait === true) {
    try {
      const result = await generateWeeklyReport();
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error('[support-weekly-report] run failed:', err);
      res.status(500).json({ success: false, error: String(err) });
    }
    return;
  }

  waitUntil(
    generateWeeklyReport()
      .then((r) => console.log(`[support-weekly-report] report ${r.report_id ?? 'NOT WRITTEN'} | tickets: ${r.ticket_count}${r.note ? ` | ${r.note}` : ''}`))
      .catch((err) => console.error('[support-weekly-report] run failed:', err)),
  );
  res.status(202).json({ success: true, status: 'started' });
}
