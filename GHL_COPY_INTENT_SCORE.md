# GHL Copy Intent Score — Composite Engagement Field

**Document version:** 1.0  
**Last updated:** April 2026  
**Related docs:** `GHL_SHARE_CHANNEL_WORKFLOW.md`, `GHL_VIP_PROMOTER_WORKFLOW.md`, `GHL_CAPTION_COPIED_WORKFLOW.md`

---

## Overview

`copy_intent_score` is a composite engagement metric that combines three distinct sharing signals into a single number per contact. It is more predictive of VIP promoter status than `share_count` alone because it captures both **action** (clicking a share button) and **intent** (copying ready-made post copy or sending a colleague referral).

The formula is:

```
copy_intent_score = share_count + colleague_referrals_sent + caption_copies_count
```

Where `caption_copies_count` is a running counter incremented by 1 each time a `caption_copied` webhook fires for that contact (across all channels: linkedin, whatsapp, telegram, email, colleague_email).

---

## Custom Fields Required

Create these fields in GHL under **Settings → Custom Fields → Contacts**:

| Field Label | API Key | Type | Notes |
|---|---|---|---|
| Caption Copies Count | `caption_copies_count` | Number | Incremented by Caption Copied workflow |
| Copy Intent Score | `copy_intent_score` | Number | Calculated — see formula below |

`share_count` and `colleague_referrals_sent` should already exist from previous workflow setups. If not, create them as Number fields.

---

## Step 1 — Increment `caption_copies_count`

In the **Caption Copied Tagging Workflow** (`GHL_CAPTION_COPIED_WORKFLOW.md`), add one additional action at the end of every branch (after the tag and field writes):

**Action: Math Operation**
- Field: `caption_copies_count`
- Operation: Add
- Value: `1`

This runs regardless of which channel was copied, giving you a total copy-intent count across all channels.

---

## Step 2 — Recalculate `copy_intent_score`

GHL does not support live formula fields natively, but you can approximate the composite score using a **Math Operation chain** triggered after any of the three contributing events.

### Option A — Recalculate on Every Contributing Event (Recommended)

Add a **Math Operation** action at the end of each of these workflows:

1. **Share Channel Workflow** (after `share_count` increment)
2. **Caption Copied Workflow** (after `caption_copies_count` increment)
3. **Colleague Referral Workflow** (after `colleague_referrals_sent` increment)

In each case, the action sequence to recalculate `copy_intent_score` is:

```
Step A: Set copy_intent_score = 0          (Math Operation: Set → 0)
Step B: copy_intent_score += share_count   (Math Operation: Add → {{contact.share_count}})
Step C: copy_intent_score += colleague_referrals_sent  (Math Operation: Add → {{contact.colleague_referrals_sent}})
Step D: copy_intent_score += caption_copies_count      (Math Operation: Add → {{contact.caption_copies_count}})
```

> **Note:** GHL Math Operations can reference custom field values using merge tags (`{{contact.field_api_key}}`). Verify this works in your GHL version by testing with a known contact before deploying to all contacts.

### Option B — Nightly Recalculation (Simpler)

Create a scheduled workflow that runs nightly at midnight and loops through all contacts who have completed the scorecard (filter: `scorecard_complete` tag is present). For each contact, run the four-step recalculation above. This is simpler to set up but means `copy_intent_score` is up to 24 hours stale.

---

## Using `copy_intent_score` for Segmentation

### Smart Lists

**"High Intent Promoters"** — `copy_intent_score` is greater than or equal to 5. These contacts are actively engaged with sharing across multiple dimensions. Consider enrolling them in the VIP Promoter workflow if not already enrolled.

**"Intent Without Action"** — `caption_copies_count` is greater than or equal to 2 AND `share_count` equals 0. These contacts have copied captions multiple times but have never clicked a share button. A targeted re-engagement email with a direct share link would convert a portion of this cohort.

**"Multi-Channel Engagers"** — Contacts with all three of: `share_count >= 1`, `caption_copies_count >= 1`, `colleague_referrals_sent >= 1`. These contacts have engaged with every sharing mechanism in the app and represent your most holistic advocates.

### Sorting in GHL Contacts View

Once `copy_intent_score` is populated, you can sort the Contacts view by this field in descending order to see your top promoters ranked by composite engagement — no Smart List required.

---

## Composite Score Interpretation

| Score Range | Interpretation | Suggested Action |
|---|---|---|
| 0 | Completed scorecard, no sharing activity | Standard nurture sequence |
| 1–2 | Early sharing intent | Monitor; include in re-engagement if no share within 7 days |
| 3–5 | Active promoter | Enroll in VIP Promoter workflow if not already enrolled |
| 6–9 | High-intent advocate | Prioritize for personal outreach or co-marketing opportunity |
| 10+ | Champion-tier promoter | Highest priority for referral reward and Champion workflow |

---

## Relationship to Existing Workflows

| Workflow | Contributes To | Field Updated |
|---|---|---|
| Share Channel Workflow | `copy_intent_score` | `share_count` |
| Caption Copied Workflow | `copy_intent_score` | `caption_copies_count` |
| Colleague Referral Workflow | `copy_intent_score` | `colleague_referrals_sent` |
| VIP Promoter Workflow | Triggered by `share_count >= 5` | `vip_promoter_rewarded` |
| Champion Tier Workflow | Triggered by `share_count >= 10` | `vip_promoter_tier` |

The `copy_intent_score` field complements the VIP and Champion thresholds by providing a richer signal. A contact with `share_count = 3` and `copy_intent_score = 8` is arguably a more engaged advocate than a contact with `share_count = 5` and `copy_intent_score = 5`.
