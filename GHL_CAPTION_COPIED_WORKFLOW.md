# GHL Caption Copied & Colleague Referral Workflow

**Document version:** 1.0  
**Last updated:** April 2026  
**Related docs:** `GHL_SHARE_CHANNEL_WORKFLOW.md`, `GHL_VIP_PROMOTER_WORKFLOW.md`, `GHL_REFERRAL_LINK_AND_TEST_CHECKLIST.md`

---

## Overview

The DRU CLEAR™ app fires a `caption_copied` webhook event whenever a user copies a suggested message from Page 8 (Thank You screen). This is a distinct signal from `share_click` — it tells you the user **prepared to share** by copying ready-made copy, regardless of whether they actually clicked a share button. The `colleague_email` channel variant fires when a user uses the Share with a Colleague form.

This document covers two GHL automations:

1. **Caption Copied Tagging Workflow** — Tags contacts by which channel's caption they copied.
2. **Colleague Referral Sent Workflow** — Tags and tracks contacts who used the peer-to-peer email form.

---

## Webhook Payload: `caption_copied`

The `caption_copied` event is sent as a GET request to the same GHL inbound webhook as all other DRU CLEAR™ events.

| Field | Type | Example Values |
|---|---|---|
| `event` | string | `caption_copied` |
| `channel` | string | `linkedin`, `whatsapp`, `telegram`, `email`, `colleague_email` |
| `first_name` | string | `Jane` |
| `last_name` | string | `Smith` |
| `email` | string | `jane@acmecorp.com` |
| `score` | number | `74` |
| `result` | string | `ADVANCING` |
| `timestamp` | ISO string | `2026-04-08T12:00:00.000Z` |

The `channel` field distinguishes which caption was copied:

| Channel Value | Caption Source |
|---|---|
| `linkedin` | Suggested LinkedIn Caption block |
| `whatsapp` | Suggested WhatsApp Message block |
| `telegram` | Suggested Telegram Message block |
| `email` | Suggested Email Subject + Body block |
| `colleague_email` | Share with a Colleague form (Send Link button) |

---

## Workflow 1: Caption Copied Tagging

### Purpose

Tag contacts by which channel's caption they copied. Contacts who copy a caption but do not subsequently fire a `share_click` event are a re-engagement cohort — they prepared to share but may have been interrupted.

### GHL Setup

**Trigger:** Inbound Webhook → filter `event` equals `caption_copied`

**Action sequence:**

**Step 1 — If/Else Branch on `channel`:**

Create five branches, one per channel value:

| Branch | Condition | Tag to Apply |
|---|---|---|
| LinkedIn | `channel` equals `linkedin` | `caption-copied-linkedin` |
| WhatsApp | `channel` equals `whatsapp` | `caption-copied-whatsapp` |
| Telegram | `channel` equals `telegram` | `caption-copied-telegram` |
| Email | `channel` equals `email` | `caption-copied-email` |
| Colleague | `channel` equals `colleague_email` | `colleague-referral-sent` |

**Step 2 — Update Contact (in each branch):**

Write `last_caption_channel` custom field with the value `{{trigger.channel}}`.

**Step 3 — Update Contact (in each branch):**

Write `last_caption_copied_at` (DateTime field) with `{{trigger.timestamp}}`.

### Custom Fields Required

Create these fields in GHL under **Settings → Custom Fields → Contacts**:

| Field Label | API Key | Type | Notes |
|---|---|---|---|
| Last Caption Channel | `last_caption_channel` | Dropdown | Options: linkedin, whatsapp, telegram, email, colleague_email |
| Last Caption Copied At | `last_caption_copied_at` | Date/Time | ISO format |

### Re-Engagement Smart List

Create a Smart List named **"Copied Caption — No Share"** with these filters:

