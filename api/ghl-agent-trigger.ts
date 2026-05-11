// ================================================================
// DRU AI Leadership Ecosystem™ — Autonomous Entry Point
// File: api/ghl-agent-trigger.ts
// Runtime: Vercel Node.js Serverless
//
// Routes cron triggers to the correct agent or pipeline.
// Pipeline 1 (lead_intelligence): Omar → Ryan → approvals
// All other agents: direct dispatch to travis-router
// ================================================================

import { runOmar } from './agents/omar';
import { runRyan } from './agents/ryan';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface AgentRoute {
  agent_id: string;
  agent_name: string;
  division: string;
  task: string;
  description: string;
  pipeline?: string;
}

interface TriggerPayload {
  trigger_type: string;
  source?: string;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────
// Agent Routing Map
// ─────────────────────────────────────────────────────────────

const AGENT_ROUTES: Record<string, AgentRoute> = {

  // ── Pipeline 1 — Lead Intelligence ───────────────────────
  // Omar → Ryan → approvals table

  cron_omar_lead_score: {
    agent_id: 'omar',
    agent_name: 'Omar Patel',
    division: 'revenue',
    task: 'scan_score_route_leads',
    description: 'Pipeline 1: Omar scores leads, Ryan updates CRM and writes briefing card',
    pipeline: 'pipeline_1_lead_intelligence',
  },

  // ── Revenue Division ──────────────────────────────────────

  cron_ryan_crm_update: {
    agent_id: 'ryan',
    agent_name: 'Ryan Nakamura',
    division: 'revenue',
    task: 'overnight_crm_sync',
    description: 'Update CRM with overnight activity and contact changes',
  },

  // ── Marketing Division ────────────────────────────────────

  cron_camila_linkedin_queue: {
    agent_id: 'camila',
    agent_name: 'Camila Flores',
    division: 'marketing',
    task: 'generate_weekly_linkedin_queue',
    description: "Generate this week's LinkedIn content queue",
  },

  // ── Content/Brand Division ────────────────────────────────

  cron_content_daily_post: {
    agent_id: 'content',
    agent_name: 'Content Agent',
    division: 'content_brand',
    task: 'generate_daily_linkedin_post',
    description: "Generate today's LinkedIn post for approval",
  },

  // ── Analytics ─────────────────────────────────────────────

  cron_analytics_weekly: {
    agent_id: 'analytics',
    agent_name: 'Analytics Agent',
    division: 'analytics',
    task: 'weekly_performance_summary',
    description: 'Weekly performance summary for approval queue',
  },

  // ── GHL Webhook Triggers (existing) ───────────────────────

  lead_created: {
    agent_id: 'omar',
    agent_name: 'Omar Patel',
    division: 'revenue',
    task: 'score_new_lead',
    description: 'Score and route newly created GHL lead',
  },

  contact_updated: {
    agent_id: 'ryan',
    agent_name: 'Ryan Nakamura',
    division: 'revenue',
    task: 'process_contact_update',
    description: 'Process CRM contact update event',
  },

  assessment_completed: {
    agent_id: 'omar',
    agent_name: 'Omar Patel',
    division: 'revenue',
    task: 'route_assessment_lead',
    description: 'Route lead based on DRU CLEAR™ scorecard result',
  },

  support_ticket: {
    agent_id: 'support',
    agent_name: 'Isaiah Carter',
    division: 'customer_support',
    task: 'handle_support_request',
    description: 'Route and respond to incoming support request',
  },
};

// ─────────────────────────────────────────────────────────────
// Cron trigger types — get digest notification after run
// ─────────────────────────────────────────────────────────────

const CRON_TRIGGER_TYPES = new Set([
  'cron_omar_lead_score',
  'cron_ryan_crm_update',
  'cron_camila_linkedin_queue',
  'cron_content_daily_post',
  'cron_analytics_weekly',
]);

// ─────────────────────────────────────────────────────────────
// Pipeline 1 — Omar → Ryan
// ─────────────────────────────────────────────────────────────

async function runPipeline1(): Promise<{ approval_id: string | null; cards_created: number; summary: string }> {
  console.log('[pipeline-1] Starting Lead Intelligence pipeline...');

  // Step 1: Omar scores leads
  const omarResult = await runOmar();
  console.log(`[pipeline-1] Omar complete — ${omarResult.total_leads_scanned} leads, ${omarResult.high_intent_leads.length} high-intent`);

  // Step 2: Ryan updates CRM and writes briefing card
  const ryanResult = await runRyan(omarResult);
  console.log(`[pipeline-1] Ryan complete — approval_id: ${ryanResult.approval_id}`);

  return {
    approval_id: ryanResult.approval_id,
    cards_created: ryanResult.cards_created,
    summary: `Pipeline 1 complete: ${omarResult.total_leads_scanned} leads scored, ${ryanResult.high_intent_count} high-intent, ${ryanResult.crm_updates} CRM updates`,
  };
}

// ─────────────────────────────────────────────────────────────
// Direct agent dispatch — non-pipeline cron triggers
// ─────────────────────────────────────────────────────────────

async function dispatchToTravisRouter(
  route: AgentRoute,
  payload: TriggerPayload,
  triggeredAt: string,
  sourceLabel: string
): Promise<{ approval_id?: string; cards_created?: number }> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[ghl-agent-trigger] ❌ Missing Supabase env vars');
    return {};
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
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
          trigger_type: payload.trigger_type,
          source: sourceLabel,
          payload,
          triggered_at: triggeredAt,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);
    const text = await response.text();

    if (!response.ok) {
      console.error(`[ghl-agent-trigger] ❌ Travis router ${response.status}: ${text}`);
      return {};
    }

    try {
      return JSON.parse(text);
    } catch {
      return {};
    }

  } catch (error: unknown) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[ghl-agent-trigger] ⏱ Travis router timed out after 8s');
    } else {
      console.error('[ghl-agent-trigger] ❌ Dispatch error:', error);
    }
    return {};
  }
}

