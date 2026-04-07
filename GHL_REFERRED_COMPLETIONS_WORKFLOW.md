# GHL Referred Completions & Champion Tier Workflows — DRU CLEAR™ Scorecard

This document covers two related GHL automation enhancements that build on the Share Channel Tagger and VIP Promoter Threshold workflows:

1. **Referred Completions Count** — increments `referred_completions_count` on the promoter contact every time someone completes the scorecard via their referral link.
2. **Champion Tier (share_count = 10)** — a second VIP threshold workflow that fires at 10 shares, awards a higher-value offer, and sets `vip_promoter_tier` to `champion`.

Together with the existing `advocate` tier (share_count = 5), these two workflows give you a complete two-tier promoter program with independent segmentation for each cohort.

---

## Part 1 — Referred Completions Count Incrementor

### Overview

Every time a referred visitor completes the DRU CLEAR™ scorecard, the app fires a `scorecard_complete` webhook that includes a `referral_code` field containing the promoter's email address. This workflow looks up the promoter contact by that email and increments their `referred_completions_count` field by 1.

This gives you a second ranking dimension alongside `share_count`: how many times a contact has shared vs. how many of those shares actually converted into completed assessments. A contact with `share_count = 8` and `referred_completions_count = 6` is a far more valuable advocate than one with `share_count = 8` and `referred_completions_count = 0`.

### Prerequisites

- The `referred_completions_count` custom field (Number type) must exist under **Settings → Custom Fields → Contacts**. Create it if it does not: **+ Add Field → Number**, label `Referred Completions`, field name `referred_completions_count`.
- The DRU CLEAR app is already sending `referral_code` in every `scorecard_complete` payload when the visitor arrived via a share link.

### GHL Workflow Setup

**Step 1 — Create the Workflow**

1. Go to **Automation → Workflows → + New Workflow**.
2. Name it: `DRU CLEAR — Referred Completion Counter`.

**Step 2 — Set the Trigger**

| Setting | Value |
|---|---|
| Trigger | Webhook |
| Filter 1 | `event` equals `scorecard_complete` |
| Filter 2 | `referral_code` is not empty |

Both filters must be satisfied. The `referral_code` filter ensures the workflow only fires for referred completions, not for direct traffic.

**Step 3 — Look Up the Promoter Contact**

The webhook contact is the person who just completed the assessment. The promoter is a different contact — the one whose email matches `referral_code`. Use a **Find Contact** action (or **Lookup Contact**) to locate the promoter:

| Setting | Value |
|---|---|
| Action | Find Contact |
| Search by | Email |
| Email value | `{{trigger.referral_code}}` |

If no contact is found (the promoter has not yet completed the assessment themselves), the workflow should be configured to **stop** — there is no contact record to update.

**Step 4 — Increment referred_completions_count**

After the Find Contact action, add a **Math Operation** action targeted at the found contact:

| Setting | Value |
|---|---|
| Contact | Found contact (from Step 3) |
| Field | `referred_completions_count` |
| Operation | Add |
| Value | `1` |

**Step 5 — Apply Tag to Promoter**

After the Math Operation, add an **Update Contact** action on the found contact to apply a tag:

| Tag | Condition |
|---|---|
| `drove-referred-completion` | Always (accumulates; marks the promoter as having converted at least one referral) |

**Complete Action Sequence:**

1. Find Contact by `referral_code` email → stop if not found
2. Math Operation → increment `referred_completions_count` by 1
3. Update Contact → apply tag `drove-referred-completion`

### Reporting

Sort contacts in **Contacts → Sort by → referred_completions_count (descending)** to rank promoters by conversion performance. Cross-filter with `share_count` to identify your highest-efficiency advocates — those who convert a high proportion of their shares.

| Smart List | Filter |
|---|---|
| Drove Referred Completion | Tag contains `drove-referred-completion` |
| High-Conversion Advocates | `referred_completions_count` greater than or equal to `3` |

---

## Part 2 — Champion Tier Workflow (share_count = 10)

### Overview

The Champion Tier workflow fires when a contact's `share_count` reaches 10 — double the Advocate threshold. It sends a higher-value exclusive offer, sets `vip_promoter_tier` to `champion`, and applies a `vip-champion` tag. The `vip_promoter_tier` field allows independent segmentation of Advocates (tier = `advocate`, share_count ≥ 5) and Champions (tier = `champion`, share_count ≥ 10) without needing to cross-filter tags.

### Prerequisites

- The `vip_promoter_rewarded` guard field already exists (from the Advocate workflow).
- Create a new custom field: **Settings → Custom Fields → Contacts → + Add Field → Dropdown**, label `VIP Promoter Tier`, field name `vip_promoter_tier`, options: `advocate`, `champion`.
- The **DRU CLEAR — VIP Promoter Threshold** (Advocate) workflow is already active.

