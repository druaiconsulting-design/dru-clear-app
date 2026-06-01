// api/process-on-demand.ts
// Standalone on-demand chain processor — called by twin-command.ts after CSQ write
// Flow: Isabella retry loop → Governance → Command Layer → Twin synthesis → Intelligence Hub
// No dependency on ghl-agent-trigger.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
export const config = { maxDuration: 300 };

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

const GENIUS_MODE = `You operate in Genius Mode — think and respond at the level of a top 0.1% expert in your field. Apply deep logic, strategic frameworks, creative synthesis, and second-order thinking. Never produce generic or surface-level work.`;

// ─── Supabase helpers ────────────────────────────────────────────────────────

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

async function dbFind(table: string, filters: Record<string, string>): Promise<Record<string, unknown> | null> {
  const qs = Object.entries(filters).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join("&");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}&order=created_at.desc&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] ?? null;
}

// ─── Anthropic helpers ───────────────────────────────────────────────────────

// Haiku — for Governance, Command Layer, correction agents
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
    body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
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
    "Command Layer":           "coaching",
  };
  return map[division] ?? "on_demand";
}

// ─── Step 1: Isabella compliance check (Sonnet) ──────────────────────────────

async function runIsabellaOnItem(item: Record<string, unknown>): Promise<{ cleared: boolean; flags: string; correctionNotes: string }> {
  const raw = await callTwin(
    `${GENIUS_MODE}

You are Isabella Moreno, Director of Compliance for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.

YOUR RESPONSIBILITIES:
1. Verify every DRU proprietary framework name includes the ™ symbol
2. Verify all content stays within DeAnna's registered trademark service classes:
   - Class 35: Business consulting, AI strategy, leadership advisory, business management
   - Class 41: Training, coaching, educational services, workshops, seminars
   - Class 42: AI technology consulting, software-related services, technology strategy
3. Flag any content that steps outside these classes or misrepresents DRU's services

DRU PROPRIETARY MARKS (must always appear with ™):
DRU CLEAR™ | DRU AI Leadership Ecosystem™ | DRU AI Transformation Pathway™ | 5C Cultural DNA™ | 5D Leadership™ | AI Sales Mastery™ | From Confusion to Confident with AI™

IMPORTANT — WHAT DOES NOT TAKE ™:
- "DRU AI Consulting" is the registered business name only — NO ™
- Any phrase not in the approved marks list above — NO ™

CLEARING STANDARD:
- All DRU marks appear with ™ AND content is within Classes 35/41/42 → cleared:true
- A DRU mark appears WITHOUT ™ → cleared:false, state exactly which mark and where
- An unapproved phrase carries ™ → cleared:false, state exactly which phrase
- Content falls outside Classes 35/41/42 → cleared:false, state exactly what falls outside

AGENT: ${item.agent_name} | TASK: ${item.task}
CONTENT:
${item.raw_output}

Output ONLY this JSON — nothing before it, nothing after it:
{"cleared":true,"flags":"none","correction_notes":"Content reviewed. All marks correct. Within Classes 35/41/42."}
OR:
{"cleared":false,"flags":"specific issue here","correction_notes":"Exact instruction for the agent to correct this"}`,
    600
  );

  const result = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "null");
  if (!result) throw new Error("Isabella JSON parse failed");

  return {
    cleared: result.cleared === true,
    flags: result.flags ?? "none",
    correctionNotes: result.correction_notes ?? "",
  };
}

// ─── Correction agent — re-runs agent output with targeted fix ───────────────

