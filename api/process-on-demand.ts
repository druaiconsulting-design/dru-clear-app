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
import { GENIUS_MODE, VOICE_DNA, getAgentKnowledge, getAgentCorrections, REAL_STANDARD, REAL_FUNDED_EXAMPLE, DEANNA_MARKER_FOR_KWAME, DEANNA_MARKER_FOR_REVIEWERS, GRANT_CONTENT_MAX_TOKENS } from './_lib/agentKnowledge.js';

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

// Logs a gap Chloe finds against Kwame's grant drafts so his NEXT draft --
// this grant on a future click, or any other grant -- inherits the feedback
// via getAgentCorrections, instead of starting cold every time.
async function writeAgentCorrection(agentName: string, note: string, source: string, task?: string): Promise<void> {
  if (!note) return;
  await fetch(`${SUPABASE_URL}/rest/v1/agent_corrections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'return=minimal' },
    body: JSON.stringify({ agent_name: agentName, correction_note: note, source, ...(task ? { task } : {}) }),
  }).catch((err) => console.error(`[on-demand] writeAgentCorrection failed for ${agentName}:`, err));
}

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

// Same real facts Kwame and Chloe already work from (org_profile is a single-row
// table; the grant row is looked up by name, matching getOrgProfile/
// getGrantOpportunityByName in ghl-agent-trigger.ts). Isabella needs these to check
// a claim against DeAnna's actual verified facts instead of guessing whether it
// sounds invented.
async function getOrgProfileFacts(): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/org_profile?limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] ?? null;
}

async function getGrantFactsByName(name: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/grant_opportunities?opportunity_name=ilike.${encodeURIComponent(name)}&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] ?? null;
}

// One "Grant Application Drafts" card per grant, not one per stuck attempt --
// checks for an existing card in this category with a matching title (the
// grant's clean name) so a retry updates that same card instead of piling up
// a new one next to it every time DeAnna clicks the button again. Matches on
// title, NOT context -- context on this card holds the CSQ row id, so
// grant-resume.ts can go straight from the card to the right draft with no
// separate lookup.
async function findApprovalByTitle(category: string, title: string): Promise<string | null> {
  if (!title) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/approvals?category=eq.${encodeURIComponent(category)}&title=eq.${encodeURIComponent(title)}&order=created_at.desc&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.id ?? null;
}

// ─── Anthropic helpers ────────────────────────────────────────────────────────

// Logs every real API call's actual token usage and cost to Supabase so spend
// is visible in the Intelligence Hub instead of estimated by hand.
async function logModelUsage(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const rate = model.startsWith("claude-sonnet") ? { in: 3, out: 15 } : { in: 1, out: 5 };
  const cost_usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  await fetch(`${url}/rest/v1/model_usage_log`, { method: "POST", headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ source_file: "process-on-demand", model, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd }) });
}

async function callAnthropic(prompt: string, maxTokens = 800): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic Haiku error ${res.status}`);
  const data = await res.json();
  console.log(`[haiku] stop_reason: ${data.stop_reason ?? 'unknown'}`);
  await logModelUsage("claude-haiku-4-5-20251001", data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0).catch(() => {});
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
  console.log(`[sonnet] stop_reason: ${data.stop_reason ?? 'unknown'}`);
  await logModelUsage("claude-sonnet-4-6", data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0).catch(() => {});
  return data.content?.[0]?.text ?? "";
}

// Web-search-enabled call, for Kwame's grant research step (moved here from
// api/ghl-agent-trigger.ts, Aug 31, 2026 -- that file's 60s ceiling couldn't
// hold a research call plus a writing call in sequence, no matter how the
// token budget was split between them. This file's 300s budget can.
async function callAnthropicWithWebSearch(prompt: string, maxTokens = 4000, maxSearches = 4, label = 'kwame-research'): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }], tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearches }] }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json();
  console.log(`[${label}] stop_reason: ${data.stop_reason ?? 'unknown'}`);
  await logModelUsage("claude-haiku-4-5-20251001", data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0).catch(() => {});
  const blocks = (data.content ?? []) as Array<{type:string;text?:string;name?:string;input?:{query?:string};content?:Array<{url?:string;title?:string}>}>;
  const queries = blocks.filter(b => b.type === 'server_tool_use' && b.name === 'web_search').map(b => b.input?.query ?? '(no query)');
  const resultBlocks = blocks.filter(b => b.type === 'web_search_tool_result');
  const resultCounts = resultBlocks.map(b => Array.isArray(b.content) ? b.content.length : 0);
  if (queries.length > 0) {
    queries.forEach((q, i) => console.log(`[${label}] Searched: "${q}" — ${resultCounts[i] ?? '?'} result(s)`));
  } else {
    console.log(`[${label}] No web searches were issued for this run.`);
  }
  return blocks.filter(b => b.type === 'text').map(b => b.text ?? '').join('\n').trim();
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

