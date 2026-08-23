// api/process-on-demand.ts
// Standalone on-demand chain processor — called by twin-on-demand.ts after CSQ write
// Flow: Isabella retry loop → Governance → Pipeline Review (Raymond, Master Orchestrator and Chief of Staff) → Twin synthesis → Intelligence Hub
// RESTRUCTURE (July 2026): Raymond runs pipeline review solo — one consolidated call absorbs
//   Travis's packaging note (package_notes) and Priya's "needs DeAnna today" flag (deanna_action).
//   travis_notes/priya_notes CSQ columns retained for compatibility, now Raymond-authored.
//   Travis Wealthy (name corrected from Weston) → Executive Producer, Video Production.
//   On-demand synthesis cards remain the Twin's — on-demand chat is her retained role.

import type { VercelRequest, VercelResponse } from "@vercel/node";
export const config = { maxDuration: 300 };
import { GENIUS_MODE, VOICE_DNA, getAgentKnowledge } from './_lib/agentKnowledge.js';

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

// Categories where the agent's raw output IS the deliverable — design briefs, social
// posts, copy, press releases, etc. These must pass through to the Intelligence Hub
// verbatim, not get rewritten into an executive-summary voice. This mirrors the exact
// same list and logic already used by the daily chain (raymond.ts) — the
// on-demand chain was missing this branch entirely, which is why on-demand design
// briefs were coming back as vague commentary instead of Ravi's actual spec.
// On-demand requests pass through raw by default — the agent's actual output IS
// the deliverable DeAnna wants. Only these agents' entire job is advising/reviewing
// DeAnna herself rather than producing something client-facing, so only they get
// the executive-synthesis rewrite. This list intentionally short and by name, not
// category — everyone else (Marketing, RGS, HR, Content & Brand, Client Delivery,
// Customer Support, Community Connection, etc.) passes through raw. Daily chain
// (raymond.ts) is untouched — DeAnna is auditing that queue separately.
const INTERNAL_ADVISORY_AGENTS = ['Raymond Holloway', 'Travis Wealthy', 'Priya Sharma', 'Isabella Moreno', 'Diego Reyes', 'Yuki Tanaka', 'Marcus Chen', 'Omar Patel', 'Ryan Nakamura', 'Hyun-Ji Kim'];

function getPlatformLabel(category: string): string {
  const map: Record<string, string> = {
    linkedin_post: 'LinkedIn', instagram_post: 'Instagram', facebook_post: 'Facebook',
    twitter_post: 'X', tiktok_post: 'TikTok', youtube_post: 'YouTube', social_post: 'Social',
    content_creation: 'Content', press_release: 'Press', design_brief: 'Design',
    localization: 'Localization', copywriting: 'Copy', email_marketing: 'Email', outreach: 'Outreach',
    linkedin_article: 'LinkedIn', newsletter_nonmember: 'Email', newsletter_freetier: 'Email', newsletter_navigator: 'Email', newsletter_accelerator: 'Email',
    jaylen_sequence_1: 'Email', jaylen_sequence_2: 'Email', jaylen_sequence_3: 'Email', jaylen_sequence_4: 'Email', jaylen_sequence_5: 'Email',
    jaylen_weekly_freetier: 'Email', jaylen_weekly_navigator: 'Email', jaylen_weekly_accelerator: 'Email',
  };
  return map[category] ?? 'Social';
}

// ─── JSON extractor — finds first complete JSON object, ignores surrounding content ──

function extractJSON(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); }
        catch { return null; }
      }
    }
  }
  return null;
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function dbGet(table: string, id: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] ?? null;
}

async function dbUpdate(table: string, id: string, updates: Record<string, unknown>): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify(updates),
  });
}

async function dbInsert(table: string, record: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: "return=representation" },
    body: JSON.stringify(record),
  });
  if (!res.ok) { console.error(`[on-demand] dbInsert failed: ${res.status} — ${await res.text()}`); return null; }
  const data = await res.json();
  return data?.[0]?.id ?? null;
}

// ─── Anthropic helpers ────────────────────────────────────────────────────────

async function callAnthropic(prompt: string, maxTokens = 800): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic Haiku error ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

