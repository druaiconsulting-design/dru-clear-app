// ================================================================
// DRU AI Leadership Ecosystem™ — Autonomous Entry Point
// File: api/ghl-agent-trigger.ts
// Runtime: Vercel Edge (non-Next.js / Vite stack)
//
// Uses standard Web API Request/Response — no next/server dependency.
// ================================================================

export const config = { runtime: 'edge' };

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
// Helper: JSON response
// ─────────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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
// ─────────────────────────────────────────────────────────────

const CRON_TRIGGER_TYPES = new Set([
  'cron_omar_lead_score',
  'cron_ryan_crm_update',
  'cron_camila_linkedin_queue',
  'cron_content_daily_post',
  'cron_analytics_weekly',
]);

// ─────────────────────────────────────────────────────────────
// Digest Notification — fire-and-forget after cron agent run
// ─────────────────────────────────────────────────────────────

async function sendDigestNotification(
  route: AgentRoute,
  result: TravisRouterResponse,
  triggeredAt: string
): Promise<void> {
  const webhookUrl = (globalThis as unknown as Record<string, string>)['GHL_NOTIFICATION_WEBHOOK_URL']
    ?? (typeof process !== 'undefined' ? process.env.GHL_NOTIFICATION_WEBHOOK_URL : undefined);

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
    agent_name: route.agent_name,
    agent_id: route.agent_id,
    division: route.division,
    task: taskReadable,
    cards_created: cardsCreated,
    approval_ids: approvalIds.join(', ') || 'see queue',
    summary,
    triggered_at: triggeredAt,
    review_url: 'https://app.druaiconsulting.com/admin-approvals',
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
    console.warn('[ghl-agent-trigger] Notification dispatch failed (non-fatal):', error);
  }
}

// ─────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  const startTime = Date.now();

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Validate cron secret
  const incomingSecret = req.headers.get('x-cron-secret');
  if (incomingSecret !== null && incomingSecret !== process.env.CRON_SECRET) {
    console.error('[ghl-agent-trigger] ❌ Invalid cron secret');
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  // Parse body
  let payload: TriggerPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { trigger_type, source } = payload;

  if (!trigger_type) {
    return jsonResponse({ error: 'trigger_type is required' }, 400);
  }

  const route = AGENT_ROUTES[trigger_type];

  if (!route) {
    console.warn(`[ghl-agent-trigger] ⚠️ Unknown trigger_type: ${trigger_type}`);
    return jsonResponse({ error: `Unknown trigger_type: ${trigger_type}` }, 400);
  }

  const sourceLabel = source ?? 'webhook';
  const triggeredAt = new Date().toISOString();
  const isCronSource = CRON_TRIGGER_TYPES.has(trigger_type);

  console.log(`[ghl-agent-trigger] ✅ Routing → ${route.agent_name} | ${route.division} | ${route.task} | source: ${sourceLabel}`);

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[ghl-agent-trigger] ❌ Missing Supabase env vars');
    return jsonResponse({ error: 'Server configuration error' }, 500);
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
      console.error(`[ghl-agent-trigger] ❌ Travis router ${travisResponse.status}: ${responseText}`);
      return jsonResponse({ error: 'Agent dispatch failed', status_code: travisResponse.status, details: responseText }, 502);
    }

    let result: TravisRouterResponse = {};
    try {
      result = JSON.parse(responseText);
    } catch {
      console.warn('[ghl-agent-trigger] Travis response non-JSON — status ok, continuing');
    }

    if (isCronSource) {
      sendDigestNotification(route, result, triggeredAt).catch(() => {});
    }

    const elapsed = Date.now() - startTime;
    console.log(`[ghl-agent-trigger] ✅ ${route.agent_name} dispatched in ${elapsed}ms`);

    return jsonResponse({
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
    return jsonResponse({ error: 'Internal dispatch error', details: String(error), elapsed_ms: elapsed }, 500);
  }
}
