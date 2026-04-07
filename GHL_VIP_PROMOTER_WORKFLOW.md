# GHL VIP Promoter Threshold Workflow — DRU CLEAR™ Scorecard

## Overview

This workflow automatically identifies and rewards your most active advocates. When a contact's `share_count` reaches 5 — meaning they have shared the DRU CLEAR™ AI Readiness Scorecard five or more times across any combination of channels — GHL sends them a personalized "Thank you for spreading the word" email with an exclusive offer. The workflow fires exactly once per contact: a guard condition ensures the VIP email is never sent twice to the same person.

This document covers the full GHL setup, the email template with merge fields, the exclusive offer options, and the reporting Smart List to monitor your VIP promoter cohort.

---

## Prerequisites

Before building this workflow, confirm the following are already in place:

- The **DRU CLEAR — Share Channel Tagger** workflow (documented in `GHL_SHARE_CHANNEL_WORKFLOW.md`) is active and incrementing `share_count` on every share event.
- The `share_count` custom field (Number type) exists under **Settings → Custom Fields → Contacts**.
- A `vip_promoter_rewarded` custom field (Checkbox / Boolean type) exists — this is the guard that prevents duplicate sends. Create it now if it does not exist: **Settings → Custom Fields → Contacts → + Add Field → Checkbox**, label `VIP Promoter Rewarded`, field name `vip_promoter_rewarded`.

---

## GHL Workflow Setup

### Step 1 — Create the Workflow

1. In GHL, go to **Automation → Workflows → + New Workflow**.
2. Name it: `DRU CLEAR — VIP Promoter Threshold`.
3. Set the workflow to **Draft** while configuring; activate only after testing.

### Step 2 — Set the Trigger

The trigger fires whenever a contact's `share_count` field is updated. GHL does not natively support a "field reaches value X" trigger, so use the following approach:

**Trigger type:** Field Updated

| Setting | Value |
|---|---|
| Trigger | Field Updated |
| Field | `share_count` |
| Filter | `share_count` **greater than or equal to** `5` |

This means the trigger evaluates every time `share_count` is written by the Math Operation in the Share Channel Tagger workflow. It fires on the 5th share and on every subsequent share — which is why the guard condition in Step 3 is critical.

### Step 3 — Guard Against Duplicate Sends

Immediately after the trigger, add an **If/Else** action:

| Setting | Value |
|---|---|
| Condition | `vip_promoter_rewarded` **is not checked** (i.e. equals false / empty) |
| Yes branch | Continue to Step 4 (send the VIP email) |
| No branch | **Stop workflow** — contact has already been rewarded |

This single condition ensures the VIP email fires exactly once per contact, no matter how many times `share_count` is subsequently incremented beyond 5.

### Step 4 — Send the VIP Email

Inside the **Yes** branch, add a **Send Email** action using the template below.

**Email configuration:**

| Setting | Value |
|---|---|
| From name | DeAnna R. Upshaw — DRU AI Consulting |
| From email | Your verified GHL sending address |
| Subject | You're one of our top advocates, {{contact.first_name}} |
| Reply-to | Your preferred reply address |
| Send delay | Immediately (0 minutes) |

---

## VIP Email Template

Copy the following into the GHL email builder. Replace `[OFFER_DETAILS]` with your chosen exclusive offer (see Offer Options below).

---

**Subject:** You're one of our top advocates, {{contact.first_name}}

---

Hi {{contact.first_name}},

I wanted to reach out personally — because you've shared the DRU CLEAR™ AI Readiness Scorecard five times, and that means the world to me and my team.

You're not just a participant. You're an advocate. And the leaders you've referred are now better equipped to navigate AI transformation because of you.

As a thank-you, I'd like to offer you something exclusive:

**[OFFER_DETAILS]**

This is reserved only for our most active advocates — people like you who believe in the mission of leading with intelligence and impact.

To claim your offer, simply reply to this email or click the link below.

[CTA BUTTON: Claim My Exclusive Offer → link to booking page or landing page]

Thank you for being part of the DRU CLEAR™ community. Your voice is making a difference.

With gratitude,

**DeAnna R. Upshaw**
AI Authority | DRU AI Consulting
*AI Mastery. Leadership Clarity. Measurable Results.*

---

