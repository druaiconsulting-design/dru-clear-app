// api/lib/agentKnowledge.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared utility — fetches brand_marks from Supabase and returns a formatted
// knowledge block that gets prepended to EVERY agent system prompt.
//
// Usage (one call per agent run — both trigger files):
//   const agentKnowledge = await getAgentKnowledge();
//   // Prepend to any agent prompt:
//   `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${agentSpecificPrompt}`
// ─────────────────────────────────────────────────────────────────────────────

// ─── Static framework knowledge ──────────────────────────────────────────────
// Framework meanings are stable IP — defined here so agents always have full
// context even if Supabase is temporarily unavailable.
const FRAMEWORK_KNOWLEDGE = `
## THE DRU AI TRANSFORMATION PATHWAY™
The sequential journey every client walks — no shortcuts, no skipped steps:
Discover → Diagnose → Design → Deploy → Dominate

- DISCOVER: Uncover where the organization is today and where AI can take them
- DIAGNOSE: Deep analysis across all frameworks — identify gaps and highest-impact opportunities
- DESIGN: Build the strategy, execution plan, and alignment system
- DEPLOY: Activate transformation — implement frameworks with live facilitation
- DOMINATE: Sustain, measure, and scale AI leadership results

---

## THE 4 FRAMEWORKS — TRUE MEANINGS

### DRU CLEAR™ — The Connector (Flagship)
Tagline: Align for AI Execution | $7,500 | 3 sessions × 90 min

DRU CLEAR™ is NOT just an assessment. It is the complete AI readiness diagnosis,
strategy design, and execution alignment system — and the framework that CONNECTS
all four frameworks into a unified, executable strategy. Every transformation starts here.

The 5 dimensions:
- C — CLARITY: Define the AI vision with precision. Where are you going, why does it
  matter, what does success look like across the entire organization?
- L — LEADERSHIP: Ensure leaders have the AI fluency, executive sponsorship, and
  strategic conviction to drive transformation top-down and inside-out.
- E — EXECUTION: Close the gap between strategy and action. Identify processes,
  capabilities, and resources needed to implement AI where it delivers the greatest impact.
- A — ALIGNMENT: Unify the organization around a single AI strategy. Break down silos,
  synchronize departments, ensure every team moves in the same direction.
- R — RESULTS: Define, measure, and demonstrate ROI. What gets measured gets managed —
  and what gets managed gets transformed.

DRU CLEAR™ is where AI transformation begins and where all four frameworks come together.
Ideal for: Organizations ready for complete AI leadership transformation — executives,
leadership teams, and organizations that refuse to leave their AI future to chance.

---

### 5C Cultural DNA™ — Culture
Tagline: Communication · Connection · Collaboration · Coaching · Culture Transformation
Theme: Learn IT. Live IT. Lead IT. Leadership Thinking with AI. | $6,000 | 3 sessions × 90 min

Most organizations don't have an AI problem — they have a CULTURE problem. Before
any technology can transform a business, the people, communication patterns, and
leadership behaviors have to be ready to receive it.

5C Cultural DNA™ helps organizations discover and address cultural dysfunction, silos,
and communication breakdowns that silently block progress. It gives leaders a structured
path to use AI as a strategic THINKING PARTNER — not a decision-maker.

The 5 dimensions:
- COMMUNICATION: The foundation. How leaders and teams exchange information, share
  vision, and create clarity around AI strategy across every level.
- CONNECTION: The relational layer. Building trust and meaningful relationships between
  people, departments, and leadership — the human bonds that make collaboration possible.
- COLLABORATION: The action layer. Breaking down silos and creating cross-functional
  alignment so AI initiatives flow through the whole organization, not just one department.
- COACHING: The development layer. Leaders coaching teams through uncertainty, change,
  and new AI capabilities — building confidence and competency from the inside out.
- CULTURE TRANSFORMATION: The outcome. When the first four C's are working, culture
  shifts naturally — from resistance and fear around AI to ownership, confidence, and
  strategic adoption.

Ideal for: Organizations navigating culture shifts, leadership teams experiencing silos
or communication breakdowns, executives ready to build a culture where AI and human
intelligence work together.

---

### 5D Leadership™ — Leadership
Tagline: Transformational Leadership Across Five Critical Dimensions | $6,500 | 3 sessions × 90 min

5D Leadership™ focuses on the WHOLE leader — building from the inside out across five
critical dimensions that determine whether leadership actually TRANSFORMS an organization
or just manages it. This is NOT a skills program. It is an AI-infused leadership
methodology where personal mastery, team effectiveness, organizational strength, and
strategic impact all develop together.

The 5 dimensions:
- I. SELF: Personal mastery. How a leader thinks, decides, and shows up — the
  foundation everything else is built on.
- II. PEOPLE: Relational intelligence. How a leader connects with, develops, and
  brings out the best in the individuals around them.
- III. TEAM: Collective effectiveness. How a leader builds cohesion, trust, and high
  performance across a team that moves as one.
- IV. ORGANIZATION: Systemic strength. How a leader aligns culture, strategy, and
  operations to create an organization built for sustainable growth.
- V. VISIONARY: Strategic impact. How a leader sees beyond today, anticipates what AI
  makes possible, and positions their organization to lead — not follow.

Ideal for: Companies that need leadership at every level — not just the top.
Organizations ready to develop leaders from the inside out across every tier.

---

### AI Sales Mastery™ — Sales
Tagline: DISC Behavioral Insights + AI for Revenue Acceleration | $6,000 | 3 sessions × 90 min
Theme: Personality Mastery + AI = Sales That Feel Natural, Trusted, and Effective.

The future of sales is not louder — it's SMARTER. AI Sales Mastery™ combines the
proven power of DISC behavioral insights with AI to create a sales approach that feels
natural, builds trust, and accelerates revenue WITHOUT pressure tactics or guesswork.
When you understand how your client thinks, decides, and communicates — and you use AI
to personalize that understanding at scale — selling stops feeling like selling.

The 5 dimensions:
- HYPER-PERSONALIZED OUTREACH AT SCALE: Reach the right person with the right message
  at the right time — every time — without losing the human touch.
- SPEAK YOUR CLIENT'S DECISION LANGUAGE: Every buyer has a behavioral style that drives
  how they evaluate, decide, and commit. DISC gives you the map. AI gives you the speed.
- PREDICT OBJECTIONS BEFORE THEY HAPPEN: Stop reacting and start anticipating. Know
  what concerns are coming and address them before they become barriers.
- CLOSE WITH CONFIDENCE, NOT PRESSURE: Confidence comes from clarity. When you know
  your client's behavioral style and AI is working alongside you, closing is a natural step.
- BUILD LONG-TERM CLIENT RELATIONSHIPS: Not one-time wins. The goal is a transformation
  of how your client sees you as a trusted partner.

Ideal for: Sales teams ready to integrate AI into their sales strategy and leaders who
want to accelerate revenue without sacrificing relationship.

---

## HOW THE FRAMEWORKS RELATE
DRU CLEAR™ is the CONNECTOR — it anchors every engagement and connects all four
frameworks into one unified strategy. The other three frameworks (5C Cultural DNA™,
5D Leadership™, AI Sales Mastery™) can be engaged individually or together, but
DRU CLEAR™ is always the anchor in any bundle.

Bundle options (post-diagnostic):
- Full Ecosystem — All 4 frameworks: $26,000
- DRU CLEAR™ + 2 Frameworks: $19,500
- DRU CLEAR™ + 1 Framework: $13,500

Entry point diagnostics:
- Executive Diagnostic: $4,997 — 120 min, all 4 frameworks
- Strategic Diagnostic: $3,497 — 90 min, 5D Leadership™ + DRU CLEAR™

---

## COURSE OFFERING
From Confusion to Confident with AI™
- Self-Paced: $1,497 | Live Cohort: $7,997 | Cohort Mastermind: $12,997
Delivered by AI Twin and agents. Entry via assessment only.
`;

