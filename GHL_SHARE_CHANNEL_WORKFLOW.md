# GHL Share Channel Workflow — DRU CLEAR™ Scorecard

## Overview

Every time a user clicks a share button on the Thank You page (Page 8), the app fires a `share_click` webhook event to GoHighLevel. The payload includes a `channel` field that identifies exactly which platform the user shared on. This document explains how to set up a conditional GHL workflow that tags contacts differently by channel and enables tracking of which platform drives the most referred completions.

---

## Webhook Payload — `share_click` Event

The following fields are sent as URL query parameters on every `share_click` event:

| Field | Type | Example Values |
|---|---|---|
| `event` | string | `share_click` |
| `channel` | string | `linkedin`, `whatsapp`, `telegram`, `email`, `clipboard` |
| `first_name` | string | `DeAnna` |
| `last_name` | string | `Upshaw` |
| `email` | string | `deanna@example.com` |
| `score` | number | `74` |
| `result` | string | `ADVANCING` |
| `ai_country_name` | string | `United States` |
| `ai_country_iso` | string | `US` |
| `utm_source` | string | `linkedin` |
| `utm_medium` | string | `social` |
| `utm_campaign` | string | `ai-readiness-q1` |
| `referral_code` | string | `deanna@example.com` (promoter's email) |
| `timestamp` | string | `2026-04-07T14:22:00.000Z` |

---

## GHL Workflow Setup

### Step 1 — Create the Trigger

1. In GHL, go to **Automation → Workflows → + New Workflow**.
2. Name it: `DRU CLEAR — Share Channel Tagger`.
3. Set the trigger to **Webhook** and paste the DRU CLEAR webhook URL.
4. Add a **Filter** on the trigger: `event` **equals** `share_click`.

### Step 2 — Add a Conditional Branch (If/Else)

After the trigger, add an **If/Else** action. Create five branches based on the `channel` field:

| Branch | Condition |
|---|---|
| Branch 1 | `channel` equals `linkedin` |
| Branch 2 | `channel` equals `whatsapp` |
| Branch 3 | `channel` equals `telegram` |
| Branch 4 | `channel` equals `email` |
| Branch 5 | `channel` equals `clipboard` (catch-all / else) |

### Step 3 — Tag Contacts Per Branch

Inside each branch, add an **Update Contact** action to apply a tag:

| Branch | Tag to Apply |
|---|---|
| LinkedIn | `shared-via-linkedin` |
| WhatsApp | `shared-via-whatsapp` |
| Telegram | `shared-via-telegram` |
| Email | `shared-via-email` |
| Clipboard | `shared-via-clipboard` |

These tags accumulate on the contact record, so a contact who shares on both LinkedIn and WhatsApp will carry both tags.

### Step 4 — Track Referred Completions

To identify which platform drives the most referred completions, use the `referral_code` field (the sharer's email) on the `scorecard_complete` event:

1. Create a second workflow triggered by `event` equals `scorecard_complete` **and** `referral_code` is not empty.
2. In that workflow, look up the contact whose email matches `referral_code`.
3. Add a tag to that promoter contact: `drove-referred-completion`.
4. Optionally increment a custom field `referred_completions_count` by 1.

To see which channel drove the most referred completions, run a **Contact Report** in GHL filtered by:
- Tag contains `drove-referred-completion`
- Tag contains `shared-via-[channel]`

Compare counts across channels to identify the highest-performing platform.

### Step 5 — Optional: Channel-Specific Follow-Up

You can add a follow-up email or SMS inside each branch to reinforce the share. For example:

- **LinkedIn branch**: Send an email with LinkedIn-optimized copy and a tracking link.
- **WhatsApp branch**: Send a WhatsApp message thanking them for sharing and offering a referral reward.
- **Email branch**: Send a follow-up with a pre-written referral email template they can forward again.

---

## Custom Fields to Create in GHL

Add these custom contact fields to store share data for reporting and segmentation:

| Field Name | Type | Purpose |
|---|---|---|
| `last_share_channel` | Text | Most recent channel used to share |
| `share_count` | Number | Total number of times this contact has shared |
| `referred_completions_count` | Number | How many people completed the assessment via this contact's share link |
| `last_shared_at` | Date/Time | Timestamp of most recent share event |

To populate these fields, add **Update Contact** actions in each branch of the workflow.

---

## Reporting: Identify the Top Referral Channel

In GHL, go to **Contacts → Smart Lists** and create the following saved lists:

| Smart List Name | Filter |
|---|---|
| Shared via LinkedIn | Tag contains `shared-via-linkedin` |
| Shared via WhatsApp | Tag contains `shared-via-whatsapp` |
| Shared via Telegram | Tag contains `shared-via-telegram` |
| Shared via Email | Tag contains `shared-via-email` |
| Shared via Clipboard | Tag contains `shared-via-clipboard` |
| Drove Referred Completion | Tag contains `drove-referred-completion` |

Compare the counts of each Smart List to determine which channel drives the most shares and, more importantly, which channel's shares convert into completed assessments.

---

## Summary

The `channel` field is already present in every `share_click` webhook payload fired by the DRU CLEAR app. No code changes are needed. The GHL workflow described above is the only configuration required to enable per-channel tagging, referral attribution, and conversion tracking.
