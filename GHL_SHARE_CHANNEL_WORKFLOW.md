# GHL Share Channel Workflow — DRU CLEAR™ Scorecard

## Overview

Every time a user clicks a share button on the Thank You page (Page 8) or the "Copy My Results Link" button on the Results page (Page 7), the app fires a `share_click` webhook event to GoHighLevel. The payload includes a `channel` field that identifies exactly which platform the user shared on. This document explains how to set up a conditional GHL workflow that tags contacts differently by channel, writes a filterable `last_share_channel` custom field, increments a `share_count` counter to surface your most active promoters, and tracks which platform drives the most referred completions.

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

### Step 3 — Tag Contacts and Write last_share_channel Per Branch

Inside each branch, add **two** sequential **Update Contact** actions:

**Action 1 — Apply tag:**

| Branch | Tag to Apply |
|---|---|
| LinkedIn | `shared-via-linkedin` |
| WhatsApp | `shared-via-whatsapp` |
| Telegram | `shared-via-telegram` |
| Email | `shared-via-email` |
| Clipboard | `shared-via-clipboard` |

These tags accumulate on the contact record, so a contact who shares on both LinkedIn and WhatsApp will carry both tags.

**Action 2 — Write `last_share_channel` custom field:**

In the same **Update Contact** action (or a second one immediately after), set the custom field `last_share_channel` to the channel name:

| Branch | `last_share_channel` Value |
|---|---|
| LinkedIn | `linkedin` |
| WhatsApp | `whatsapp` |
| Telegram | `telegram` |
| Email | `email` |
| Clipboard | `clipboard` |

This field is overwritten on each share event, always reflecting the most recent channel. Because it is a standard contact field (not a tag), it is directly filterable in **Contacts → Filters** without needing Smart Lists — select "Custom Field" → `last_share_channel` → equals → `linkedin` to instantly see all contacts who last shared via LinkedIn.

Also write the `last_shared_at` field to `{{trigger.timestamp}}` in the same Update Contact action to record the exact time of the most recent share.

**Action 3 — Write `first_share_channel` (write-once):**

After Action 2, add a third **Update Contact** action inside each branch to write `first_share_channel`. To ensure this field is only written on the very first share and never overwritten on subsequent shares, configure it as follows:

1. Add an **If/Else** condition immediately before this Update Contact action.
2. Set the condition to: `first_share_channel` **is empty** (i.e. the field has no value yet).
3. Inside the **Yes** branch of that condition, add the **Update Contact** action that writes the channel name to `first_share_channel`.
4. Leave the **No** branch empty — if the field already has a value, do nothing.

This write-once pattern means `first_share_channel` permanently records the platform a promoter chose on their very first share, regardless of how many times they share afterward. Comparing `first_share_channel` against `last_share_channel` reveals whether a promoter's preferred platform has shifted over time.

**Complete action order inside each branch (after the above additions):**

1. Update Contact — apply tag (e.g. `shared-via-linkedin`)
2. Update Contact — write `last_share_channel` + `last_shared_at`
3. If/Else: `first_share_channel` is empty → Update Contact writes `first_share_channel`
4. Math Operation — increment `share_count` by 1 *(see Step 3a below)*

### Step 3a — Increment share_count After Each Branch

After the Update Contact actions inside **every branch** (LinkedIn, WhatsApp, Telegram, Email, and Clipboard), add a **Math Operation** action to increment the `share_count` field by 1. This step is identical across all five branches — the same configuration applies to each.

**Math Operation configuration:**

| Setting | Value |
|---|---|
| Action type | Math Operation |
| Field | `share_count` (Number custom field) |
| Operation | Add |
| Value | `1` |

GHL's Math Operation action reads the current value of `share_count`, adds 1, and writes the result back to the contact record. If the field is empty (first share), GHL treats it as 0 and writes 1.

**Action order inside each branch (complete sequence):**

1. Update Contact — apply tag (e.g. `shared-via-linkedin`)
2. Update Contact — write `last_share_channel` + `last_shared_at`
3. If/Else: `first_share_channel` is empty → Update Contact writes `first_share_channel`
4. Math Operation — increment `share_count` by 1

Once populated, sort contacts in **Contacts → Sort by → share_count (descending)** to instantly identify your most active promoters. Contacts with a high `share_count` and a `drove-referred-completion` tag are your highest-value advocates and ideal candidates for a VIP referral reward outreach.

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

Before building the workflow, create these custom contact fields in GHL under **Settings → Custom Fields → Contacts → + Add Field**:

| Field Name | Field Label | Type | Purpose |
|---|---|---|---|
| `last_share_channel` | Last Share Channel | Text / Dropdown | Most recent platform used to share; directly filterable in Contacts view |
| `first_share_channel` | First Share Channel | Text / Dropdown | Platform chosen on the very first share; never overwritten after initial write |
| `share_count` | Share Count | Number | Total number of times this contact has shared |
| `referred_completions_count` | Referred Completions | Number | How many people completed the assessment via this contact's share link |
| `last_shared_at` | Last Shared At | Date/Time | Timestamp of most recent share event |

**Creating `last_share_channel` as a Dropdown field** is recommended over plain Text because it enables GHL's built-in filter UI to show a picklist of values (`linkedin`, `whatsapp`, `telegram`, `email`, `clipboard`) rather than requiring free-text entry. To create it as a Dropdown, choose **Dropdown** as the field type and add the five values listed above as options.

Once created, these fields are populated by the **Update Contact** actions inside each workflow branch as described in Step 3. The `last_share_channel` field is then available in **Contacts → Filters → Custom Fields** for instant segmentation without Smart Lists.

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

The `channel` field is already present in every `share_click` webhook payload fired by the DRU CLEAR app — from both the Thank You page (Page 8) share buttons and the "Copy My Results Link" button on the Results page (Page 7). No code changes are needed. The GHL workflow described above is the only configuration required to enable:

- Per-channel contact tagging (`shared-via-linkedin`, `shared-via-whatsapp`, etc.)
- A filterable `last_share_channel` dropdown field for instant Contacts view segmentation
- A `first_share_channel` write-once field recording each promoter's original platform preference
- A `share_count` incrementor that identifies your most active promoters by sort order
- Referral attribution linking shared links back to the original promoter contact
- Conversion tracking to determine which platform drives the most completed assessments
