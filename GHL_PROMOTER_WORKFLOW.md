# GHL Promoter Workflow — Complete Build Specification

**Purpose:** Automatically tag contacts as Promoters when they share their DRU CLEAR™ assessment results, and enroll them in a high-value follow-up sequence that rewards their advocacy.

---

## Webhook Events Reference

The DRU CLEAR™ app fires three distinct webhook events to GHL. This workflow uses `share_click`.

| Event | When it fires | Key params |
|---|---|---|
| `lead_capture` | User submits contact form | `first_name`, `last_name`, `email`, `phone`, `company`, `role` |
| `scorecard_complete` | Results screen loads | All of the above + `score`, `result`, `pillar_*`, `top_gap_1/2`, `result_message`, `top_gap_1_message`, `top_gap_2_message`, UTMs, `referral_code` |
| `share_click` | User clicks LinkedIn, Email, or Copy button on Thank You screen | `event`, `channel`, `first_name`, `last_name`, `email`, `score`, `result`, UTMs, `timestamp` |

---

## Workflow 1: Promoter Tagging + Reward Sequence

### Trigger

**Type:** Inbound Webhook  
**Filter condition:** `event` = `share_click`

> In GHL: Automations → Create Workflow → Trigger: "Inbound Webhook" → Add Filter: Field `event` | Operator `equals` | Value `share_click`

---

### Step 1 — Add Tag: Promoter

**Action:** Add Tag  
**Tag name:** `Promoter`

> This tag allows you to build Smart Lists, filter contacts, and trigger additional workflows for promoters.

---

### Step 2 — Add Tag: Channel-Specific (Optional but recommended)

**Action:** Add Tag (use a conditional branch)

| If `channel` = | Add tag |
|---|---|
| `linkedin` | `Promoter - LinkedIn` |
| `email` | `Promoter - Email` |
| `clipboard` | `Promoter - Clipboard` |

> In GHL: Add a "If/Else" branch after Step 1. Condition: Custom Field `channel`. Three branches, each adds the corresponding tag.

---

### Step 3 — Wait 10 Minutes

**Action:** Wait  
**Duration:** 10 minutes  
**Reason:** Gives the contact time to land back in their inbox before the reward email arrives.

---

### Step 4 — Send Reward Email

**Action:** Send Email  
**From:** DeAnna Upshaw — DRU AI Consulting  
**Subject:** `You just did something most leaders won't, {{contact.first_name}}.`

**Email body (copy-paste into GHL email editor):**

---

