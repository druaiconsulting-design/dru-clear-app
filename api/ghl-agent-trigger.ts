// ================================================================
// DRU AI Leadership Ecosystem™ — Autonomous Entry Point
// File: api/ghl-agent-trigger.ts
// Runtime: Vercel Edge
//
// Handles two trigger sources:
//   1. GHL Webhooks  — inbound from GoHighLevel events
//   2. pg_cron jobs  — scheduled Supabase cron calls (x-cron-secret header)
//
// After a successful cron-triggered agent run, fires a digest
// notification to a GHL inbound webhook → SMS + Email to DeAnna.
// ================================================================

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface AgentRoute {
  agent_id: string;
  agent_name: string;
  division: string;
  task: string;
  description: string;
}

interface TriggerPayload {
  trigger_type: string;
  source?: string;
  agent_id?: string;
  division?: string;
  scheduled_at?: string;
  contact_id?: string;
  lead_data?: Record<string, unknown>;
  [key: string]: unknown;
}

interface TravisRouterResponse {
  approval_id?: string;
  approval_ids?: string[];
  cards_created?: number;
  status?: string;
  message?: string;
  summary?: string;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────
// Agent Routing Map
// ─────────────────────────────────────────────────────────────

const AGENT_ROUTES: Record<string, AgentRoute> = {

  // ── Revenue Division ──────────────────────────────────────

  cron_omar_lead_score: {
    agent_id: 'omar',
    agent_name: 'Omar',
    division: 'revenue',
    task: 'scan_score_route_leads',
    description: 'Scan new GHL leads since last run, apply lead scoring model, route high-intent leads to active pipeline stages',
  },

  cron_ryan_crm_update: {
    agent_id: 'ryan',
    agent_name: 'Ryan',
    division: 'revenue',
    task: 'overnight_crm_sync',
    description: 'Review overnight CRM activity in GHL, update contact records, flag stale deals, generate morning briefing card',
  },

  // ── Marketing Division ────────────────────────────────────

  cron_camila_linkedin_queue: {
    agent_id: 'camila',
    agent_name: 'Camila',
    division: 'marketing',
    task: 'generate_weekly_linkedin_queue',
    description: "Generate this week's LinkedIn content queue — 5 posts aligned to brand pillars and current campaign focus. Submit to approval queue.",
  },

  // ── Content/Brand Division ────────────────────────────────

  cron_content_daily_post: {
    agent_id: 'content',
    agent_name: 'Content Agent',
    division: 'content_brand',
    task: 'generate_daily_linkedin_post',
    description: "Generate today's LinkedIn post for DeAnna's profile. Align to DRU AI Leadership Ecosystem™ brand voice. Submit to approval queue.",
  },

  // ── Analytics ─────────────────────────────────────────────

  cron_analytics_weekly: {
    agent_id: 'analytics',
    agent_name: 'Analytics Agent',
    division: 'analytics',
    task: 'weekly_performance_summary',
    description: 'Compile weekly performance summary: lead volume, assessment completions, approval queue throughput, GHL pipeline movement. Submit to approval queue.',
  },

  // ── GHL Webhook Triggers (existing) ───────────────────────

  lead_created: {
    agent_id: 'omar',
    agent_name: 'Omar',
    division: 'revenue',
    task: 'score_new_lead',
    description: 'Score and route newly created GHL lead',
  },

  contact_updated: {
    agent_id: 'ryan',
    agent_name: 'Ryan',
    division: 'revenue',
    task: 'process_contact_update',
    description: 'Process CRM contact update event and adjust pipeline stage if warranted',
  },

  assessment_completed: {
    agent_id: 'omar',
    agent_name: 'Omar',
    division: 'revenue',
    task: 'route_assessment_lead',
    description: 'Route lead based on completed DRU CLEAR™ scorecard tier result',
  },

  support_ticket: {
    agent_id: 'support',
    agent_name: 'Support Agent',
    division: 'customer_support',
    task: 'handle_support_request',
    description: 'Route and respond to incoming support request',
  },
};

// ─────────────────────────────────────────────────────────────
// Cron trigger types — these get a digest notification after run
// Webhook-triggered runs do NOT send notifications (by design)
// ─────────────────────────────────────────────────────────────

const CRON_TRIGGER_TYPES = new Set([
  'cron_omar_lead_score',
  'cron_ryan_crm_update',
  'cron_camila_linkedin_queue',
  'cron_content_daily_post',
  'cron_analytics_weekly',
]);

// ─────────────────────────────────────────────────────────────
// Security: validate cron secret
// ─────────────────────────────────────────────────────────────

function validateCronSecret(req: NextRequest): boolean {
  const incomingSecret = req.headers.get('x-cron-secret');
  if (incomingSecret === null) return true; // webhook path — no secret needed
  return incomingSecret === process.env.CRON_SECRET;
}

// ─────────────────────────────────────────────────────────────
// Digest Notification
// Fires after a successful cron agent run — fire-and-forget,
// never blocks or fails the main response.
// Sends to GHL inbound webhook → workflow → SMS + Email.
// ─────────────────────────────────────────────────────────────

async function sendDigestNotification(
  route: AgentRoute,
  result: TravisRouterResponse,
  triggeredAt: string
): Promise<void> {
  const webhookUrl = process.env.GHL_NOTIFICATION_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('[ghl-agent-trigger] GHL_NOTIFICATION_WEBHOOK_URL not set — skipping notification');
    return;
  }