// Sonnet — Isabella and Twin synthesis only
async function callTwin(prompt: string, maxTokens = 1000): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic Sonnet error ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

// ─── Division category map ────────────────────────────────────────────────────

function getDivisionCategory(division: string): string {
  const map: Record<string, string> = {
    "Revenue, Growth & Sales": "sales_support",
    "Content & Brand":         "content_creation",
    "Marketing":               "digital_marketing",
    "Legal & Finance":         "legal_briefing",
    "AI Governance":           "disclaimer_review",
    "HR":                      "onboarding",
    "Client Delivery":         "presentation_design",
    "Customer Support":        "issue_resolution",
    "Community Connection":    "community_management",
    "Pipeline Review":         "coaching",
  };
  return map[division] ?? "on_demand";
}

// ─── Step 1: Isabella compliance check (Sonnet) ───────────────────────────────

async function runIsabellaOnItem(item: Record<string, unknown>, agentKnowledge: string): Promise<{ cleared: boolean; flags: string; correctionNotes: string }> {
  const raw = await callTwin(
    `${GENIUS_MODE}

You are Isabella Moreno, Director of Compliance for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.

${agentKnowledge}

${VOICE_DNA}

YOUR RESPONSIBILITIES — check ALL FIVE of these, not trademarks alone:
1. TRADEMARKS: Every DRU proprietary framework name includes ™, in exact casing, and never abbreviated — the approved list and exact rules are in the knowledge base above
2. SERVICE CLASSES: Content stays within Classes 35, 41, 42 (see knowledge base above)
3. VOICE: No banned words, hook-then-unpack structure honored wherever the content includes a hook or headline — see the VOICE rules above
4. FACTUAL ACCURACY: No invented client results, dollar figures, percentages, testimonials, or case studies that were not explicitly given in the task or in DeAnna's verified facts — see the FACTUAL ACCURACY rule above
5. FRAMEWORK ATTRIBUTION: If the content describes a framework's pillars or dimensions, check the names against the true definitions in the knowledge base above. A framework's pillars must be attributed to the correct framework — e.g. Clarity/Leadership/Execution/Alignment/Results belongs to DRU CLEAR™ and must never be labeled 5D Leadership™; Self/People/Team/Organization/Visionary belongs to 5D Leadership™ and must never be labeled DRU CLEAR™

CLEARING STANDARD:
- All five checks pass → cleared:true
- Any one check fails → cleared:false — state exactly which check failed (name it: trademark, service class, voice, factual accuracy, or framework attribution) and why

AGENT: ${item.agent_name} | TASK: ${item.task}
CONTENT TO REVIEW:
${item.raw_output}

You MUST respond with ONLY the JSON below. No preamble, no explanation, no markdown. Just the raw JSON object:
{"cleared":true,"flags":"none","correction_notes":"Content reviewed. All five checks passed."}
OR:
{"cleared":false,"flags":"specific issue here — name which check failed","correction_notes":"Exact instruction for the agent to correct this"}`,
    800
  );

  const result = extractJSON(raw);
  if (!result) throw new Error(`Isabella JSON parse failed. Raw response: ${raw.slice(0, 200)}`);
  // False-positive guard: Isabella contradicted herself — cleared:false but correction_notes say content is fine
  if (result.cleared === false) {
    const corrNote = String(result.correction_notes ?? "").toLowerCase();
    const isSelfContradicting =
      corrNote.includes("no corrections needed") ||
      corrNote.includes("content is compliant") ||
      corrNote.includes("content clears") ||
      corrNote.includes("nothing to correct") ||
      corrNote.includes("already approved") ||
      corrNote.includes("all marks correct");
    if (isSelfContradicting) {
      console.log(`[on-demand] ⚠️ Isabella false-positive overridden — correction_notes confirm content is clean`);
      result.cleared = true;
      result.flags = "none";
      result.correction_notes = "False positive overridden. Content confirmed compliant.";
    }
  }
  return { cleared: result.cleared === true, flags: String(result.flags ?? "none"), correctionNotes: String(result.correction_notes ?? "") };
}

// ─── Correction agent ─────────────────────────────────────────────────────────

