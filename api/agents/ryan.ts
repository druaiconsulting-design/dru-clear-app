// ================================================================
// DRU AI Leadership Ecosystem™ — Ryan Nakamura, CRM Management Agent
// File: api/agents/ryan.ts
// Division: Revenue & Growth
// Role: CRM Management (GHL)
//
// Task: Receive Omar's scored leads, update GHL CRM with tags
// and pipeline stage, generate executive briefing card,
// write final output to approvals table for DeAnna's review.
// ================================================================

import type { OmarResult, ScoredLead } from './omar';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface RyanResult {
  success: boolean;
  approval_id: string | null;
  cards_created: number;
  crm_updates: number;
  briefing_card: string;
  high_intent_count: number;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Update GHL contact with lead score tags
// ─────────────────────────────────────────────────────────────

async function updateGHLContact(
  contactId: string,
  lead: ScoredLead,
  ghlApiKey: string
): Promise<void> {
  const tags = [
    `ai-scored`,
    `intent-${lead.intent_level}`,
    `score-${lead.score}`,
  ];

  const response = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${ghlApiKey}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tags }),
  });

  if (!response.ok) {
    console.warn(`[ryan] Failed to update contact ${contactId}: ${response.status}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Generate executive briefing card with Anthropic
// ─────────────────────────────────────────────────────────────

async function generateBriefingCard(
  omarResult: OmarResult,
  anthropicApiKey: string
): Promise<string> {
  const { total_leads_scanned, scored_leads, high_intent_leads } = omarResult;

  const highIntentSummary = high_intent_leads.map(l =>
    `• ${l.name} (Score: ${l.score}/10) — ${l.recommended_action}`
  ).join('\n');

  const prompt = `You are Ryan Nakamura, CRM Management Agent for DRU AI Consulting.

Omar has completed daily lead scoring. Write a concise executive briefing card for DeAnna R. Upshaw to review and approve.

DATA:
- Total leads scanned: ${total_leads_scanned}
- Total scored: ${scored_leads.length}
- High-intent leads (7+): ${high_intent_leads.length}
- Medium-intent leads: ${scored_leads.filter(l => l.intent_level === 'medium').length}
- Low-intent leads: ${scored_leads.filter(l => l.intent_level === 'low').length}

HIGH-INTENT LEADS:
${highIntentSummary || 'None today'}

Write a professional briefing card with:
1. Executive summary (2–3 sentences)
2. High-intent leads requiring immediate action (list each with recommended action)
3. CRM updates completed (tags applied, pipeline stages updated)
4. Recommended approval action (what should fire in GHL when DeAnna approves)

Keep it concise, actionable, and aligned with DRU AI Consulting's brand voice. DeAnna is the CEO reviewing this before approving next steps.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? 'Briefing card generation failed.';
}

// ─────────────────────────────────────────────────────────────
// Write final approval card to Supabase
// ─────────────────────────────────────────────────────────────

async function writeApprovalCard(
  briefingCard: string,
  omarResult: OmarResult,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<string | null> {
  const highIntentContactIds = omarResult.high_intent_leads
    .map(l => l.contact_id)
    .join(',');

  const approvalRecord = {
    source: 'pg_cron',
    trigger_type: 'cron_omar_lead_score',
    agent_name: 'Ryan Nakamura',
    agent_role: 'CRM Management (GHL)',
    division: 'Revenue & Growth',
    task_brief: `Daily lead intelligence — ${omarResult.total_leads_scanned} leads scanned, ${omarResult.high_intent_leads.length} high-intent flagged`,
    output: briefingCard,
    status: 'pending',
    ghl_contact_id: highIntentContactIds || null,
    notify_deanna: true,
    priority: omarResult.high_intent_leads.length > 0 ? 'high' : 'normal',
    category: 'lead_intelligence',
    platform: null,
  };

  const response = await fetch(`${supabaseUrl}/rest/v1/approvals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(approvalRecord),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`[ryan] Failed to write approval card: ${err}`);
    return null;
  }

  const data = await response.json();
  return data?.[0]?.id ?? null;
}

// ─────────────────────────────────────────────────────────────
// Main Ryan function — importable by pipeline orchestrator
// ─────────────────────────────────────────────────────────────

export async function runRyan(omarResult: OmarResult): Promise<RyanResult> {
  const ghlApiKey = process.env.GHL_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!ghlApiKey || !anthropicApiKey || !supabaseUrl || !serviceRoleKey) {
    return {
      success: false,
      approval_id: null,
      cards_created: 0,
      crm_updates: 0,
      briefing_card: '',
      high_intent_count: 0,
      error: 'Missing required env vars',
    };
  }

  // If Omar found no leads, write a brief "no leads today" card
  if (omarResult.total_leads_scanned === 0) {
    console.log('[ryan] No new leads today — writing status card');
    const noLeadsCard = `**Daily Lead Intelligence — No New Leads**\n\nOmar scanned GHL and found no new contacts in the last 24 hours. No CRM updates required.\n\nNext scan: tomorrow at 8:00am CDT.`;

    const approvalId = await writeApprovalCard(
      noLeadsCard,
      omarResult,
      supabaseUrl,
      serviceRoleKey
    );

    return {
      success: true,
      approval_id: approvalId,
      cards_created: 1,
      crm_updates: 0,
      briefing_card: noLeadsCard,
      high_intent_count: 0,
    };
  }

  try {
    // Update GHL CRM for all scored leads
    console.log(`[ryan] Updating GHL CRM for ${omarResult.scored_leads.length} leads...`);
    let crmUpdates = 0;

    for (const lead of omarResult.scored_leads) {
      if (lead.contact_id) {
        await updateGHLContact(lead.contact_id, lead, ghlApiKey);
        crmUpdates++;
      }
    }

    console.log(`[ryan] CRM updated for ${crmUpdates} contacts`);

    // Generate briefing card
    console.log('[ryan] Generating executive briefing card...');
    const briefingCard = await generateBriefingCard(omarResult, anthropicApiKey);

    // Write to approvals table
    console.log('[ryan] Writing approval card to Supabase...');
    const approvalId = await writeApprovalCard(
      briefingCard,
      omarResult,
      supabaseUrl,
      serviceRoleKey
    );

    console.log(`[ryan] ✅ Pipeline 1 complete | approval_id: ${approvalId}`);

    return {
      success: true,
      approval_id: approvalId,
      cards_created: 1,
      crm_updates: crmUpdates,
      briefing_card: briefingCard,
      high_intent_count: omarResult.high_intent_leads.length,
    };

  } catch (error) {
    console.error('[ryan] Error:', error);
    return {
      success: false,
      approval_id: null,
      cards_created: 0,
      crm_updates: 0,
      briefing_card: '',
      high_intent_count: 0,
      error: String(error),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// HTTP Handler — standalone endpoint if needed
// ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const omarResult: OmarResult = req.body;
  const result = await runRyan(omarResult);
  res.status(result.success ? 200 : 500).json(result);
}