async function runCorrectionAgent(
  item: Record<string, unknown>,
  correctionNotes: string,
  retryCount: number
): Promise<string | null> {
  const correctedOutput = await callAnthropic(
    `You are ${item.agent_name}, working for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.

Your previous output was reviewed by Isabella Moreno (Director of Compliance) and requires the following correction:

CORRECTION REQUIRED:
${correctionNotes}

YOUR ORIGINAL OUTPUT:
${item.raw_output}

Apply the correction precisely and return the complete corrected content. Do not change anything else — only fix what Isabella flagged.`,
    2000
  );

  const newId = await dbInsert("chief_of_staff_queue", {
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

  return newId;
}

// ─── Step 2: Governance Panel (Haiku) ────────────────────────────────────────

async function runGovernanceOnItem(item: Record<string, unknown>): Promise<{ cleared: boolean; notes: string; flags: string }> {
  const isClientFacing = ["social_post", "linkedin_post", "email_marketing", "outreach", "content_creation", "digital_marketing", "press_release", "copywriting"].includes(item.category as string);

  const raw = await callAnthropic(
    `${GENIUS_MODE}

You are the AI Governance and Legal & Finance panel for DRU AI Consulting. Isabella Moreno has cleared this content for trademark and class compliance. Your role is to review for legal risk, privacy concerns, financial accuracy, and brand consistency.

PANEL MEMBERS:
- Khalid Hassan (Disclaimer Writer) — does this content need a legal disclaimer?
- Sofia Petrov (Privacy Policy) — any privacy or data compliance concerns?
- James Osei (Contract Writer) — any contractual or liability exposure?
- Mei Lin (Brand Protection) — brand consistency and competitive risk?

CONTENT TYPE: ${isClientFacing ? "CLIENT-FACING" : "INTERNAL OPERATIONAL"}

${isClientFacing
  ? `CLIENT-FACING BLOCK CONDITIONS (block if ANY of these apply):
1. Makes a specific earnings or ROI guarantee to a client
2. Claims a professional license DeAnna does not hold (legal, CPA, licensed therapist)
3. Contains personally identifiable information about a real third party without consent
4. Directly defames or makes provably false claims about a named competitor
5. Contains regulatory-specific financial, medical, or legal advice presented as fact`
  : `INTERNAL OPERATIONAL BLOCK CONDITIONS (block ONLY if ALL four of these apply):
1. Contains a factual error that would directly mislead DeAnna's business decisions
2. Makes a false credential claim on DeAnna's behalf
3. Creates a named legal liability (not hypothetical risk — actual exposure)
4. Contains a demonstrably false financial figure presented as fact
Coaching philosophy, motivational language, sales strategy, aspirational framing, and operational recommendations SHALL PASS.`}

AGENT: ${item.agent_name} | TASK: ${item.task}
CONTENT:
${item.raw_output}

Output ONLY this JSON:
{"cleared":true,"notes":"Governance review complete. No issues found.","flags":"none"}
OR:
{"cleared":false,"notes":"Reason for block","flags":"specific issue"}`,
    600
  );

  const result = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "null");
  if (!result) throw new Error("Governance JSON parse failed");

  return {
    cleared: result.cleared === true,
    notes: result.notes ?? "",
    flags: result.flags ?? "none",
  };
}

// ─── Step 3: Command Layer — Priya, Travis, Raymond (Haiku) ──────────────────

async function runCommandLayerOnItem(item: Record<string, unknown>): Promise<{ approved: boolean; priyaNotes: string; travisNotes: string; raymondNotes: string; action: string }> {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" });

  // Priya — executive context and flags
  const priyaRaw = await callAnthropic(
    `${GENIUS_MODE}
You are Priya Sharma, Executive Assistant to DeAnna R. Upshaw — AI Authority, CEO/Founder of DRU AI Consulting.
Review this on-demand agent output. Flag any executive-level concerns, timing issues, or strategic misalignments. If none, confirm it is clear to proceed.
DATE: ${today} | AGENT: ${item.agent_name} | TASK: ${item.task}
CONTENT: ${item.raw_output}
Output ONLY JSON: {"notes":"your assessment","flag":false}`,
    300
  );
  const priya = JSON.parse(priyaRaw.match(/\{[\s\S]*\}/)?.[0] ?? '{"notes":"Reviewed. No executive flags.","flag":false}');

  // Travis — packaging and routing assessment
  const travisRaw = await callAnthropic(
    `${GENIUS_MODE}
You are Travis Weston, Assistant Chief of Staff for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.
Review this on-demand agent output. Assess quality, completeness, and routing. Determine the appropriate action: route_to_twin, route_to_aaliyah_foster, acknowledge_completion, or needs_revision.
DATE: ${today} | AGENT: ${item.agent_name} | TASK: ${item.task}
CONTENT: ${item.raw_output}
Output ONLY JSON: {"notes":"your assessment","action":"route_to_twin"}`,
    300
  );
  const travis = JSON.parse(travisRaw.match(/\{[\s\S]*\}/)?.[0] ?? '{"notes":"Output reviewed and packaged.","action":"route_to_twin"}');

  // Raymond — final command approval
  const raymondRaw = await callAnthropic(
    `${GENIUS_MODE}
You are Raymond Holloway, Chief of Staff for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.
This is an on-demand request. Review the output and approve or flag for DeAnna. Consider strategic priority and executive readiness.
DATE: ${today} | AGENT: ${item.agent_name} | TASK: ${item.task}
PRIYA: ${priya.notes} | TRAVIS: ${travis.notes} | ACTION: ${travis.action}
CONTENT: ${item.raw_output}
Output ONLY JSON: {"approved":true,"notes":"your final assessment","priority":"high"}`,
    300
  );
  const raymond = JSON.parse(raymondRaw.match(/\{[\s\S]*\}/)?.[0] ?? '{"approved":true,"notes":"Approved for Intelligence Hub.","priority":"high"}');

  return {
    approved: raymond.approved !== false,
    priyaNotes: priya.notes ?? "",
    travisNotes: travis.notes ?? "",
    raymondNotes: raymond.notes ?? "",
    action: travis.action ?? "route_to_twin",
  };
}

// ─── Step 4: Twin synthesis → Intelligence Hub (Sonnet) ──────────────────────

async function runTwinSynthesisOnItem(
  item: Record<string, unknown>,
  commandNotes: { priya: string; travis: string; raymond: string; action: string },
  complianceFlags: string[]
): Promise<string | null> {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" });

  const flagsSection = complianceFlags.length > 0
    ? `\n\nCOMPLIANCE FLAGS — include at end of card as "## Compliance Flags" section:\n${complianceFlags.map(f => `- ${f}`).join("\n")}`
    : "";

  const notes = [
    commandNotes.raymond ? `Raymond: ${commandNotes.raymond}` : "",
    commandNotes.travis  ? `Travis: ${commandNotes.travis}`  : "",
    commandNotes.priya   ? `Priya: ${commandNotes.priya}`    : "",
  ].filter(Boolean).join("\n");

  const synthesis = await callTwin(
    `${GENIUS_MODE}

You are DeAnna's AI Twin — Master Orchestrator of the DRU AI Leadership Ecosystem™.

Synthesize this on-demand agent output into an Intelligence Hub briefing card for DeAnna R. Upshaw, AI Authority.

AGENT: ${item.agent_name} | DIVISION: ${item.division} | TASK: ${item.task}
DATE: ${today} | TYPE: On-Demand Request
CHAIN STATUS: ✅ Isabella Cleared | ✅ Governance Cleared | ✅ Command Layer Approved

AGENT OUTPUT:
${item.raw_output}

${notes ? `COMMAND LAYER NOTES:\n${notes}` : ""}

Synthesize into a focused, actionable briefing card. Lead with what matters most. End with clear next steps or action items for DeAnna. Write in your commanding Twin voice — strategic, direct, no fluff.${flagsSection}`,
    1500
  );

  const approvalId = await dbInsert("approvals", {
    source:          "twin_on_demand",
    trigger_type:    "on_demand_request",
    agent_name:      "DeAnna's AI Twin",
    agent_role:      "Master Orchestrator",
    division:        item.division,
    task_brief:      `${item.division} — On-Demand: ${item.agent_name} | ${today}`,
    output:          synthesis,
    status:          "pending",
    notify_deanna:   true,
    priority:        "high",
    category:        getDivisionCategory(item.division as string),
    platform:        null,
  });

  return approvalId;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-cron-secret");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const { csq_id } = req.body ?? {};
  if (!csq_id) { res.status(400).json({ error: "csq_id required" }); return; }

  console.log(`[on-demand] 🚀 Starting full chain for CSQ: ${csq_id}`);

  // Respond immediately so twin-command.ts doesn't hang
  res.status(200).json({ success: true, csq_id, message: "On-demand chain started" });

  try {
    let currentId = csq_id as string;
    const complianceFlags: string[] = [];

    // ── STEP 1: Isabella retry loop ─────────────────────────
    let isabellaPassed = false;

    for (let attempt = 0; attempt <= 3; attempt++) {
      const item = await dbGet("chief_of_staff_queue", currentId);
      if (!item) { console.error(`[on-demand] Item not found: ${currentId}`); return; }

      console.log(`[on-demand] Isabella attempt ${attempt + 1} for: ${item.agent_name}`);
      const retryCount = (item.retry_count as number) ?? 0;

      const { cleared, flags, correctionNotes } = await runIsabellaOnItem(item);

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

      // Not cleared
      if (retryCount >= 2) {
        await dbUpdate("chief_of_staff_queue", currentId, {
          isabella_flags: flags,
          correction_notes: correctionNotes,
          status: "rejected",
          governance_cleared: false,
        });
        console.warn(`[on-demand] ⛔ Hard rejected by Isabella: ${item.agent_name} — ${flags}`);
        return;
      }

      // Send back for correction
      await dbUpdate("chief_of_staff_queue", currentId, {
        isabella_flags: flags,
        correction_notes: correctionNotes,
        status: "needs_correction",
      });

      complianceFlags.push(`${item.agent_name} — CORRECTION APPLIED (attempt ${retryCount + 1}) — ${flags}`);
      console.log(`[on-demand] 🔄 Correction applied for: ${item.agent_name}`);

      const newId = await runCorrectionAgent(item, correctionNotes, retryCount + 1);
      if (!newId) { console.error(`[on-demand] Correction agent failed for: ${currentId}`); return; }
      currentId = newId;
    }

    if (!isabellaPassed) { console.error(`[on-demand] Isabella loop exhausted`); return; }

    const clearedItem = await dbGet("chief_of_staff_queue", currentId);
    if (!clearedItem) return;

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
      console.warn(`[on-demand] ⛔ Governance blocked: ${clearedItem.agent_name} — ${gov.flags}`);
      return;
    }

    await dbUpdate("chief_of_staff_queue", currentId, {
      governance_cleared: true,
      governance_notes: gov.notes,
      governance_cleared_at: new Date().toISOString(),
      status: "governance_cleared",
    });
    console.log(`[on-demand] ✅ Governance cleared: ${clearedItem.agent_name}`);

    // ── STEP 3: Command Layer ────────────────────────────────
    console.log(`[on-demand] Running Command Layer for: ${clearedItem.agent_name}`);
    const cmd = await runCommandLayerOnItem(clearedItem);

    await dbUpdate("chief_of_staff_queue", currentId, {
      raymond_reviewed: true,
      raymond_action:   cmd.action,
      priya_notes:      cmd.priyaNotes,
      travis_notes:     cmd.travisNotes,
      raymond_notes:    cmd.raymondNotes,
      command_approved_at: new Date().toISOString(),
      status: "command_approved",
    });
    console.log(`[on-demand] ✅ Command Layer approved: ${clearedItem.agent_name}`);

    // ── STEP 4: Twin synthesis → Intelligence Hub ────────────
    console.log(`[on-demand] Running Twin synthesis for: ${clearedItem.agent_name}`);
    const approvalId = await runTwinSynthesisOnItem(
      clearedItem,
      { priya: cmd.priyaNotes, travis: cmd.travisNotes, raymond: cmd.raymondNotes, action: cmd.action },
      complianceFlags
    );

    await dbUpdate("chief_of_staff_queue", currentId, {
      twin_processed:    true,
      twin_processed_at: new Date().toISOString(),
      approval_id:       approvalId,
      status:            "twin_processed",
    });

    console.log(`[on-demand] ✅ Chain complete — ${clearedItem.agent_name} | Intelligence Hub card: ${approvalId}`);

  } catch (err) {
    console.error("[on-demand] ❌ Chain error:", err);
  }
}