  const cardsCreated = result.cards_created ?? 1;
  const approvalIds = result.approval_ids ?? (result.approval_id ? [result.approval_id] : []);
  const cardWord = cardsCreated !== 1 ? 'cards' : 'card';
  const taskReadable = route.task.replace(/_/g, ' ');

  const summary =
    result.summary ??
    `${route.agent_name} completed the ${taskReadable} task and dropped ${cardsCreated} ${cardWord} into your approval queue.`;

  const payload = {
    // Agent context — available as merge fields in GHL workflow
    agent_name: route.agent_name,
    agent_id: route.agent_id,
    division: route.division,
    task: taskReadable,
    // Card data
    cards_created: cardsCreated,
    approval_ids: approvalIds.join(', ') || 'see queue',
    // Summary
    summary,
    // Timing
    triggered_at: triggeredAt,
    // Direct link
    review_url: 'https://app.druaiconsulting.com/admin-approvals',
    // Pre-formatted bodies — use these directly in GHL SMS/Email actions
    // as {{sms_body}} and {{email_body}} custom value merge fields
    sms_body: `DRU AI™ | ${route.agent_name} dropped ${cardsCreated} ${cardWord} in your approval queue.\n\nTask: ${taskReadable}\nReview: app.druaiconsulting.com/admin-approvals`,
    email_subject: `DRU AI Ecosystem™ — ${route.agent_name} Queue Update`,
    email_body: `Your AI Ecosystem ran on schedule.\n\nAgent: ${route.agent_name}\nDivision: ${route.division}\nTask: ${taskReadable}\nCards in Queue: ${cardsCreated}\n\n${summary}\n\nReview and approve:\nhttps://app.druaiconsulting.com/admin-approvals\n\n— DRU AI Leadership Ecosystem™`,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`[ghl-agent-trigger] Notification webhook returned ${response.status}`);
    } else {
      console.log(`[ghl-agent-trigger] ✅ Digest notification sent for ${route.agent_name}`);
    }
  } catch (error) {
    // Non-fatal — never let notification failure break the main flow
    console.warn('[ghl-agent-trigger] Notification dispatch failed (non-fatal):', error);
  }
}

// ─────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────

export default async function handler(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  if (!validateCronSecret(req)) {
    console.error('[ghl-agent-trigger] ❌ Invalid cron secret — request rejected');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: TriggerPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { trigger_type, source } = payload;

  if (!trigger_type) {
    return NextResponse.json({ error: 'trigger_type is required' }, { status: 400 });
  }

  const route = AGENT_ROUTES[trigger_type];

  if (!route) {
    console.warn(`[ghl-agent-trigger] ⚠️  Unknown trigger_type: ${trigger_type}`);
    return NextResponse.json({ error: `Unknown trigger_type: ${trigger_type}` }, { status: 400 });
  }

  const sourceLabel = source ?? 'webhook';
  const triggeredAt = new Date().toISOString();
  const isCronSource = CRON_TRIGGER_TYPES.has(trigger_type);

  console.log(
    `[ghl-agent-trigger] ✅ Routing → ${route.agent_name} | division: ${route.division} | task: ${route.task} | source: ${sourceLabel}`
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[ghl-agent-trigger] ❌ Missing SUPABASE env vars');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const travisResponse = await fetch(
      `${supabaseUrl}/functions/v1/travis-router`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          agent_id: route.agent_id,
          agent_name: route.agent_name,
          division: route.division,
          task: route.task,
          description: route.description,
          trigger_type,
          source: sourceLabel,
          payload,
          triggered_at: triggeredAt,
        }),
      }
    );

    const responseText = await travisResponse.text();

    if (!travisResponse.ok) {
      console.error(
        `[ghl-agent-trigger] ❌ Travis router returned ${travisResponse.status}: ${responseText}`
      );
      return NextResponse.json(
        { error: 'Agent dispatch failed', status_code: travisResponse.status, details: responseText },
        { status: 502 }
      );
    }

    let result: TravisRouterResponse = {};
    try {
      result = JSON.parse(responseText);
    } catch {
      console.warn('[ghl-agent-trigger] Travis response was not JSON — status was ok, continuing');
    }

    // Fire digest notification for cron-sourced runs — non-blocking
    if (isCronSource) {
      sendDigestNotification(route, result, triggeredAt).catch(() => {
        // Already handled inside sendDigestNotification
      });
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[ghl-agent-trigger] ✅ ${route.agent_name} dispatched in ${elapsed}ms | approval_id: ${result.approval_id ?? 'pending'}`
    );

    return NextResponse.json({
      success: true,
      agent: route.agent_name,
      agent_id: route.agent_id,
      division: route.division,
      task: route.task,
      source: sourceLabel,
      approval_id: result.approval_id ?? null,
      cards_created: result.cards_created ?? null,
      notification_sent: isCronSource,
      elapsed_ms: elapsed,
      message: `${route.agent_name} activated — output queued for approval`,
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[ghl-agent-trigger] ❌ Dispatch error after ${elapsed}ms:`, error);
    return NextResponse.json(
      { error: 'Internal dispatch error', details: String(error), elapsed_ms: elapsed },
      { status: 500 }
    );
  }
}
