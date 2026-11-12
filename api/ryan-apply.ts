// api/ryan-apply.ts
// Ryan Nakamura makes the changes DeAnna approved.
//
// Fires from AdminApprovals.tsx's handleApprove() when a CRM Review card is approved. The card already holds
// which jobs DeAnna checked (saved with the approval), so this endpoint reads the checked jobs from the card
// itself. Only changes already listed on an approved card under a checked job can be made, and each change can
// be made once: its row in ryan_change_log is claimed before Ryan touches GHL.
//
// Uses Ryan's own GHL key (GHL_RYANS_PRIVATE_INTEGRATIONS_KEY).

import { applyApprovedChanges } from './_lib/ryanCrm.js';

export const config = { maxDuration: 300 };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const approvalId = String(req.body?.approval_id ?? '');
  if (!UUID.test(approvalId)) { res.status(400).json({ error: 'approval_id is required' }); return; }

  const result = await applyApprovedChanges(approvalId);
  console.log(`[ryan-apply] approval ${approvalId}: ${result.applied} made, ${result.skipped} skipped, ${result.failed} failed, ${result.not_attempted} not attempted${result.error ? ` | ${result.error}` : ''}`);
  res.status(result.ok ? 200 : 400).json(result);
}