- `caption-copied-linkedin` OR `caption-copied-whatsapp` OR `caption-copied-telegram` OR `caption-copied-email` tag is present
- AND `share-linkedin` AND `share-whatsapp` AND `share-telegram` AND `share-email` tags are ALL absent
- AND `last_caption_copied_at` is within the last 7 days

This list identifies users who prepared to share but did not follow through — a warm re-engagement audience for a follow-up email.

### Re-Engagement Email (Optional)

Send a follow-up email 24 hours after `caption_copied` if no `share_click` event has fired:

> **Subject:** Still thinking about sharing your DRU CLEAR™ results?
>
> Hi {{contact.first_name}},
>
> You copied your {{trigger.channel}} caption after completing the DRU CLEAR™ AI Readiness Scorecard — but we noticed you haven't shared it yet.
>
> Your score of {{contact.score}}/100 ({{contact.result}} tier) is worth sharing. Leaders in your network may be facing the same AI readiness challenges, and your referral link gives them a direct path to clarity.
>
> Share now: {{contact.referral_link}}
>
> — The DRU AI Consulting Team

---

## Workflow 2: Colleague Referral Sent

### Purpose

The `colleague_email` channel fires when a user enters a colleague's email address and clicks **Send Link** on Page 8. This is the highest-intent sharing action in the app — the user is personally vouching for the scorecard to a named individual. Tag and track these contacts separately.

### GHL Setup

This workflow can be a branch inside Workflow 1 (the `colleague_email` branch) or a standalone workflow triggered by `event` equals `caption_copied` AND `channel` equals `colleague_email`.

**Action sequence:**

**Step 1 — Add Tag:** `colleague-referral-sent`

**Step 2 — Update Contact:** Write `colleague_referral_sent_at` (DateTime) with `{{trigger.timestamp}}`.

**Step 3 — Update Contact:** Increment `colleague_referrals_sent` (Number field) by 1 using Math Operation → Add → 1. This tracks how many colleagues each contact has referred over time.

**Step 4 — If/Else Guard:** Check if `colleague_referrals_sent` equals 1. If true, also add tag `first-colleague-referral` to mark the first-time peer referral event.

### Custom Fields Required

| Field Label | API Key | Type | Notes |
|---|---|---|---|
| Colleague Referral Sent At | `colleague_referral_sent_at` | Date/Time | First or most recent send |
| Colleague Referrals Sent | `colleague_referrals_sent` | Number | Cumulative count |

### Smart Lists

**"Peer Referrers"** — Contacts with tag `colleague-referral-sent`. These are your highest-intent promoters. Consider enrolling them in the VIP Promoter workflow if they are not already in it.

**"Multi-Peer Referrers"** — Filter: `colleague_referrals_sent` is greater than or equal to 2. These contacts have referred multiple colleagues and represent your most engaged advocates.

---

## Action Order Summary

For each `caption_copied` event, the complete action sequence per branch is:

1. Apply channel-specific tag (e.g., `caption-copied-linkedin`)
2. Write `last_caption_channel` custom field
3. Write `last_caption_copied_at` custom field
4. *(colleague_email branch only)* Increment `colleague_referrals_sent`
5. *(colleague_email branch only)* Apply `first-colleague-referral` tag if count = 1

---

## Integration with Other Workflows

The Caption Copied and Colleague Referral workflows complement the existing share tracking system:

| Workflow | Trigger Event | Primary Signal |
|---|---|---|
| Share Channel Workflow | `share_click` | User clicked a share button |
| Caption Copied Workflow | `caption_copied` | User copied ready-made post copy |
| Colleague Referral Workflow | `caption_copied` + `channel=colleague_email` | User sent a personal referral email |
| VIP Promoter Workflow | `share_count >= 5` | High-volume sharer |
| Champion Tier Workflow | `share_count >= 10` | Top-tier promoter |

A contact can appear in multiple workflows simultaneously. The combination of `share_click` + `caption_copied` events gives you the most complete picture of sharing intent and behavior.