async function runCorrectionAgent(item: Record<string, unknown>, correctionNotes: string, retryCount: number): Promise<string | null> {
  const correctedOutput = await callAnthropic(
    `You are a compliance editor making ONE targeted correction to an existing document.

CORRECTION REQUIRED BY ISABELLA MORENO (Director of Compliance):
${correctionNotes}

RULES — strictly enforced:
1. Copy the ENTIRE original content below VERBATIM — every word, every line, every character
2. Make ONLY the specific change Isabella identified above — nothing else
3. Do NOT rewrite, rephrase, restructure, or improve any other part of the document
4. Do NOT add new content, frameworks, or marks that are not already in the original
5. Do NOT remove any existing ™ symbols that are already correctly placed
6. If you are unsure what to change, change only the minimum possible

ORIGINAL CONTENT (copy verbatim, apply only the one correction above):
${item.raw_output}`,
    2000
  );

  return await dbInsert("chief_of_staff_queue", {
    agent_id:         item.agent_id,
    agent_name:       item.agent_name,
    division:         item.division,
    task:             item.task,
    category:         item.category,
    raw_output:       correctedOutput,
    priority:         item.priority ?? "high",
    status:           "pending",
    retry_count:      retryCount,
    correction_notes: correctionNotes,
    parent_csq_id:    item.id,
    raymond_notes:    item.raymond_notes ?? null,
    run_date:         new Date().toISOString().split("T")[0],
  });
}

// ─── Step 2: Governance Panel (Haiku) ────────────────────────────────────────

async function runGovernanceOnItem(item: Record<string, unknown>): Promise<{ cleared: boolean; notes: string; flags: string }> {
  // Same rule as Twin synthesis: client-facing by default, except the short named
  // internal-advisory list. Keeps Governance's block conditions consistent with
  // which agents actually produce client-facing deliverables vs internal advice.
  const isInternalAdvisory = INTERNAL_ADVISORY_AGENTS.some(name =>
    (item.agent_name as string).toLowerCase().includes(name.toLowerCase())
  );
  const isClientFacing = !isInternalAdvisory;

  const raw = await callAnthropic(
    `${GENIUS_MODE}

You are the AI Governance and Legal & Finance panel for DRU AI Consulting. Isabella Moreno has cleared this content for trademark and class compliance. Your role is to review for legal risk, privacy concerns, financial accuracy, and brand consistency.

PANEL MEMBERS: Khalid Hassan (Disclaimers) · Sofia Petrov (Privacy) · James Osei (Contracts) · Mei Lin (Brand Protection)

TRADEMARK RULE — NEVER BLOCK ON THIS, NO EXCEPTIONS:
DeAnna's marks (DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™) all correctly use the ™ symbol, not ®. ™ denotes a claimed trademark and requires ZERO federal registration — pending, common-law, or unregistered marks all use ™ correctly and permanently, regardless of any USPTO filing's status. This is true no matter what stage any trademark application is in. Do NOT flag, question, request confirmation of, or block on trademark registration status, USPTO/EUIPO filing status, or "portfolio validation" — Isabella already cleared correct ™ usage, and that is the only thing that matters. This would only be a real concern if ® were used, which never happens here.

CONTENT TYPE: ${isClientFacing ? "CLIENT-FACING MARKETING" : "INTERNAL OPERATIONAL"}

${isClientFacing
  ? `CLIENT-FACING BLOCK CONDITIONS — block ONLY if one of these 5 exact conditions is explicitly present. No other reason to block:
1. Makes a specific earnings or income guarantee ("you will earn $X", "guaranteed ROI of X%")
2. Claims a professional license or credential DeAnna does not hold
3. Contains PII of a real named third party without their consent
4. Directly defames or makes provably false claims about a named competitor
5. Contains regulatory-specific financial, medical, or legal advice presented as verified fact

DO NOT BLOCK FOR ANY OF THE FOLLOWING — these are standard and permitted in B2B marketing:
- Presenting DRU proprietary frameworks (DRU CLEAR™, 5C Cultural DNA™, 5D Leadership™, etc.) as established methodologies — they are DeAnna's registered IP
- Aspirational or authoritative language positioning DeAnna as an expert ("frameworks that guide executives", "proven approach")
- Outcome-oriented marketing language ("designed to help leaders achieve...", "framework built to...")
- Specific illustrative numbers used as examples, not contractual guarantees
- LinkedIn post tone, hooks, or confident claims standard in B2B consulting marketing
- Use of ™ on all approved DRU framework names

If NONE of conditions 1-5 are explicitly present, you MUST return cleared:true regardless of tone, style, or marketing claims.`
  : `INTERNAL OPERATIONAL BLOCK CONDITIONS (block ONLY if ALL apply):
1. Contains a factual error that would directly mislead DeAnna's business decisions
2. Makes a false credential claim on DeAnna's behalf
3. Creates a named legal liability
4. Contains a demonstrably false financial figure presented as fact
Coaching philosophy, motivational language, sales strategy, and aspirational framing SHALL PASS.`}

AGENT: ${item.agent_name} | TASK: ${item.task}
CONTENT: ${item.raw_output}

Respond with ONLY this JSON — no preamble, no markdown:
{"cleared":true,"notes":"Governance review complete. No issues found.","flags":"none"}
OR:
{"cleared":false,"notes":"Reason for block","flags":"specific issue"}`,
    600
  );

  const result = extractJSON(raw);
  if (!result) throw new Error(`Governance JSON parse failed. Raw: ${raw.slice(0, 200)}`);
  return { cleared: result.cleared === true, notes: String(result.notes ?? ""), flags: String(result.flags ?? "none") };
}

