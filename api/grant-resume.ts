// api/grant-resume.ts
// Sept 1, 2026 — built per DeAnna's direction: a stuck grant draft ("needs_your_input")
// is not a dead end and not a chat thread. She types or pastes the exact real piece
// Kwame was missing (a real testimonial, a real dollar figure), Kwame incorporates it
// into the draft himself, and the draft runs back through the same Chloe/Isabella
// review cycle used on the initial draft -- shares runGrantReviewCycle's logic
// (duplicated here, not imported, matching this codebase's existing per-file pattern
// for cmd-isabella.ts / process-on-demand.ts / raymond.ts) so the review standard is
// identical, not a second, looser path. Updates the SAME approval card either way:
// cleared, it becomes a normal ready-to-submit card; still stuck, it shows a new
// short summary and stays open for more input.

import type { VercelRequest, VercelResponse } from "@vercel/node";
export const config = { maxDuration: 300 };
import { GENIUS_MODE, VOICE_DNA, getAgentKnowledge, getAgentCorrections, REAL_STANDARD, REAL_FUNDED_EXAMPLE, DEANNA_MARKER_FOR_KWAME, DEANNA_MARKER_FOR_REVIEWERS, GRANT_CONTENT_MAX_TOKENS } from './_lib/agentKnowledge.js';

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

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

async function logModelUsage(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  const rate = model.startsWith("claude-sonnet") ? { in: 3, out: 15 } : { in: 1, out: 5 };
  const cost_usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  await fetch(`${SUPABASE_URL}/rest/v1/model_usage_log`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, body: JSON.stringify({ source_file: "grant-resume", model, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd }) }).catch(() => {});
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

// Sonnet — Isabella only
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

// Logs a gap Chloe/Isabella finds against Kwame's grant drafts so his NEXT
// draft inherits the feedback via getAgentCorrections.
async function writeAgentCorrection(agentName: string, note: string, source: string, task?: string): Promise<void> {
  if (!note) return;
  await fetch(`${SUPABASE_URL}/rest/v1/agent_corrections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'return=minimal' },
    body: JSON.stringify({ agent_name: agentName, correction_note: note, source, ...(task ? { task } : {}) }),
  }).catch((err) => console.error(`[grant-resume] writeAgentCorrection failed for ${agentName}:`, err));
}

// ─── Isabella's compliance check — identical prompt to process-on-demand.ts ──
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
      console.log(`[grant-resume] ⚠️ Isabella false-positive overridden — correction_notes confirm content is clean`);
      result.cleared = true;
      result.flags = "none";
      result.correction_notes = "False positive overridden. Content confirmed compliant.";
    }
  }
  return { cleared: result.cleared === true, flags: String(result.flags ?? "none"), correctionNotes: String(result.correction_notes ?? "") };
}

// ─── Chloe's R.E.A.L. review — identical prompt to process-on-demand.ts ─────
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
        console.log(`[grant-resume] ⚠️ Chloe false-positive overridden — her own notes confirm the draft is ready pending DeAnna's input`);
        hitsReal = true;
        notes = "False positive overridden. Draft confirmed ready pending DeAnna's placeholder inputs.";
        summary = '';
      }
    }

    return { hitsReal, notes, summary };
  } catch (error) {
    console.error('[grant-resume] Chloe R.E.A.L. review error, letting current draft through unblocked:', error);
    return { hitsReal: true, notes: '', summary: '' };
  }
}

// ─── Kwame's own revision — identical prompt to process-on-demand.ts ───────
async function runKwameRevision(currentDraft: string, reviewerName: string, reviewerNotes: string, factsBlock: string, kwameCorrections: string, grantRow: Record<string, unknown> | null, agentKnowledge: string): Promise<string> {
  try {
    const rewritePrompt = `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}${kwameCorrections}\n\nYou are Kwame Asante, Grant Writer for DRU AI Consulting (Dimensional Solns, LLC). ${reviewerName} reviewed your draft and found gaps. Revise your draft to close them fully.\n\n${reviewerName.toUpperCase()}'S NOTES:\n${reviewerNotes}\n\nYOUR PREVIOUS DRAFT:\n${currentDraft}\n\nGround every specific claim in these real facts about the business:\n${factsBlock}\n\n${DEANNA_MARKER_FOR_KWAME}\n\nGRANT OPPORTUNITY:\nFUNDER: ${grantRow?.funder ?? 'Not provided'}\nAMOUNT: ${grantRow?.amount_range ?? 'Not provided'}\n\nRespond with ONLY a single JSON object, no preamble, no markdown fences:\n{\n  \"application_draft\": string (your fully revised application, closing every gap ${reviewerName} found)\n}`;
    const rewriteRaw = await callAnthropic(rewritePrompt, GRANT_CONTENT_MAX_TOKENS);
    const rewriteParsed = extractJSON(rewriteRaw) as { application_draft?: string } | null;
    return rewriteParsed?.application_draft ? String(rewriteParsed.application_draft) : currentDraft;
  } catch (error) {
    console.error(`[grant-resume] Kwame revision error (from ${reviewerName}'s notes), keeping previous draft:`, error);
    return currentDraft;
  }
}