// ─────────────────────────────────────────────────────────────
// Digest Notification
// ─────────────────────────────────────────────────────────────

async function sendDigestNotification(
  agentName: string,
  task: string,
  division: string,
  cardsCreated: number,
  approvalId: string | null | undefined,
  triggeredAt: string,
  summary?: string
): Promise<void> {
  const webhookUrl = process.env.GHL_NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) return;

  const cardWord = cardsCreated !== 1 ? 'cards' : 'card';
  const taskReadable = task.replace(/_/g, ' ');

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'druaiconsulting@gmail.com',
        phone: '+19796186671',
        first_name: 'DeAnna',
        last_name: 'Upshaw',
        agent_name: agentName,
        division,
        task: taskReadable,
        cards_created: cardsCreated,
        approval_ids: approvalId ?? 'see queue',
        summary: summary ?? `${agentName} completed the ${taskReadable} task and dropped ${cardsCreated} ${cardWord} into your approval queue.`,
        triggered_at: triggeredAt,
        review_url: 'https://app.druaiconsulting.com/admin-approvals',
        sms_body: `DRU AI™ | ${agentName} dropped ${cardsCreated} ${cardWord} in your approval queue.\n\nTask: ${taskReadable}\nReview: app.druaiconsulting.com/admin-approvals`,
        email_subject: `DRU AI Ecosystem™ — ${agentName} Queue Update`,
        email_body: `Your AI Ecosystem ran on schedule.\n\nAgent: ${agentName}\nDivision: ${division}\nTask: ${taskReadable}\nCards in Queue: ${cardsCreated}\n\n${summary ?? ''}\n\nReview and approve:\nhttps://app.druaiconsulting.com/admin-approvals\n\n— DRU AI Leadership Ecosystem™`,
      }),
    });
    console.log(`[ghl-agent-trigger] ✅ Notification sent for ${agentName}`);
  } catch (error) {
    console.warn('[ghl-agent-trigger] Notification failed (non-fatal):', error);
  }
}

// ─────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const incomingSecret = req.headers['x-cron-secret'];
  if (incomingSecret !== undefined && incomingSecret !== process.env.CRON_SECRET) {
    console.error('[ghl-agent-trigger] ❌ Invalid cron secret');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const payload: TriggerPayload = req.body;

  if (!payload || !payload.trigger_type) {
    res.status(400).json({ error: 'trigger_type is required' });
    return;
  }

  const { trigger_type, source } = payload;
  const route = AGENT_ROUTES[trigger_type];

  if (!route) {
    console.warn(`[ghl-agent-trigger] ⚠️ Unknown trigger_type: ${trigger_type}`);
    res.status(400).json({ error: `Unknown trigger_type: ${trigger_type}` });
    return;
  }

  const sourceLabel = source ?? 'webhook';
  const triggeredAt = new Date().toISOString();
  const isCronSource = CRON_TRIGGER_TYPES.has(trigger_type);

  console.log(`[ghl-agent-trigger] ✅ Routing → ${route.agent_name} | ${route.division} | source: ${sourceLabel}`);

  let approvalId: string | null = null;
  let cardsCreated = 0;
  let pipelineSummary: string | undefined;

  // ── Route: Pipeline 1 (Omar → Ryan) ──────────────────────
  if (route.pipeline === 'pipeline_1_lead_intelligence') {
    const result = await runPipeline1();
    approvalId = result.approval_id;
    cardsCreated = result.cards_created;
    pipelineSummary = result.summary;

  // ── Route: Standard agent via travis-router ───────────────
  } else {
    const result = await dispatchToTravisRouter(route, payload, triggeredAt, sourceLabel);
    approvalId = result.approval_id ?? null;
    cardsCreated = result.cards_created ?? 1;
  }

  // Send digest notification for all cron runs
  if (isCronSource) {
    await sendDigestNotification(
      route.agent_name,
      route.task,
      route.division,
      cardsCreated,
      approvalId,
      triggeredAt,
      pipelineSummary
    );
  }

  res.status(202).json({
    success: true,
    agent: route.agent_name,
    division: route.division,
    task: route.task,
    pipeline: route.pipeline ?? null,
    source: sourceLabel,
    triggered_at: triggeredAt,
    approval_id: approvalId,
    cards_created: cardsCreated,
    summary: pipelineSummary ?? null,
    message: route.pipeline
      ? `Pipeline complete — briefing card queued for approval`
      : `${route.agent_name} activated — output queued for approval`,
  });
}