// ─── Step 3: Pipeline Review — Raymond Holloway, Master Orchestrator and Chief of Staff (Haiku) ───
// One consolidated call replaces the former Priya → Travis → Raymond sequence.
// Return shape unchanged: priyaNotes carries his deanna_action, travisNotes his
// package_notes — same CSQ columns downstream, all Raymond-authored.

async function runPipelineReviewOnItem(item: Record<string, unknown>): Promise<{ approved: boolean; priyaNotes: string; travisNotes: string; raymondNotes: string; action: string }> {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" });

  const raymondRaw = await callAnthropic(
    `${GENIUS_MODE}
You are Raymond Holloway, Master Orchestrator and Chief of Staff for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. You run this pipeline review in a single consolidated pass.
This is an on-demand request from DeAnna. Review and approve for the Intelligence Hub.
Your single review covers three responsibilities:
1. FINAL ASSESSMENT — approve and assess, with routing action: route_to_daily_briefing, route_to_aaliyah_foster, or acknowledge_completion.
2. PACKAGING — one sentence on how this output should be framed for DeAnna.
3. DEANNA FLAG — anything time-sensitive or requiring DeAnna's personal action today. If nothing, use an empty string.
DATE: ${today} | AGENT: ${item.agent_name} | TASK: ${item.task}
CONTENT: ${item.raw_output}
Respond with ONLY this JSON — no preamble: {"approved":true,"action":"route_to_daily_briefing","notes":"your final assessment","package_notes":"one sentence framing","deanna_action":"time-sensitive item needing DeAnna today, or empty string"}`, 500);
  const raymond = extractJSON(raymondRaw) ?? { approved: true, action: "route_to_daily_briefing", notes: "Approved for Intelligence Hub.", package_notes: "Output reviewed and packaged.", deanna_action: "" };

  return {
    approved:     raymond.approved !== false,
    priyaNotes:   String(raymond.deanna_action ?? ""),
    travisNotes:  String(raymond.package_notes ?? ""),
    raymondNotes: String(raymond.notes ?? ""),
    action:       String(raymond.action ?? "route_to_daily_briefing"),
  };
}

// ─── Step 4: Twin synthesis → Intelligence Hub (Sonnet) ──────────────────────