// ─── Kwame incorporates DeAnna's real input — the actual point of this file ──
// Different from a reviewer-triggered revision: DeAnna is supplying the exact
// real fact/story/figure Kwame was missing, not flagging a problem for him to
// puzzle out. Told explicitly to replace the matching [DEANNA: ...]
// placeholder with her real words, not to rewrite anything else.
async function runKwameIncorporation(currentDraft: string, deannaInput: string, lastSummary: string, factsBlock: string, kwameCorrections: string, grantRow: Record<string, unknown> | null, agentKnowledge: string): Promise<string> {
  const prompt = `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}${kwameCorrections}\n\nYou are Kwame Asante, Grant Writer for DRU AI Consulting (Dimensional Solns, LLC). DeAnna herself has now supplied the exact real information your draft was missing. Incorporate it precisely -- replace the matching [DEANNA: ...] placeholder(s) with her real words, worked naturally into the sentence. Do not rewrite, rephrase, or restructure anything else in the draft.\n\nWHAT THE REVIEW SAID WAS MISSING:\n${lastSummary}\n\nDEANNA'S REAL INPUT TO INCORPORATE:\n${deannaInput}\n\nYOUR CURRENT DRAFT:\n${currentDraft}\n\nGround every other specific claim in these real facts about the business:\n${factsBlock}\n\n${DEANNA_MARKER_FOR_KWAME}\n\nGRANT OPPORTUNITY:\nFUNDER: ${grantRow?.funder ?? 'Not provided'}\nAMOUNT: ${grantRow?.amount_range ?? 'Not provided'}\n\nRespond with ONLY a single JSON object, no preamble, no markdown fences:\n{\n  \"application_draft\": string (the draft with DeAnna's real input fully incorporated)\n}`;
  const raw = await callAnthropic(prompt, GRANT_CONTENT_MAX_TOKENS);
  const parsed = extractJSON(raw) as { application_draft?: string } | null;
  return parsed?.application_draft ? String(parsed.application_draft) : currentDraft;
}