async function runIsabellaOnItem(item: Record<string, unknown>, agentKnowledge: string, verifiedFacts: string = ''): Promise<{ cleared: boolean; flags: string; correctionNotes: string }> {
  const raw = await callTwin(
    `${GENIUS_MODE}

You are Isabella Moreno, Director of Compliance for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.

${agentKnowledge}

${VOICE_DNA}

YOUR RESPONSIBILITIES — check ALL FIVE of these, not trademarks alone:
1. TRADEMARKS: Every DRU proprietary framework name includes ™, in exact casing, and never abbreviated — the approved list and exact rules are in the knowledge base above
2. SERVICE CLASSES: Content stays within Classes 35, 41, 42 (see knowledge base above)
3. VOICE: No banned words, hook-then-unpack structure honored wherever the content includes a hook or headline — see the VOICE rules above
4. FACTUAL ACCURACY: Check every specific client result, dollar figure, percentage, testimonial, or case study against DeAnna's verified facts below (when given) or against the knowledge base above -- a claim that matches a verified fact is accurate even if it looks surprising or specific. A true fact stated in redundant, awkward, or imprecise wording (e.g. "Over 240+ clients" when the verified fact is "240+ clients") is NOT a factual accuracy failure -- only flag this check if a number, name, or claim is actually wrong, invented, or contradicts a verified fact
5. FRAMEWORK ATTRIBUTION: If the content describes a framework's pillars or dimensions, check the names against the true definitions in the knowledge base above. A framework's pillars must be attributed to the correct framework — e.g. Clarity/Leadership/Execution/Alignment/Results belongs to DRU CLEAR™ and must never be labeled 5D Leadership™; Self/People/Team/Organization/Visionary belongs to 5D Leadership™ and must never be labeled DRU CLEAR™

CLEARING STANDARD:
- All five checks pass → cleared:true
- Any one check fails → cleared:false — correction_notes gets the exact, detailed instruction the agent needs to fix it; flags gets ONE short, plain-English sentence for DeAnna describing what's blocking it in her own words -- no check names (never say "factual accuracy" or "trademark"), no jargon, no technical detail
${verifiedFacts ? `\n${verifiedFacts}\n` : ''}
AGENT: ${item.agent_name} | TASK: ${item.task}
CONTENT TO REVIEW:
${item.raw_output}

You MUST respond with ONLY the JSON below. No preamble, no explanation, no markdown. Just the raw JSON object:
{"cleared":true,"flags":"none","correction_notes":"Content reviewed. All five checks passed."}
OR:
{"cleared":false,"flags":"ONE short plain-English sentence for DeAnna, e.g. 'One phrase restates a number in a way that doesn't quite match the verified fact.'","correction_notes":"Exact, detailed instruction for the agent to correct this"}`,
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

// Returns Isabella's corrected text in memory -- no new queue row. The retry
// loop below keeps one draft in memory across every attempt and writes it to
// the same row once, at the end, the same pattern Chloe and Kwame's loop uses.
async function runIsabellaCorrectionText(item: Record<string, unknown>, currentContent: string, correctionNotes: string): Promise<string | null> {
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
${currentContent}`,
    2000
  );
  return correctedOutput || null;
}

// ─── Chloe's R.E.A.L. review (grant drafts) ───────────────────────────────────
// Judges R.E.A.L./Answer That Wins only -- never compliance, that's Isabella's
// job. Includes a false-positive guard mirroring Isabella's above: if her own
// correction_notes admit the draft is ready pending DeAnna's placeholder
// inputs, that contradicts hits_real:false and is overridden.
async function runChloeOnItem(currentDraft: string, agentKnowledge: string, chloeCorrections: string, grantRow: Record<string, unknown> | null): Promise<{ hitsReal: boolean; notes: string; summary: string }> {
  try {
    const chloePrompt = `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}${chloeCorrections}\n\nYou are Chloe Dubois, Copy Writer for DRU AI Consulting (Dimensional Solns, LLC). Kwame Asante, the Grant Writer, just finished the grant application draft below. Judge it specifically against the R.E.A.L. standard:\n\n${REAL_STANDARD}\n\nHere is a real, funded example that received a yes, showing what hitting R.E.A.L. actually looks like in practice -- use it as your reference point for the standard to reach:\n${REAL_FUNDED_EXAMPLE}\n\n${DEANNA_MARKER_FOR_REVIEWERS} Count that spot as satisfying its R.E.A.L. element, since DeAnna will supply the real answer before this goes out. Mark hits_real true when every other element already reads as satisfied and the remaining items are properly marked [DEANNA: ...] placeholders like this one. You may not ask Kwame to invent a specific client name, story, dollar figure, or vendor for anything properly marked as a [DEANNA: ...] placeholder, under any circumstance -- that is DeAnna's information to supply, not his to guess at.\n\nGRANT OPPORTUNITY:\nFUNDER: ${grantRow?.funder ?? 'Not provided'}\nAMOUNT: ${grantRow?.amount_range ?? 'Not provided'}\n\nKWAME'S DRAFT:\n${currentDraft}\n\nRespond with ONLY a single JSON object, no preamble, no markdown fences:\n{\n  \"hits_real\": boolean (true only if the draft fully satisfies all four R.E.A.L. elements),\n  \"correction_notes\": string (specific, detailed, actionable instructions Kwame can act on to close exactly what's missing -- empty string if hits_real is true),\n  \"summary\": string (ONE short, plain-English sentence for DeAnna describing what's missing, in her language, not Kwame's -- no R.E.A.L. element names, no jargon, no technical detail -- empty string if hits_real is true)\n}`;
    const chloeRaw = await callAnthropic(chloePrompt, 1000);
    const chloeParsed = extractJSON(chloeRaw) as { hits_real?: boolean; correction_notes?: string; summary?: string } | null;
    let hitsReal = chloeParsed?.hits_real === true;
    let notes = String(chloeParsed?.correction_notes ?? '');
    let summary = String(chloeParsed?.summary ?? '');

    if (!hitsReal) {
      const noteLower = notes.toLowerCase();
      const isSelfContradicting =
        noteLower.includes('ready for deanna') ||
        noteLower.includes('ready pending') ||
        noteLower.includes('once she provides') ||
        noteLower.includes('once she supplies') ||
        noteLower.includes('pending deanna') ||
        noteLower.includes("pending your input") ||
        noteLower.includes('this is ready');
      if (isSelfContradicting) {
        console.log(`[on-demand] ⚠️ Chloe false-positive overridden — her own notes confirm the draft is ready pending DeAnna's input`);
        hitsReal = true;
        notes = "False positive overridden. Draft confirmed ready pending DeAnna's placeholder inputs.";
        summary = '';
      }
    }

    return { hitsReal, notes, summary };
  } catch (error) {
    // A Chloe failure never blocks Kwame's draft -- same guarantee the
    // original single-pass review had.
    console.error('[on-demand] Chloe R.E.A.L. review error, letting current draft through unblocked:', error);
    return { hitsReal: true, notes: '', summary: '' };
  }
}

// ─── Kwame's own revision (grant drafts) ──────────────────────────────────────
// Replaces the generic "compliance editor" persona for grant drafts -- every
// fix in this loop is written by Kwame himself, in his own voice, whichever
// agent's notes triggered it. Per DeAnna's standing principle: no
// generic/anonymous editor persona anywhere in her business. (The non-grant
// Isabella loop below still uses the old generic editor -- a known, separate
// gap parked until this grant pipeline ships.)
async function runKwameRevision(currentDraft: string, reviewerName: string, reviewerNotes: string, factsBlock: string, kwameCorrections: string, grantRow: Record<string, unknown> | null, agentKnowledge: string): Promise<string> {
  try {
    const rewritePrompt = `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}${kwameCorrections}\n\nYou are Kwame Asante, Grant Writer for DRU AI Consulting (Dimensional Solns, LLC). ${reviewerName} reviewed your draft and found gaps. Revise your draft to close them fully.\n\n${reviewerName.toUpperCase()}'S NOTES:\n${reviewerNotes}\n\nYOUR PREVIOUS DRAFT:\n${currentDraft}\n\nGround every specific claim in these real facts about the business:\n${factsBlock}\n\n${DEANNA_MARKER_FOR_KWAME}\n\nGRANT OPPORTUNITY:\nFUNDER: ${grantRow?.funder ?? 'Not provided'}\nAMOUNT: ${grantRow?.amount_range ?? 'Not provided'}\n\nRespond with ONLY a single JSON object, no preamble, no markdown fences:\n{\n  \"application_draft\": string (your fully revised application, closing every gap ${reviewerName} found)\n}`;
    const rewriteRaw = await callAnthropic(rewritePrompt, GRANT_CONTENT_MAX_TOKENS);
    const rewriteParsed = extractJSON(rewriteRaw) as { application_draft?: string } | null;
    return rewriteParsed?.application_draft ? String(rewriteParsed.application_draft) : currentDraft;
  } catch (error) {
    // Keep the previous draft rather than losing everything to one failed rewrite call.
    console.error(`[on-demand] Kwame revision error (from ${reviewerName}'s notes), keeping previous draft:`, error);
    return currentDraft;
  }
}

// ─── The shared Kwame ⇄ Chloe ⇄ Isabella review cycle (grant drafts) ─────────
// One cycle = Chloe's R.E.A.L. check, then (if she passes) Isabella's
// compliance check. Either one failing sends the draft back to Kwame for a
// real revision in his own voice, then the WHOLE cycle restarts at Chloe.
// Capped at maxCycles. Used both by the initial on-demand draft run below and
// by api/grant-resume.ts, so DeAnna feeding Kwame new information gets
// exactly the same review, not a second, different code path.
async function runGrantReviewCycle(
  startDraft: string,
  agentKnowledge: string,
  chloeCorrections: string,
  kwameCorrections: string,
  grantRow: Record<string, unknown> | null,
  factsBlock: string,
  verifiedFacts: string,
  item: Record<string, unknown>,
  maxCycles: number
): Promise<{ cleared: boolean; finalDraft: string; lastSummary: string; lastNotes: string }> {
  let currentDraft = startDraft;
  let lastNotes = '';
  let lastSummary = 'none';
  let cycleCleared = false;

  for (let cycle = 1; cycle <= maxCycles && !cycleCleared; cycle++) {
    console.log(`[on-demand] Cycle ${cycle}/${maxCycles} — Chloe R.E.A.L. check for: ${item.agent_name}`);
    const chloeResult = await runChloeOnItem(currentDraft, agentKnowledge, chloeCorrections, grantRow);

    if (!chloeResult.hitsReal) {
      lastNotes = chloeResult.notes;
      lastSummary = chloeResult.summary || 'Needs another pass on R.E.A.L. before it is ready.';
      await writeAgentCorrection('Kwame Asante', chloeResult.notes, 'chloe_real_review', 'grant_application_draft');
      console.log(`[on-demand] Cycle ${cycle} — Chloe sent it back to Kwame`);
      currentDraft = await runKwameRevision(currentDraft, 'Chloe Dubois', chloeResult.notes, factsBlock, kwameCorrections, grantRow, agentKnowledge);
      continue;
    }

    console.log(`[on-demand] Cycle ${cycle}/${maxCycles} — Isabella compliance check for: ${item.agent_name}`);
    const isabellaResult = await runIsabellaOnItem({ ...item, raw_output: currentDraft }, agentKnowledge, verifiedFacts);

    if (!isabellaResult.cleared) {
      lastNotes = isabellaResult.correctionNotes;
      lastSummary = isabellaResult.flags || 'Needs a compliance fix before it is ready.';
      await writeAgentCorrection('Kwame Asante', isabellaResult.correctionNotes, 'isabella_compliance_review', 'grant_application_draft');
      console.log(`[on-demand] Cycle ${cycle} — Isabella sent it back to Kwame`);
      currentDraft = await runKwameRevision(currentDraft, 'Isabella Moreno', isabellaResult.correctionNotes, factsBlock, kwameCorrections, grantRow, agentKnowledge);
      continue;
    }

    cycleCleared = true;
    lastSummary = 'none';
    lastNotes = '';
  }

  return { cleared: cycleCleared, finalDraft: currentDraft, lastSummary, lastNotes };
}

// ─── Turning reviewer notes into plain questions DeAnna can actually answer ──
// Sept 1, 2026 -- built per DeAnna's direction: she can't see Kwame's draft
// from the card, so a one-sentence summary alone leaves her guessing what
// exact question he's asking. This reads the draft's own [DEANNA: ...]
// placeholders plus the reviewer's notes and produces a plain question next
// to the real sentence Kwame wrote it into -- not a paraphrase of the
// reviewer's note, the actual gap in his own words.
async function extractQuestionsForDeAnna(draft: string, reviewerNotes: string): Promise<{ question: string; kwameContext: string }[]> {
  try {
    const prompt = `${GENIUS_MODE}\n\nYou are turning a grant reviewer's technical notes into a plain list of questions for DeAnna, the business owner -- so she knows exactly what to answer, not a paraphrase of the review, the actual question Kwame needs answered, next to the real sentence he already wrote around it.\n\nREVIEWER'S NOTES (what's missing, in reviewer language):\n${reviewerNotes}\n\nKWAME'S CURRENT DRAFT (find each [DEANNA: ...] placeholder and the real sentence it sits in):\n${draft}\n\nFor every distinct piece of missing information, produce one entry:\n- \"question\": one plain, direct question DeAnna can answer with no grant-writing background needed\n- \"kwame_context\": the exact sentence or phrase from Kwame's draft where that gap sits, quoted, not paraphrased -- if nothing in the draft touches it yet, write \"Not yet in the draft\"\n\nCombine anything about the same missing fact into one question -- never repeat the same ask twice.\n\nRespond with ONLY a single JSON object, no preamble, no markdown fences:\n{\n  \"questions\": [\n    {\"question\": \"...\", \"kwame_context\": \"...\"}\n  ]\n}`;
    const raw = await callTwin(prompt, 3000);
    const parsed = extractJSON(raw) as { questions?: { question?: string; kwame_context?: string }[] } | null;
    if (!parsed) {
      console.error(`[on-demand] Question extraction returned unparseable JSON, falling back to plain summary. Raw response (first 300 chars): ${raw.slice(0, 300)}`);
      return [];
    }
    return (parsed.questions ?? []).map(q => ({ question: String(q.question ?? ''), kwameContext: String(q.kwame_context ?? 'Not yet in the draft') })).filter(q => q.question);
  } catch (error) {
    console.error('[on-demand] Question extraction call failed, falling back to the plain summary:', error);
    return [];
  }
}

// Builds the actual card text. Falls back to the plain summary only if
// question extraction genuinely produced nothing.
function buildNeedsFeedbackOutput(summary: string, questions: { question: string; kwameContext: string }[]): string {
  if (questions.length === 0) return `Needs Your Feedback — ${summary}`;
  const qBlocks = questions.map(q => `**Question:** ${q.question}\n**From Kwame's draft:** ${q.kwameContext}`).join('\n\n');
  return `**Needs Your Feedback**\n\n${qBlocks}`;
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
      category:      item.category === "grant_applications" ? "grant_applications" : "content_review",
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

  // Grant application drafts: pull the same org_profile and grant-row facts Kwame
  // and Chloe already work from, ONCE, before the retry loop starts, and reuse
  // them across every attempt within this single request.
  let verifiedFacts = '';
  let orgProfileFacts: Record<string, unknown> | null = null;
  let grantRow: Record<string, unknown> | null = null;
  const initialItem = await dbGet("chief_of_staff_queue", csq_id as string);
  const isGrantDraft = initialItem?.task === 'grant_application_draft';
  if (initialItem && isGrantDraft && initialItem.context) {
    const [orgProfile, grantFacts] = await Promise.all([
      getOrgProfileFacts(),
      getGrantFactsByName(String(initialItem.context)),
    ]);
    orgProfileFacts = orgProfile;
    grantRow = grantFacts;
    if (orgProfile) {
      verifiedFacts = `DEANNA'S VERIFIED FACTS FOR THIS GRANT -- check every specific claim in the content below against these before flagging anything as invented:
MISSION: ${orgProfile.mission_statement ?? 'Not provided'}
BIO/CREDENTIALS: ${orgProfile.bio_credentials ?? 'Not provided'}
TRACK RECORD: ${orgProfile.track_record ?? 'Not provided'}
BUDGET CATEGORIES: ${orgProfile.standard_budget_categories ?? 'Not provided'}
PERSONAL STORY (for this specific grant): ${grantRow?.personal_story ?? 'Not provided'}
TESTIMONIALS/SUCCESS STORIES (for this specific grant): ${grantRow?.testimonials_success_stories ?? 'Not provided'}

BACKGROUND -- THE R.E.A.L. STANDARD THIS DRAFT WAS WRITTEN TO SATISFY: Chloe Dubois (Copy Writer) has already reviewed this draft against the R.E.A.L. standard below before it reached you -- this is why it includes personal anecdotes, forward-looking passion, and testimonial-driven language. You do not need to re-check it against R.E.A.L. yourself; your five checks above (trademarks, service classes, voice, factual accuracy, framework attribution) are unchanged and still the only clearing standard you apply. This is context only, so you don't mistake R.E.A.L.-driven content for a compliance problem:
${REAL_STANDARD}

Here is a real, funded example that received a yes, showing what hitting R.E.A.L. actually looks like in practice -- this is the same reference example Chloe judges against, given to you purely as background so you recognize the style, not so you judge it:
${REAL_FUNDED_EXAMPLE}

${DEANNA_MARKER_FOR_REVIEWERS} Treat a properly-marked [DEANNA: ...] placeholder as correct and complete exactly as written -- it already satisfies whichever R.E.A.L. element it covers, since DeAnna will supply the real answer before this goes out. This is not something you check or judge; it's background so the surrounding placeholder-driven language reads as intentional, not as a compliance problem.`;
    }
  }

  // NOTE: lock is acquired by twin-on-demand.ts before this endpoint fires.
  // This handler owns releasing it on every exit path below (finally block).
  try {
    // ── STEP -1: Kwame's research + draft (grant drafts only, when Kwame
    // hasn't written anything yet) ──────────────────────────────────────
    // Moved here from api/ghl-agent-trigger.ts (Aug 31, 2026). Research and
    // writing are two separate calls so they don't compete for the same
    // response budget -- but together they were still too much for that
    // file's 60s ceiling, which is what caused the hard timeout. This file's
    // 300s budget holds both comfortably. ghl-agent-trigger.ts now only
    // queues an empty placeholder and hands off immediately -- an empty
    // raw_output on a grant draft is exactly how this step knows a draft
    // still needs to be written.
    if (isGrantDraft && !String(initialItem?.raw_output ?? '').trim()) {
      if (!grantRow || !orgProfileFacts) {
        await releaseLock();
        res.status(500).json({ error: "Grant opportunity or org profile not found for drafting" });
        return;
      }

      const kwameCorrectionsForDraft = await getAgentCorrections('Kwame Asante', 'grant_application_draft');
      const factsBlockForDraft = `MISSION: ${orgProfileFacts?.mission_statement ?? 'Not provided'}\nBIO/CREDENTIALS: ${orgProfileFacts?.bio_credentials ?? 'Not provided'}\nTRACK RECORD: ${orgProfileFacts?.track_record ?? 'Not provided'}\nBUDGET CATEGORIES: ${orgProfileFacts?.standard_budget_categories ?? 'Not provided'}\nPERSONAL STORY: ${grantRow?.personal_story ?? 'Not provided'}\nTESTIMONIALS/SUCCESS STORIES: ${grantRow?.testimonials_success_stories ?? 'Not provided'}`;

      let research = '';
      try {
        const researchPrompt = `${GENIUS_MODE}\n\nYou are researching a specific grant opportunity for DRU AI Consulting (Dimensional Solns, LLC) before drafting an application.\n\nOPPORTUNITY: ${grantRow?.opportunity_name}\nFUNDER: ${grantRow?.funder}\nAMOUNT: ${grantRow?.amount_range}\nELIGIBILITY: ${grantRow?.eligibility}\nDEADLINE: ${grantRow?.deadline}\nSOURCE: ${grantRow?.source_url}\n\nSearch the web and find:\n1. The funder's official rules or judging criteria page (not just marketing pages) -- what specific criteria do they score submissions against, and how are they weighted?\n2. The funder's own stated mission, goals, and community priorities, in their own specific language, not a generic paraphrase.\n3. The exact application questions, sections, and format this funder asks for -- exact prompts, word or character limits, section titles, whenever the source states them.\n4. How this grant is actually submitted -- a direct application email address if one is stated, or note that it's a web portal, online form, or third-party platform.\n\nWrite your findings as organized plain-text notes under those four headings. Quote or closely paraphrase exact language, section titles, and limits when you find them. This is research only -- do not draft the application itself.`;
        research = await callAnthropicWithWebSearch(researchPrompt, 4000, 4, 'kwame-research');
      } catch (error) {
        console.error('[on-demand] Kwame research call failed, writing from general knowledge instead:', error);
      }

      const draftPrompt = `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}${kwameCorrectionsForDraft}\n\nYou are Kwame Asante, Grant Writer for DRU AI Consulting (Dimensional Solns, LLC) — DeAnna R. Upshaw, Leadership Strategist and AI Authority.\n\nGround every specific claim in these real facts about the business:\n${factsBlockForDraft}\n\nDraft an application for this specific grant opportunity, which DeAnna has personally reviewed and selected:\nOPPORTUNITY: ${grantRow?.opportunity_name}\nFUNDER: ${grantRow?.funder}\nAMOUNT: ${grantRow?.amount_range}\nELIGIBILITY: ${grantRow?.eligibility}\nDEADLINE: ${grantRow?.deadline}\nSOURCE: ${grantRow?.source_url}\n\nHere is what's already been researched about this specific funder -- use it directly, it's already gathered:\n${research || '(research unavailable this run -- write from the facts above and general knowledge of grant applications)'}\n\nWrite this application to satisfy the R.E.A.L. standard:\n${REAL_STANDARD}\n\nHere is a real, funded example that received a yes, showing what hitting R.E.A.L. actually looks like in practice -- use it as your reference point for the standard to reach, and write fully original content in your own words for this specific funder:\n${REAL_FUNDED_EXAMPLE}\n\nUse the mission, track record, budget categories, personal story, and testimonials/success stories given above, plus the funder research above, as the real facts behind each R.E.A.L. element. Track record gives you real aggregate facts only -- how many clients, which categories, aggregate outcomes -- use it only for aggregate claims like these, never to construct an individual client's specific scene, quote, or before-and-after story. Any individual client story, scene, or quote may only come from the personal story and testimonials/success stories given above, used close to verbatim -- never invented, and never built out from a category mentioned in track record. If a section calls for an individual story and none is available above, follow the placeholder rule below instead of inventing one. Describe what the frameworks are designed to deliver in forward-looking language. Build the closing from whichever facts are strongest among personal story, testimonials, mission, track record, and budget categories.\n\n${DEANNA_MARKER_FOR_KWAME}\n\nWrite the application content in plain text, matching exactly what the funder research above says their application asks for -- their specific sections, questions, and word limits.\n\nAlso determine how this grant is actually submitted, using the funder research above: if a direct application email address was found, use it exactly. Otherwise mark it as a portal submission.\n\nRespond with ONLY a single JSON object, no preamble, no markdown fences:\n{\n  \"application_draft\": string (the full application content, plain text, ready for DeAnna to review),\n  \"submission_method\": \"email\" | \"portal\",\n  \"submission_email\": string or null (only if submission_method is \"email\" and a real address was found)\n}`;
      const draftRaw = await callAnthropic(draftPrompt, GRANT_CONTENT_MAX_TOKENS);
      const draftParsed = extractJSON(draftRaw) as { application_draft?: string; submission_method?: string; submission_email?: string } | null;

      if (!draftParsed?.application_draft) {
        console.error(`[on-demand] Kwame draft failed to generate. Raw response (first 500 chars): ${draftRaw.slice(0, 500)}`);
        await dbUpdate("chief_of_staff_queue", currentId, {
          status: "rejected",
          correction_notes: "Kwame's draft failed to generate this run -- try clicking again.",
        });
        await releaseLock();
        res.status(500).json({ error: "Kwame's draft failed to generate" });
        return;
      }

      const submissionMethod = draftParsed.submission_method === 'email' && draftParsed.submission_email ? 'email' : 'portal';
      await dbUpdate("grant_opportunities", String(grantRow?.id ?? ''), {
        submission_method: submissionMethod,
        submission_email: draftParsed.submission_email ?? null,
      });
      // Keep the in-memory copy in sync so Step 0 below (which builds the
      // final wrapped output using grantRow's submission fields) sees this
      // run's result instead of the pre-draft value.
      grantRow = { ...grantRow, submission_method: submissionMethod, submission_email: draftParsed.submission_email ?? null };

      await dbUpdate("chief_of_staff_queue", currentId, { raw_output: String(draftParsed.application_draft) });
      console.log(`[on-demand] ✅ Kwame drafted: ${grantRow?.opportunity_name ?? 'grant application'}`);
    }

    // ── STEP 0/1: Kwame ⇄ Chloe ⇄ Isabella review cycle (grant drafts only) ──
    // Rebuilt Aug 31, 2026 per DeAnna's design. Chloe judges R.E.A.L./Answer
    // That Wins only. Isabella judges compliance only (trademarks, service
    // class, voice, factual accuracy, framework attribution) and never
    // re-judges R.E.A.L. herself -- she's given the R.E.A.L. standard and the
    // funded example purely as background, so placeholder-driven language
    // doesn't read as a compliance problem. Either agent's rejection goes
    // back to Kwame, never to DeAnna -- he wrote the draft, he fixes it, in
    // his own voice (no generic editor persona anywhere in this loop). Any
    // Kwame revision restarts the WHOLE cycle at Chloe, since a compliance
    // fix can shift R.E.A.L. and a R.E.A.L. fix can shift compliance. Capped
    // at 2 full cycles -- timed against this file's 300s budget using real
    // per-step durations observed Aug 31 (2 cycles leaves ~100s of margin;
    // 3 left under 10s and risked the exact silent-timeout failure already
    // fixed once). Every correction, from either agent, writes to Kwame's
    // agent_corrections file so he learns from both.
    if (isGrantDraft) {
      const item = await dbGet("chief_of_staff_queue", currentId);
      if (!item) { await releaseLock(); res.status(404).json({ error: "CSQ item not found" }); return; }

      const [chloeCorrections, kwameCorrections] = await Promise.all([
        getAgentCorrections('Chloe Dubois'),
        getAgentCorrections('Kwame Asante', 'grant_application_draft'),
      ]);
      const factsBlock = `MISSION: ${orgProfileFacts?.mission_statement ?? 'Not provided'}\nBIO/CREDENTIALS: ${orgProfileFacts?.bio_credentials ?? 'Not provided'}\nTRACK RECORD: ${orgProfileFacts?.track_record ?? 'Not provided'}\nBUDGET CATEGORIES: ${orgProfileFacts?.standard_budget_categories ?? 'Not provided'}\nPERSONAL STORY: ${grantRow?.personal_story ?? 'Not provided'}\nTESTIMONIALS/SUCCESS STORIES: ${grantRow?.testimonials_success_stories ?? 'Not provided'}`;
      const cleanName = String(initialItem?.context ?? '') || String(item.context ?? '');

      const cycleResult = await runGrantReviewCycle(
        String(item.raw_output ?? ''), agentKnowledge, chloeCorrections, kwameCorrections,
        grantRow, factsBlock, verifiedFacts, item, 2
      );

      if (!cycleResult.cleared) {
        // Not rejected -- DeAnna made no decision here, the loop just ran out
        // of automatic tries. needs_your_input is the accurate status: Kwame
        // can't close this gap himself (it's real information only DeAnna
        // has), so it's parked for her, not turned down.
        await dbUpdate("chief_of_staff_queue", currentId, {
          raw_output: cycleResult.finalDraft,
          isabella_flags: cycleResult.lastSummary,
          correction_notes: cycleResult.lastNotes,
          status: "needs_your_input",
          governance_cleared: false,
        });

        // One dedicated "Grant Application Drafts" card for this grant, showing
        // only the short summary plus a way for DeAnna to actually supply the
        // missing piece and send it back through the same review loop -- not
        // just a dead end, and not a chat thread that goes nowhere. A retry
        // updates this same card instead of stacking a new one. Matched by
        // title (the grant's clean name) -- context on this card instead holds
        // the CSQ row id, so grant-resume.ts can find the right draft directly
        // from the card, with no separate lookup.
        const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" });
        const questions = await extractQuestionsForDeAnna(cycleResult.finalDraft, cycleResult.lastNotes);
        const stuckOutput = buildNeedsFeedbackOutput(cycleResult.lastSummary, questions);
        const existingCardId = await findApprovalByTitle('grant_applications', cleanName);
        if (existingCardId) {
          await dbUpdate("approvals", existingCardId, {
            output: stuckOutput,
            status: "needs_your_input",
            task_brief: `${cleanName} — Needs Attention | ${today}`,
            context: currentId,
            notify_deanna: true,
          });
        } else {
          await dbInsert("approvals", {
            source: "kwame_grant_stuck",
            trigger_type: item.task,
            agent_name: item.agent_name,
            agent_role: item.division,
            division: item.division,
            task_brief: `${cleanName} — Needs Attention | ${today}`,
            output: stuckOutput,
            status: "needs_your_input",
            notify_deanna: true,
            priority: "high",
            category: "grant_applications",
            platform: null,
            title: cleanName,
            context: currentId,
          });
        }

        console.warn(`[on-demand] ⏸ Needs DeAnna's input after 2 cycles: ${item.agent_name} — ${cycleResult.lastSummary}`);
        await releaseLock();
        res.status(200).json({ success: false, reason: "needs_your_input", agent: item.agent_name, flags: cycleResult.lastSummary });
        return;
      }

      // Build the final wrapped draft (header + submission line) now that
      // both Chloe and Isabella have cleared it -- same shape
      // ghl-agent-trigger.ts used to build before it wrote to the queue.
      const currentDraft = cycleResult.finalDraft;
      const method = grantRow?.submission_method === 'email' && grantRow?.submission_email ? 'email' : 'portal';
      const submissionLine = method === 'email'
        ? `**Submission (email):** [Click to open a pre-filled email to ${grantRow?.submission_email}](mailto:${encodeURIComponent(String(grantRow?.submission_email))}?subject=${encodeURIComponent(`Grant Application — DRU AI Consulting — ${cleanName}`)}&body=${encodeURIComponent(currentDraft)}) -- review before sending, nothing sends automatically.`
        : `**Submission (portal):** This funder takes applications through their own site, not email. Apply directly here: ${grantRow?.source_url ?? 'source URL not found'}`;
      const finalOutput = `**${cleanName}** — ${grantRow?.funder ?? ''}\nAmount: ${grantRow?.amount_range ?? 'See link'} | Deadline: ${grantRow?.deadline ?? ''}\n\n---\n\n${currentDraft}\n\n---\n\n${submissionLine}`;

      await dbUpdate("chief_of_staff_queue", currentId, {
        raw_output: finalOutput,
        isabella_flags: 'none',
        isabella_cleared_at: new Date().toISOString(),
        status: "isabella_cleared",
      });
      console.log(`[on-demand] ✅ Chloe + Isabella both cleared: ${item.agent_name}`);
    } else {
      // ── STEP 1: Isabella retry loop (all non-grant on-demand agents) ──────
      // Unchanged. Still uses the generic correction-editor persona -- a
      // known, separate gap (same pattern as cmd-isabella.ts) DeAnna asked
      // to park until the grant pipeline above is done. In-memory, single
      // row. Up to 3 total review passes (attempt 0, 1, 2) with a real
      // rewrite between each one; only hard-rejects if still not clean on
      // the 3rd pass. The row itself never changes -- currentId stays the
      // same from here through Governance and Raymond below.
      const startItem = await dbGet("chief_of_staff_queue", currentId);
      if (!startItem) { await releaseLock(); res.status(404).json({ error: "CSQ item not found" }); return; }

      let currentContent = String(startItem.raw_output ?? '');
      let isabellaFlags = 'none';
      let isabellaNotes = '';
      let isabellaPassed = false;

      for (let attempt = 0; attempt <= 2; attempt++) {
        console.log(`[on-demand] Isabella attempt ${attempt + 1} for: ${startItem.agent_name}`);
        const checkItem = { ...startItem, raw_output: currentContent };
        const { cleared, flags, correctionNotes } = await runIsabellaOnItem(checkItem, agentKnowledge, verifiedFacts);
        isabellaFlags = flags;
        isabellaNotes = correctionNotes;

        if (cleared) {
          console.log(`[on-demand] ✅ Isabella cleared: ${startItem.agent_name}`);
          isabellaPassed = true;
          break;
        }

        if (attempt === 2) break;

        complianceFlags.push(`${startItem.agent_name} — CORRECTION APPLIED (attempt ${attempt + 1}) — ${flags}`);
        console.log(`[on-demand] 🔄 Correction applied for: ${startItem.agent_name}`);
        const corrected = await runIsabellaCorrectionText(startItem, currentContent, correctionNotes);
        if (corrected) currentContent = corrected;
      }

      if (!isabellaPassed) {
        await dbUpdate("chief_of_staff_queue", currentId, {
          raw_output: currentContent,
          isabella_flags: isabellaFlags,
          correction_notes: isabellaNotes,
          status: "rejected",
          governance_cleared: false,
        });
        console.warn(`[on-demand] ⛔ Hard rejected by Isabella: ${startItem.agent_name} — ${isabellaFlags}`);
        await releaseLock();
        res.status(200).json({ success: false, reason: "hard_rejected_by_isabella", agent: startItem.agent_name, flags: isabellaFlags });
        return;
      }

      await dbUpdate("chief_of_staff_queue", currentId, {
        raw_output: currentContent,
        isabella_flags: isabellaFlags,
        isabella_cleared_at: new Date().toISOString(),
        status: "isabella_cleared",
      });
    }

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