async function runTwinSynthesisOnItem(
  item: Record<string, unknown>,
  pipelineNotes: { priya: string; travis: string; raymond: string; action: string },
  complianceFlags: string[]
): Promise<string | null> {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" });

  // ── Passthrough by default — only internal-advisory agents get synthesized ──
  // Everyone else's raw output IS the deliverable DeAnna wants — she takes Ravi's
  // brief straight to Claude Design, Amelia's script straight to production, etc.
  // Only the short named list below is exempted, since their entire job is
  // advising/reviewing DeAnna rather than producing client-facing output.
  const isInternalAdvisory = INTERNAL_ADVISORY_AGENTS.some(name =>
    (item.agent_name as string).toLowerCase().includes(name.toLowerCase())
  );

  if (!isInternalAdvisory) {
    console.log(`[on-demand] Passthrough by default — raw output for ${item.agent_name} (category=${item.category})`);
    // Strip any trailing compliance-audit sections and markdown bold/italic markers,
    // but do NOT rewrite the actual content.
    let content = item.raw_output as string;
    const complianceCutoffs = ['## COMPLIANCE AUDIT', 'COMPLIANCE AUDIT', '## Isabella', 'CORRECTION REQUIRED'];
    for (const cutoff of complianceCutoffs) { const idx = content.indexOf(cutoff); if (idx !== -1) content = content.slice(0, idx).trim(); }
    content = content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');

    // Categories with a known social/platform label get tagged as such; everything
    // else gets a generic content_review card. Either way, the content is verbatim.
    // Readable label for Jaylen's specific email editions, so the card heading says which one
    // this is (non-member sequence stage, or which tier's weekly email) instead of just "Email."
    const JAYLEN_LABELS: Record<string, string> = {
      jaylen_sequence_1: 'Non-Member Sequence — Email 1 (Welcome)',
      jaylen_sequence_2: 'Non-Member Sequence — Email 2 (Value/Pain Point)',
      jaylen_sequence_3: 'Non-Member Sequence — Email 3 (Proof/Story)',
      jaylen_sequence_4: 'Non-Member Sequence — Email 4 (Honest)',
      jaylen_sequence_5: 'Non-Member Sequence — Email 5 (The Ask)',
      jaylen_weekly_freetier: 'Weekly Email — Free-Tier',
      jaylen_weekly_navigator: 'Weekly Email — Navigator',
      jaylen_weekly_accelerator: 'Weekly Email — Accelerator',
    };
    const jaylenLabel = JAYLEN_LABELS[item.task as string];

    const knownPlatformCategories = ['linkedin_post','instagram_post','facebook_post','twitter_post','tiktok_post','youtube_post','social_post','email_marketing','press_release','design_brief','localization','copywriting','linkedin_article','newsletter_nonmember','newsletter_freetier','newsletter_navigator','newsletter_accelerator','jaylen_sequence_1','jaylen_sequence_2','jaylen_sequence_3','jaylen_sequence_4','jaylen_sequence_5','jaylen_weekly_freetier','jaylen_weekly_navigator','jaylen_weekly_accelerator'];
    if (knownPlatformCategories.includes(item.category as string)) {
      const platformLabel = getPlatformLabel(item.category as string);
      // "Emails" is its own category, separate from social media (Aug 2026 fix) — matches
      // the same split made in raymond.ts's daily synthesis path, so a card looks and
      // dispatches the same whether it came from the daily cron or an on-demand chat request.
      const isEmailPlatform = platformLabel === 'Email';
      return await dbInsert("approvals", {
        source:        "twin_on_demand",
        trigger_type:  item.task,
        agent_name:    item.agent_name,
        agent_role:    item.division,
        division:      item.division,
        task_brief:    `${jaylenLabel ?? platformLabel} — On-Demand: ${item.agent_name} | ${today}`,
        output:        content,
        status:        "pending",
        notify_deanna: true,
        priority:      "high",
        category:      isEmailPlatform ? "email" : "social",
        platform:      platformLabel,
      });
    }

    return await dbInsert("approvals", {
      source:        "twin_on_demand",
      trigger_type:  item.task,
      agent_name:    item.agent_name,
      agent_role:    item.division,
      division:      item.division,
      task_brief:    `${(item.task as string).replace(/_/g, ' ')} — On-Demand: ${item.agent_name} | ${today}`,
      output:        content,
      status:        "pending",
      notify_deanna: true,
      priority:      "high",
      category:      "content_review",
      platform:      null,
    });
  }

  const flagsSection = complianceFlags.length > 0
    ? `\n\nCOMPLIANCE FLAGS — include at end of card as "## Compliance Flags" section:\n${complianceFlags.map(f => `- ${f}`).join("\n")}`
    : "";

  const notes = [
    pipelineNotes.raymond ? `Raymond: ${pipelineNotes.raymond}`     : "",
    pipelineNotes.travis  ? `Packaging: ${pipelineNotes.travis}`    : "",
    pipelineNotes.priya   ? `Needs DeAnna: ${pipelineNotes.priya}`  : "",
  ].filter(Boolean).join("\n");

  const synthesis = await callTwin(
    `${GENIUS_MODE}

You are DeAnna's AI Twin — Master Orchestrator of the DRU AI Leadership Ecosystem™.

Synthesize this on-demand agent output into an Intelligence Hub briefing card for DeAnna R. Upshaw, AI Authority.

AGENT: ${item.agent_name} | DIVISION: ${item.division} | TASK: ${item.task}
DATE: ${today} | TYPE: On-Demand Request
CHAIN STATUS: ✅ Isabella Cleared | ✅ Governance Cleared | ✅ Pipeline Review Approved

AGENT OUTPUT:
${item.raw_output}

${notes ? `PIPELINE REVIEW NOTES:\n${notes}` : ""}

Synthesize into a focused, actionable briefing card. Lead with what matters most. End with clear next steps for DeAnna. Write in your commanding Twin voice — strategic, direct, no fluff.${flagsSection}`,
    1500
  );

  return await dbInsert("approvals", {
    source:        "twin_on_demand",
    trigger_type:  "on_demand_request",
    agent_name:    "DeAnna's AI Twin",
    agent_role:    "Master Orchestrator",
    division:      item.division,
    task_brief:    `${item.division} — On-Demand: ${item.agent_name} | ${today}`,
    output:        synthesis,
    status:        "pending",
    notify_deanna: true,
    priority:      "high",
    category:      getDivisionCategory(item.division as string),
    platform:      null,
  });
}