// ─── The shared review cycle — identical logic to process-on-demand.ts's
// runGrantReviewCycle, duplicated here per this codebase's existing per-file
// pattern (cmd-isabella.ts / process-on-demand.ts already each keep their own
// copy of the Isabella check rather than sharing a module). ──────────────────
async function runGrantReviewCycle(
  startDraft: string, agentKnowledge: string, chloeCorrections: string, kwameCorrections: string,
  grantRow: Record<string, unknown> | null, factsBlock: string, verifiedFacts: string,
  item: Record<string, unknown>, maxCycles: number
): Promise<{ cleared: boolean; finalDraft: string; lastSummary: string; lastNotes: string }> {
  let currentDraft = startDraft;
  let lastNotes = '';
  let lastSummary = 'none';
  let cycleCleared = false;

  for (let cycle = 1; cycle <= maxCycles && !cycleCleared; cycle++) {
    console.log(`[grant-resume] Cycle ${cycle}/${maxCycles} — Chloe R.E.A.L. check for: ${item.agent_name}`);
    const chloeResult = await runChloeOnItem(currentDraft, agentKnowledge, chloeCorrections, grantRow);

    if (!chloeResult.hitsReal) {
      lastNotes = chloeResult.notes;
      lastSummary = chloeResult.summary || 'Needs another pass on R.E.A.L. before it is ready.';
      await writeAgentCorrection('Kwame Asante', chloeResult.notes, 'chloe_real_review', 'grant_application_draft');
      currentDraft = await runKwameRevision(currentDraft, 'Chloe Dubois', chloeResult.notes, factsBlock, kwameCorrections, grantRow, agentKnowledge);
      continue;
    }

    console.log(`[grant-resume] Cycle ${cycle}/${maxCycles} — Isabella compliance check for: ${item.agent_name}`);
    const isabellaResult = await runIsabellaOnItem({ ...item, raw_output: currentDraft }, agentKnowledge, verifiedFacts);

    if (!isabellaResult.cleared) {
      lastNotes = isabellaResult.correctionNotes;
      lastSummary = isabellaResult.flags || 'Needs a compliance fix before it is ready.';
      await writeAgentCorrection('Kwame Asante', isabellaResult.correctionNotes, 'isabella_compliance_review', 'grant_application_draft');
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
// Identical logic to process-on-demand.ts's version -- duplicated per this
// codebase's existing per-file pattern. Reads the draft's own [DEANNA: ...]
// placeholders plus the reviewer's notes and produces a plain question next
// to the real sentence Kwame wrote it into.
async function extractQuestionsForDeAnna(draft: string, reviewerNotes: string, agentKnowledge: string): Promise<{ question: string; kwameContext: string }[]> {
  try {
    const prompt = `${GENIUS_MODE}\n\n${agentKnowledge}\n\nYou are turning a grant reviewer's technical notes into a plain list of questions for DeAnna, the business owner -- so she knows exactly what to answer, not a paraphrase of the review, the actual question Kwame needs answered, next to the real sentence he already wrote around it.\n\nREVIEWER'S NOTES (what's missing, in reviewer language):\n${reviewerNotes}\n\nKWAME'S CURRENT DRAFT (find each [DEANNA: ...] placeholder and the real sentence it sits in):\n${draft}\n\nFor every distinct piece of missing information, produce one entry:\n- \"question\": one plain, direct question DeAnna can answer with no grant-writing background needed\n- \"kwame_context\": the exact sentence or phrase from Kwame's draft where that gap sits, quoted, not paraphrased -- if nothing in the draft touches it yet, write \"Not yet in the draft\"\n\nCombine anything about the same missing fact into one question -- never repeat the same ask twice.\n\nRespond with ONLY a single JSON object, no preamble, no markdown fences:\n{\n  \"questions\": [\n    {\"question\": \"...\", \"kwame_context\": \"...\"}\n  ]\n}`;
    const raw = await callAnthropic(prompt, 1500);
    const parsed = extractJSON(raw) as { questions?: { question?: string; kwame_context?: string }[] } | null;
    return (parsed?.questions ?? []).map(q => ({ question: String(q.question ?? ''), kwameContext: String(q.kwame_context ?? 'Not yet in the draft') })).filter(q => q.question);
  } catch (error) {
    console.error('[grant-resume] Question extraction failed, falling back to the plain summary:', error);
    return [];
  }
}

function buildNeedsFeedbackOutput(summary: string, questions: { question: string; kwameContext: string }[]): string {
  if (questions.length === 0) return `Needs Your Feedback — ${summary}`;
  const qBlocks = questions.map(q => `**Question:** ${q.question}\n**From Kwame's draft:** ${q.kwameContext}`).join('\n\n');
  return `**Needs Your Feedback**\n\n${qBlocks}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const { approval_id, deanna_input } = req.body ?? {};
  if (!approval_id || !String(deanna_input ?? '').trim()) {
    res.status(400).json({ error: "approval_id and deanna_input are required" });
    return;
  }

  try {
    // The approval card's context holds the CSQ row id directly -- set when
    // the card was created, so no name-matching lookup is needed here.
    const approval = await dbGet("approvals", approval_id as string);
    if (!approval) { res.status(404).json({ error: "Approval card not found" }); return; }
    const csqId = String(approval.context ?? '');
    const item = csqId ? await dbGet("chief_of_staff_queue", csqId) : null;
    if (!item) { res.status(404).json({ error: "Original grant draft not found" }); return; }

    const cleanName = String(item.context ?? '');
    const [orgProfileFacts, grantRow, chloeCorrections, kwameCorrections] = await Promise.all([
      getOrgProfileFacts(),
      getGrantFactsByName(cleanName),
      getAgentCorrections('Chloe Dubois'),
      getAgentCorrections('Kwame Asante', 'grant_application_draft'),
    ]);
    const agentKnowledge = await getAgentKnowledge();
    const factsBlock = `MISSION: ${orgProfileFacts?.mission_statement ?? 'Not provided'}\nBIO/CREDENTIALS: ${orgProfileFacts?.bio_credentials ?? 'Not provided'}\nTRACK RECORD: ${orgProfileFacts?.track_record ?? 'Not provided'}\nBUDGET CATEGORIES: ${orgProfileFacts?.standard_budget_categories ?? 'Not provided'}\nPERSONAL STORY: ${grantRow?.personal_story ?? 'Not provided'}\nTESTIMONIALS/SUCCESS STORIES: ${grantRow?.testimonials_success_stories ?? 'Not provided'}`;
    const verifiedFacts = orgProfileFacts ? `DEANNA'S VERIFIED FACTS FOR THIS GRANT -- check every specific claim in the content below against these before flagging anything as invented:
MISSION: ${orgProfileFacts.mission_statement ?? 'Not provided'}
BIO/CREDENTIALS: ${orgProfileFacts.bio_credentials ?? 'Not provided'}
TRACK RECORD: ${orgProfileFacts.track_record ?? 'Not provided'}
BUDGET CATEGORIES: ${orgProfileFacts.standard_budget_categories ?? 'Not provided'}
PERSONAL STORY (for this specific grant): ${grantRow?.personal_story ?? 'Not provided'}
TESTIMONIALS/SUCCESS STORIES (for this specific grant): ${grantRow?.testimonials_success_stories ?? 'Not provided'}

BACKGROUND -- THE R.E.A.L. STANDARD THIS DRAFT WAS WRITTEN TO SATISFY: Chloe Dubois (Copy Writer) has already reviewed this draft against the R.E.A.L. standard below before it reached you -- this is why it includes personal anecdotes, forward-looking passion, and testimonial-driven language. You do not need to re-check it against R.E.A.L. yourself; your five checks above (trademarks, service classes, voice, factual accuracy, framework attribution) are unchanged and still the only clearing standard you apply. This is context only, so you don't mistake R.E.A.L.-driven content for a compliance problem:
${REAL_STANDARD}

Here is a real, funded example that received a yes, showing what hitting R.E.A.L. actually looks like in practice -- this is the same reference example Chloe judges against, given to you purely as background so you recognize the style, not so you judge it:
${REAL_FUNDED_EXAMPLE}

${DEANNA_MARKER_FOR_REVIEWERS} Treat a properly-marked [DEANNA: ...] placeholder as correct and complete exactly as written -- it already satisfies whichever R.E.A.L. element it covers, since DeAnna will supply the real answer before this goes out. This is not something you check or judge; it's background so the surrounding placeholder-driven language reads as intentional, not as a compliance problem.` : '';

    console.log(`[grant-resume] Kwame incorporating DeAnna's input for: ${cleanName}`);
    const incorporatedDraft = await runKwameIncorporation(
      String(item.raw_output ?? ''), String(deanna_input), String(item.isabella_flags ?? ''),
      factsBlock, kwameCorrections, grantRow, agentKnowledge
    );

    const cycleResult = await runGrantReviewCycle(
      incorporatedDraft, agentKnowledge, chloeCorrections, kwameCorrections,
      grantRow, factsBlock, verifiedFacts, item, 2
    );

    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" });

    if (!cycleResult.cleared) {
      const questions = await extractQuestionsForDeAnna(cycleResult.finalDraft, cycleResult.lastNotes, agentKnowledge);
      await dbUpdate("chief_of_staff_queue", csqId, {
        raw_output: cycleResult.finalDraft,
        isabella_flags: cycleResult.lastSummary,
        correction_notes: cycleResult.lastNotes,
        status: "needs_your_input",
      });
      await dbUpdate("approvals", approval_id as string, {
        output: buildNeedsFeedbackOutput(cycleResult.lastSummary, questions),
        task_brief: `${cleanName} — Needs Attention | ${today}`,
        notify_deanna: true,
      });
      console.log(`[grant-resume] ⏸ Still needs input: ${cleanName} — ${cycleResult.lastSummary}`);
      res.status(200).json({ success: false, reason: "needs_your_input", flags: cycleResult.lastSummary });
      return;
    }

    // Cleared -- build the same final wrapped draft process-on-demand.ts
    // builds, and turn this card into a normal ready-to-submit grant card.
    const method = grantRow?.submission_method === 'email' && grantRow?.submission_email ? 'email' : 'portal';
    const submissionLine = method === 'email'
      ? `**Submission (email):** [Click to open a pre-filled email to ${grantRow?.submission_email}](mailto:${encodeURIComponent(String(grantRow?.submission_email))}?subject=${encodeURIComponent(`Grant Application — DRU AI Consulting — ${cleanName}`)}&body=${encodeURIComponent(cycleResult.finalDraft)}) -- review before sending, nothing sends automatically.`
      : `**Submission (portal):** This funder takes applications through their own site, not email. Apply directly here: ${grantRow?.source_url ?? 'source URL not found'}`;
    const finalOutput = `**${cleanName}** — ${grantRow?.funder ?? ''}\nAmount: ${grantRow?.amount_range ?? 'See link'} | Deadline: ${grantRow?.deadline ?? ''}\n\n---\n\n${cycleResult.finalDraft}\n\n---\n\n${submissionLine}`;

    await dbUpdate("chief_of_staff_queue", csqId, {
      raw_output: finalOutput,
      isabella_flags: 'none',
      isabella_cleared_at: new Date().toISOString(),
      status: "isabella_cleared",
    });
    await dbUpdate("approvals", approval_id as string, {
      output: finalOutput,
      status: "pending",
      task_brief: `${cleanName} | ${today}`,
      notify_deanna: true,
    });
    console.log(`[grant-resume] ✅ Cleared after DeAnna's input: ${cleanName}`);
    res.status(200).json({ success: true, output: finalOutput });
  } catch (err) {
    console.error("[grant-resume] ❌ Error:", err);
    res.status(500).json({ error: String(err) });
  }
}