> Hi {{contact.first_name}},
>
> You just shared your DRU CLEAR™ AI Readiness results — and that tells me something important about you.
>
> Most leaders keep their gaps private. You chose to be transparent. That's the mindset that separates organizations that talk about AI from those that actually lead with it.
>
> **As a thank-you, here's something reserved for our most engaged leaders:**
>
> 🎯 **Priority Access: Book a 30-Minute AI Clarity Call**
> Skip the waitlist. Use this private link to book directly on my calendar:
>
> [Book Your Priority Clarity Call →](https://api.aiforbusiness.com/widget/bookings/dru-clear-ai-readiness-consultation)
>
> On this call, we'll:
> - Review your **{{contact.result}}** tier score in detail
> - Identify the single highest-leverage AI action for your organization right now
> - Map a 90-day path from where you are to where you want to be
>
> This offer is for you because you chose to share — and that kind of leadership deserves to be rewarded.
>
> See you on the call,
>
> **DeAnna R. Upshaw**  
> AI Authority | DRU AI Consulting  
> [druaiconsulting.com](https://druaiconsulting.com)

---

> **Note:** Replace `{{contact.result}}` with the GHL custom field you mapped to the `result` webhook param (e.g., `{{contact.ai_readiness_tier}}`).

---

### Step 5 — Wait 3 Days

**Action:** Wait  
**Duration:** 3 days

---

### Step 6 — Send Bonus Resource Email

**Action:** Send Email  
**Subject:** `Your bonus resource is inside, {{contact.first_name}}`

**Email body:**

---

> Hi {{contact.first_name}},
>
> A few days ago you shared your DRU CLEAR™ AI Readiness score — and I promised to reward that.
>
> Here's your bonus resource: **The DRU CLEAR™ AI Implementation Starter Kit**
>
> Inside you'll find:
> - The 5-pillar AI readiness framework explained in plain language
> - A 30-day quick-start checklist tailored to your **{{contact.result}}** tier
> - The top 3 AI tools organizations at your tier should implement first
>
> [Download the Starter Kit →](https://druaiconsulting.com/resources)
>
> *(Replace this link with your actual resource URL when ready.)*
>
> If you haven't booked your Priority Clarity Call yet, there are still a few slots open this week:
>
> [Book Now →](https://api.aiforbusiness.com/widget/bookings/dru-clear-ai-readiness-consultation)
>
> Leading with intelligence,
>
> **DeAnna R. Upshaw**  
> DRU AI Consulting

---

### Step 7 — End Workflow

---

## Workflow 2: Referred Lead Attribution

When a visitor arrives via a promoter's shared link (`?ref=promoter@email.com`), the `referral_code` field is included in their `scorecard_complete` webhook payload.

### Setup in GHL

1. Create a custom contact field: **AI Referral Source** (field key: `ai_referral_source`, type: Text)
2. In your `scorecard_complete` inbound webhook workflow, add an action after contact creation:
   - **Action:** Update Contact Field
   - **Field:** AI Referral Source
   - **Value:** `{{trigger.referral_code}}`
3. This links every referred lead back to the promoter's email address in GHL.

---

## Custom Fields to Create in GHL

Before activating these workflows, create the following custom contact fields in GHL (Settings → Custom Fields → Contacts):

| Field Label | Field Key | Type | Maps to webhook param |
|---|---|---|---|
| AI Readiness Score | `ai_readiness_score` | Number | `score` |
| AI Readiness Tier | `ai_readiness_tier` | Text | `result` |
| AI Top Gap 1 | `ai_top_gap_1` | Text | `top_gap_1` |
| AI Top Gap 2 | `ai_top_gap_2` | Text | `top_gap_2` |
| AI Result Message | `ai_result_message` | Text Area | `result_message` |
| AI Top Gap 1 Message | `ai_top_gap_1_message` | Text Area | `top_gap_1_message` |
| AI Top Gap 2 Message | `ai_top_gap_2_message` | Text Area | `top_gap_2_message` |
| AI Referral Source | `ai_referral_source` | Text | `referral_code` |
| AI Share Channel | `ai_share_channel` | Text | `channel` (from share_click) |
| UTM Source | `utm_source` | Text | `utm_source` |
| UTM Campaign | `utm_campaign` | Text | `utm_campaign` |

---

## Four Tier Email Templates

Use these as the basis for your automated email receipts. Trigger on `event = scorecard_complete`, branch on `result` field value.

### EMERGING Tier Receipt

**Subject:** `{{contact.first_name}}, your AI readiness results are inside`

> Your score: **{{contact.ai_readiness_score}}/100 — EMERGING**
>
> {{contact.ai_result_message}}
>
> **Your top gaps to address:**
> 1. **{{contact.ai_top_gap_1}}** — {{contact.ai_top_gap_1_message}}
> 2. **{{contact.ai_top_gap_2}}** — {{contact.ai_top_gap_2_message}}
>
> The fastest path forward is a focused conversation. [Book your free AI Clarity Call →](https://api.aiforbusiness.com/widget/bookings/dru-clear-ai-readiness-consultation)

---

### DEVELOPING Tier Receipt

**Subject:** `You're building momentum, {{contact.first_name}} — here's what's next`

> Your score: **{{contact.ai_readiness_score}}/100 — DEVELOPING**
>
> {{contact.ai_result_message}}
>
> **The gaps slowing your momentum:**
> 1. **{{contact.ai_top_gap_1}}** — {{contact.ai_top_gap_1_message}}
> 2. **{{contact.ai_top_gap_2}}** — {{contact.ai_top_gap_2_message}}
>
> [Book your free AI Clarity Call →](https://api.aiforbusiness.com/widget/bookings/dru-clear-ai-readiness-consultation)

---

### ADVANCING Tier Receipt

**Subject:** `Strong results, {{contact.first_name}} — here's what's holding you back`

> Your score: **{{contact.ai_readiness_score}}/100 — ADVANCING**
>
> {{contact.ai_result_message}}
>
> **The pillars limiting your full potential:**
> 1. **{{contact.ai_top_gap_1}}** — {{contact.ai_top_gap_1_message}}
> 2. **{{contact.ai_top_gap_2}}** — {{contact.ai_top_gap_2_message}}
>
> [Book your free AI Clarity Call →](https://api.aiforbusiness.com/widget/bookings/dru-clear-ai-readiness-consultation)

---

### LEADING Tier Receipt

**Subject:** `You're ahead of the curve, {{contact.first_name}} — let's keep it that way`

> Your score: **{{contact.ai_readiness_score}}/100 — LEADING**
>
> {{contact.ai_result_message}}
>
> **Areas to protect and scale:**
> 1. **{{contact.ai_top_gap_1}}** — {{contact.ai_top_gap_1_message}}
> 2. **{{contact.ai_top_gap_2}}** — {{contact.ai_top_gap_2_message}}
>
> [Book your AI Leadership Advisory call →](https://api.aiforbusiness.com/widget/bookings/dru-clear-ai-readiness-consultation)

---

## OG Badge Image URLs (for GHL email or social use)

| Tier | CDN URL |
|---|---|
| EMERGING | `https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/og-badge-emerging_6233aed6.png` |
| DEVELOPING | `https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/og-badge-developing_226a8643.png` |
| ADVANCING | `https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/og-badge-advancing_d5ded127.png` |
| LEADING | `https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/og-badge-leading_3fa87f71.png` |

These URLs can be embedded directly in GHL emails as `<img>` tags or used as social preview images.