// ─── Concurrency lock release ─────────────────────────────────────────────────
// Lock is acquired by twin-on-demand.ts before this endpoint is called. This
// endpoint owns releasing it — on every exit path — since it's the long-running
// half of the chain where most of the credit cost actually happens.

async function releaseLock(): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/on_demand_lock?id=eq.1`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify({ is_locked: false, locked_by: null }),
  }).catch((err) => console.error("[on-demand] releaseLock failed:", err));
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-cron-secret");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const { csq_id } = req.body ?? {};
  if (!csq_id) { await releaseLock(); res.status(400).json({ error: "csq_id required" }); return; }

  console.log(`[on-demand] 🚀 Starting full chain for CSQ: ${csq_id}`);

  let currentId = csq_id as string;
  const complianceFlags: string[] = [];

  // Fetched once per request — live brand_marks plus voice/framework knowledge,
  // same shared source of truth the daily chain and on-demand agent runs use.
  const agentKnowledge = await getAgentKnowledge();

  // NOTE: lock is acquired by twin-on-demand.ts before this endpoint fires.
  // This handler owns releasing it on every exit path below (finally block).
  try {
    // ── STEP 1: Isabella retry loop ──────────────────────────
    let isabellaPassed = false;

    for (let attempt = 0; attempt <= 3; attempt++) {
      const item = await dbGet("chief_of_staff_queue", currentId);
      if (!item) { await releaseLock(); res.status(404).json({ error: "CSQ item not found" }); return; }

      console.log(`[on-demand] Isabella attempt ${attempt + 1} for: ${item.agent_name}`);
      const retryCount = (item.retry_count as number) ?? 0;
      const { cleared, flags, correctionNotes } = await runIsabellaOnItem(item, agentKnowledge);

      if (cleared) {
        await dbUpdate("chief_of_staff_queue", currentId, {
          isabella_flags: flags,
          isabella_cleared_at: new Date().toISOString(),
          status: "isabella_cleared",
        });
        console.log(`[on-demand] ✅ Isabella cleared: ${item.agent_name}`);
        isabellaPassed = true;
        break;
      }

      if (attempt >= 2) {
        await dbUpdate("chief_of_staff_queue", currentId, {
          isabella_flags: flags,
          correction_notes: correctionNotes,
          status: "rejected",
          governance_cleared: false,
        });
        console.warn(`[on-demand] ⛔ Hard rejected by Isabella: ${item.agent_name} — ${flags}`);
        await releaseLock();
        res.status(200).json({ success: false, reason: "hard_rejected_by_isabella", agent: item.agent_name, flags });
        return;
      }

      await dbUpdate("chief_of_staff_queue", currentId, {
        isabella_flags: flags,
        correction_notes: correctionNotes,
        status: "needs_correction",
      });
      complianceFlags.push(`${item.agent_name} — CORRECTION APPLIED (attempt ${retryCount + 1}) — ${flags}`);
      console.log(`[on-demand] 🔄 Correction applied for: ${item.agent_name}`);

      const newId = await runCorrectionAgent(item, correctionNotes, retryCount + 1);
      if (!newId) { await releaseLock(); res.status(500).json({ error: "Correction agent failed" }); return; }
      currentId = newId;
    }

    if (!isabellaPassed) { await releaseLock(); res.status(500).json({ error: "Isabella loop exhausted" }); return; }

    const clearedItem = await dbGet("chief_of_staff_queue", currentId);
    if (!clearedItem) { await releaseLock(); res.status(404).json({ error: "Cleared item not found" }); return; }

    // ── STEP 2: Governance Panel ─────────────────────────────
    console.log(`[on-demand] Running Governance for: ${clearedItem.agent_name}`);
    const gov = await runGovernanceOnItem(clearedItem);

    if (!gov.cleared) {
      await dbUpdate("chief_of_staff_queue", currentId, {
        governance_cleared: false,
        governance_flags: gov.flags,
        governance_notes: gov.notes,
        status: "rejected",
      });
      console.warn(`[on-demand] ⛔ Governance blocked: ${clearedItem.agent_name}`);
      await releaseLock();
      res.status(200).json({ success: false, reason: "governance_blocked", agent: clearedItem.agent_name, flags: gov.flags });
      return;
    }

    await dbUpdate("chief_of_staff_queue", currentId, {
      governance_cleared: true,
      governance_notes: gov.notes,
      governance_cleared_at: new Date().toISOString(),
      status: "governance_cleared",
    });
    console.log(`[on-demand] ✅ Governance cleared: ${clearedItem.agent_name}`);

    // ── STEP 3: Pipeline Review ──────────────────────────────
    console.log(`[on-demand] Running Pipeline Review for: ${clearedItem.agent_name}`);
    const pipelineResult = await runPipelineReviewOnItem(clearedItem);

    await dbUpdate("chief_of_staff_queue", currentId, {
      raymond_reviewed:    true,
      raymond_action:      pipelineResult.action,
      priya_notes:         pipelineResult.priyaNotes,
      travis_notes:        pipelineResult.travisNotes,
      raymond_notes:       pipelineResult.raymondNotes,
      pipeline_approved_at: new Date().toISOString(),
      status:                "pipeline_approved",
    });
    console.log(`[on-demand] ✅ Pipeline Review approved: ${clearedItem.agent_name}`);

    // ── STEP 4: Twin synthesis → Intelligence Hub ────────────
    console.log(`[on-demand] Running Twin synthesis for: ${clearedItem.agent_name}`);
    const approvalId = await runTwinSynthesisOnItem(
      clearedItem,
      { priya: pipelineResult.priyaNotes, travis: pipelineResult.travisNotes, raymond: pipelineResult.raymondNotes, action: pipelineResult.action },
      complianceFlags
    );

    await dbUpdate("chief_of_staff_queue", currentId, {
      raymond_processed:    true,
      raymond_processed_at: new Date().toISOString(),
      approval_id:          approvalId,
      status:               "raymond_processed",
    });

    await releaseLock();
    console.log(`[on-demand] ✅ Chain complete — ${clearedItem.agent_name} | Card: ${approvalId}`);
    res.status(200).json({ success: true, agent_name: clearedItem.agent_name, approval_id: approvalId, final_csq_id: currentId });

  } catch (err) {
    console.error("[on-demand] ❌ Chain error:", err);
    await releaseLock();
    res.status(500).json({ error: String(err) });
  }
}