### GHL Workflow Setup

**Step 1 — Create the Workflow**

1. Go to **Automation → Workflows → + New Workflow**.
2. Name it: `DRU CLEAR — Champion Tier Threshold`.

**Step 2 — Set the Trigger**

| Setting | Value |
|---|---|
| Trigger | Field Updated |
| Field | `share_count` |
| Filter | `share_count` greater than or equal to `10` |

**Step 3 — Guard Against Duplicate Sends**

Add an **If/Else** action:

| Setting | Value |
|---|---|
| Condition | `vip_promoter_tier` **does not equal** `champion` |
| Yes branch | Continue to Step 4 |
| No branch | Stop workflow |

This guard uses `vip_promoter_tier` rather than a separate boolean field, since the tier field itself serves as the state indicator.

**Step 4 — Send the Champion Email**

Inside the **Yes** branch, add a **Send Email** action:

| Setting | Value |
|---|---|
| Subject | You've reached Champion status, {{contact.first_name}} |
| From | DeAnna R. Upshaw — DRU AI Consulting |

**Champion Email Template:**

---

Hi {{contact.first_name}},

You've done something remarkable. You've shared the DRU CLEAR™ AI Readiness Scorecard ten times — and that level of commitment to AI-ready leadership doesn't go unnoticed.

You've officially reached **Champion** status in the DRU CLEAR™ community.

As a Champion, I'd like to offer you something that reflects the depth of your advocacy:

**[CHAMPION_OFFER_DETAILS]**

This offer is reserved exclusively for our Champions — the small group of leaders who have made it their mission to help others assess and advance their AI readiness.

To claim your Champion offer, reply to this email or click below.

[CTA BUTTON: Claim My Champion Offer]

Thank you for being a Champion of AI-ready leadership.

With deep appreciation,

**DeAnna R. Upshaw**
AI Authority | DRU AI Consulting
*AI Mastery. Leadership Clarity. Measurable Results.*

---

**Champion Offer Options:**

| Option | Description |
|---|---|
| **Complimentary group workshop seat** | A seat in DeAnna's next live AI Readiness workshop or cohort program (normally paid) |
| **Co-branded LinkedIn feature** | A LinkedIn post from the DRU AI Consulting account featuring the Champion and their AI readiness journey |
| **Extended 60-minute strategy session** | A deeper 1:1 session (vs. the 30-minute Advocate offer) covering a full AI transformation roadmap |
| **Affiliate/referral partner status** | Formal referral partner agreement with a commission or credit structure for future paying client referrals |

The **co-branded LinkedIn feature** is the recommended Champion offer because it provides social proof and visibility to the Champion at no direct cost, while generating organic reach for DRU AI Consulting.

**Step 5 — Update vip_promoter_tier and Apply Tag**

After the Send Email action:

1. **Update Contact** — set `vip_promoter_tier` = `champion`
2. **Update Contact** — apply tag `vip-champion`

**Complete Action Sequence:**

1. If/Else: `vip_promoter_tier` does not equal `champion` → continue; else stop
2. Send Email — Champion "You've reached Champion status" email
3. Update Contact — set `vip_promoter_tier` = `champion`
4. Update Contact — apply tag `vip-champion`

### Reporting

| Smart List | Filter |
|---|---|
| All VIP Advocates | Tag contains `vip-promoter` |
| Champions Only | Tag contains `vip-champion` |
| Champions Who Converted | Tag contains `vip-champion` AND Tag contains `drove-referred-completion` |
| Advocate (not yet Champion) | Tag contains `vip-promoter` AND Tag does not contain `vip-champion` |

The last list — Advocates who have not yet reached Champion status — is your best re-engagement segment. A targeted nudge email ("You're halfway to Champion status — 5 more shares to go") can accelerate their progression.

---

## Two-Tier Promoter Program Summary

| Tier | Trigger | Field Value | Tag | Offer |
|---|---|---|---|---|
| Advocate | `share_count` = 5 | `vip_promoter_tier` = `advocate` | `vip-promoter` | Free 30-min strategy call |
| Champion | `share_count` = 10 | `vip_promoter_tier` = `champion` | `vip-champion` | Co-branded LinkedIn feature (or equivalent) |

Both tiers use guard conditions to prevent duplicate sends. The `vip_promoter_tier` Dropdown field enables direct filtering in Contacts view without Smart Lists. Combined with `share_count`, `referred_completions_count`, `first_share_channel`, and `last_share_channel`, you have a complete behavioral profile for every promoter in your GHL account.