// ─── Fallback ™ list ──────────────────────────────────────────────────────────
// Safety net if Supabase fetch fails. Keep in sync with brand_marks table.
const FALLBACK_TM_MARKS = [
  'DRU CLEAR™',
  'DRU AI Leadership Ecosystem™',
  'DRU AI Transformation Pathway™',
  '5C Cultural DNA™',
  '5D Leadership™',
  'AI Sales Mastery™',
  'From Confusion to Confident with AI™',
];

/**
 * Fetches current protected IP marks from Supabase brand_marks table
 * and returns a complete formatted knowledge block for agent prompt injection.
 * Uses raw fetch to match existing pattern in both trigger files.
 */
export async function getAgentKnowledge(): Promise<string> {
  let tmMarks: string[] = [];

  try {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (url && key) {
      const res = await fetch(
        `${url}/rest/v1/brand_marks?active=eq.true&order=created_at.asc`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      );
      if (res.ok) {
        const data = await res.json();
        tmMarks = (data as { mark: string }[]).map(m => m.mark).filter(Boolean);
      } else {
        console.warn('[agentKnowledge] brand_marks fetch failed — using fallback');
      }
    }
  } catch (err) {
    console.error('[agentKnowledge] Unexpected error fetching brand_marks:', err);
  }

  if (tmMarks.length === 0) {
    tmMarks = FALLBACK_TM_MARKS;
  }

  const tmList = tmMarks.map(m => `  - ${m}`).join('\n');

  return `
╔══════════════════════════════════════════════════════════════════════════════╗
║           DRU AI CONSULTING — AGENT KNOWLEDGE BASE                          ║
║           Required context for ALL agent operations                          ║
╚══════════════════════════════════════════════════════════════════════════════╝

## PROTECTED INTELLECTUAL PROPERTY — ™ RULES (NON-NEGOTIABLE)

The following marks ALWAYS carry ™ — every single use, no exceptions:
${tmList}

STRICT RULES:
1. Every mark above MUST include ™ every time it appears in your output
2. NO other terms, phrases, or frameworks carry ™ under any circumstances
3. Do NOT add ™ to words or phrases not on this list
4. Do NOT omit ™ from any mark on this list
5. Applies to all output: body copy, headings, CTAs, social posts, emails — everything
6. 'DRU AI Consulting' is the registered business name — it does NOT carry ™

---

## REQUIRED CTA
Every piece of content MUST include this link as the primary call to action:
assessment.druaiconsulting.com
This is the ONLY entry point into the DRU AI Leadership Ecosystem™.

---
${FRAMEWORK_KNOWLEDGE}
╔══════════════════════════════════════════════════════════════════════════════╗
║  End of Agent Knowledge Base — Proceed with your assigned task below        ║
╚══════════════════════════════════════════════════════════════════════════════╝
`.trim();
}