*You're receiving this because you completed the DRU CLEAR™ AI Readiness Scorecard and have been an exceptional advocate for AI-ready leadership. To unsubscribe, click here.*

---

## Offer Options

Choose one of the following exclusive offers to insert into `[OFFER_DETAILS]`. The offer should feel proportionate to the effort of sharing five times — meaningful, but not so high-value that it creates an expectation of ongoing rewards.

| Option | Description | Best For |
|---|---|---|
| **Free 30-minute strategy call** | A complimentary 1:1 session with DeAnna to review the contact's AI readiness results and outline a 90-day action plan | High-intent leads who are close to booking a paid engagement |
| **Exclusive PDF playbook** | A downloadable "AI Readiness Action Plan" PDF tailored to their tier (EMERGING / DEVELOPING / ADVANCING / LEADING) | Contacts who are earlier in the funnel and not yet ready to book |
| **Priority booking access** | Early access to DeAnna's next cohort, workshop, or group program before it opens to the general list | Contacts who have engaged with multiple touchpoints and are warm |
| **Referral reward credit** | A discount or credit applied toward a future DRU AI Consulting service if they refer a paying client | Contacts who are active networkers with large professional audiences |

The **Free 30-minute strategy call** is the recommended default because it creates a direct sales conversation with your highest-engagement contacts at the moment they are most invested in the DRU CLEAR™ brand.

---

### Step 5 — Mark Contact as Rewarded

After the Send Email action, add an **Update Contact** action to set the guard field:

| Setting | Value |
|---|---|
| Field | `vip_promoter_rewarded` |
| Value | Checked (true) |

This prevents the workflow from sending the VIP email again on any future `share_count` increment.

### Step 6 — Apply VIP Tag

After the Update Contact action, add a second **Update Contact** action (or include in the same action) to apply a tag:

| Tag | Purpose |
|---|---|
| `vip-promoter` | Identifies the contact as a confirmed VIP advocate in Smart Lists and reporting |

The `vip-promoter` tag accumulates alongside existing `shared-via-[channel]` tags, so you can cross-filter: contacts who are VIP promoters **and** primarily share via LinkedIn, for example.

---

## Complete Action Sequence

The full workflow inside the **Yes** branch of the guard condition is:

1. Send Email — VIP "Thank you for spreading the word" email with exclusive offer
2. Update Contact — set `vip_promoter_rewarded` = checked
3. Update Contact — apply tag `vip-promoter`

---

## Reporting: Monitor Your VIP Promoter Cohort

In GHL, go to **Contacts → Smart Lists** and create the following saved list:

| Smart List Name | Filter |
|---|---|
| VIP Promoters | Tag contains `vip-promoter` |
| VIP Promoters — LinkedIn First | Tag contains `vip-promoter` AND `first_share_channel` equals `linkedin` |
| VIP Promoters — Drove Completion | Tag contains `vip-promoter` AND Tag contains `drove-referred-completion` |

The third list — VIP Promoters who also drove a referred completion — is your highest-value segment: contacts who both share prolifically and whose shares actually convert. These are the contacts most worth a personal outreach for a deeper referral partnership.

---

## Relationship to the Share Channel Tagger Workflow

This workflow depends entirely on the `share_count` field being incremented by the **DRU CLEAR — Share Channel Tagger** workflow. The two workflows are designed to run in sequence:

1. **Share Channel Tagger** fires on every `share_click` event → tags the contact, writes `last_share_channel`, writes `first_share_channel` (if empty), increments `share_count`.
2. **VIP Promoter Threshold** fires when `share_count` reaches 5 → sends the VIP email once, marks the contact as rewarded, applies the `vip-promoter` tag.

No changes to the app code are required. Both workflows operate entirely within GHL using the webhook data already being sent.

---

## Summary

The VIP Promoter Threshold workflow turns your most active sharers into recognized advocates by automatically sending a personalized reward email the moment `share_count` hits 5. The write-once guard field (`vip_promoter_rewarded`) ensures the email fires exactly once per contact. The `vip-promoter` tag enables ongoing segmentation and reporting. Combined with the `first_share_channel` and `last_share_channel` fields from the Share Channel Tagger workflow, you have a complete picture of each promoter's behavior — from their first share to their most recent, and from passive participant to active VIP advocate.
