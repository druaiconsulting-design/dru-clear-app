// ================================================================
// DRU AI Leadership Ecosystem™ — Lead Executor
// File: api/lead-executor.ts
// Runtime: Vercel Edge
//
// Called by admin-approvals when DeAnna approves a
// Pipeline 1 (lead_intelligence) card.
// Fires a GHL webhook to enroll high-intent leads
// into the appropriate follow-up sequence.
//
// Pattern mirrors social-publisher.ts
// ================================================================

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─────────────────────────────────────────────────────────────
// GHL Webhook — fires the lead follow-up workflow
// Wire this to a GHL workflow that:
//   1. Looks up the contact by ID
//   2. Enrolls them in the recommended sequence
//   3. Notifies DeAnna of enrollment
//
// TO SET UP: Create a GHL workflow with Inbound Webhook trigger,
// add the URL here as GHL_LEAD_EXECUTOR_WEBHOOK in Vercel env vars.
// ─────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  const ghlWebhook = process.env.GHL_LEAD_EXECUTOR_WEBHOOK;

  if (!ghlWebhook) {
    return new Response(
      JSON.stringify({ error: 'GHL_LEAD_EXECUTOR_WEBHOOK not configured' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  const {
    approval_id,
    ghl_contact_ids,       // comma-separated contact IDs from the approval card
    recommended_action,    // Ryan's recommended action from the briefing card
    priority,
  } = await req.json();

  // Fire GHL webhook with lead context
  const res = await fetch(ghlWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      approval_id,
      ghl_contact_ids,
      recommended_action,
      priority,
      approved_at: new Date().toISOString(),
      action: 'enroll_lead_sequence',
      location_id: 'gl07I4JnbkGgW8zJprSz',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(
      JSON.stringify({ error: 'GHL webhook failed', detail: err, approval_id }),
      { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, approval_id, contacts_enrolled: ghl_contact_ids }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  );
}
