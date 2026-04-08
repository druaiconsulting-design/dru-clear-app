# GHL Abandoned Assessment Re-Engagement Workflow

**Document:** DRU CLEAR™ GHL Workflow Series — Abandoned Assessment  
**Version:** 1.0  
**Last Updated:** April 2026

---

## Overview

This workflow identifies contacts who submitted the "Before You Begin" lead capture form (triggering a `lead_capture` webhook) but never completed the scorecard (i.e., no `scorecard_complete` webhook was ever received). It fires a re-engagement email 24 hours after the lead is captured, but only if the contact has not yet earned the `scorecard-completed` tag.

This is one of the highest-value automation sequences in the DRU CLEAR™ funnel because it recovers warm leads who showed enough intent to fill in their details but dropped off before seeing their results.

---

## Webhook Events Used

| Event | Field | Value | When It Fires |
|---|---|---|---|
| Lead captured | `event_type` | `lead_capture` | Immediately on "Before You Begin" form submit |
| Scorecard completed | `event_type` | `scorecard_complete` | When user reaches the Results screen (Page 7) |

---

## Tags Used

| Tag | Applied By | Meaning |
|---|---|---|
| `scorecard-started` | This workflow (Step 1) | Contact submitted lead form but may not have finished |
| `scorecard-completed` | Scorecard Complete workflow | Contact reached the Results screen |
| `assessment-abandoned` | This workflow (Step 4) | Contact did not complete within 24 hours |
| `re-engagement-sent` | This workflow (Step 5) | Re-engagement email was dispatched |

---

## Workflow Setup

### Trigger

- **Type:** Inbound Webhook  
- **Filter condition:** `event_type` **equals** `lead_capture`

> This fires the moment the user submits their name, email, phone, company, and role — before they answer a single question.

---

### Action Sequence

#### Step 1 — Apply Tag: `scorecard-started`

Immediately tag the contact to mark that they entered the funnel.

- **Action type:** Add Tag  
- **Tag:** `scorecard-started`

---

#### Step 2 — Wait 24 Hours

Give the contact a full day to complete the assessment at their own pace before any follow-up is sent.

- **Action type:** Wait  
- **Duration:** 24 hours

---

#### Step 3 — Check If Assessment Was Completed (If/Else Branch)

After the wait, check whether the contact has already received the `scorecard-completed` tag. If they have, the workflow exits silently — no email is sent.

- **Action type:** If/Else  
- **Condition:** Tag **does not contain** `scorecard-completed`

**Branch A (condition is TRUE — not yet completed):** Continue to Step 4.  
**Branch B (condition is FALSE — already completed):** End workflow. No action needed.

---

#### Step 4 — Apply Tag: `assessment-abandoned`

Mark the contact as having abandoned the assessment so they appear in the Smart List and can be tracked separately.

- **Action type:** Add Tag  
- **Tag:** `assessment-abandoned`

---

#### Step 5 — Send Re-Engagement Email

Send a warm, non-pushy email that reminds the contact their results are waiting and provides a direct link back to the assessment.

- **Action type:** Send Email  
- **From name:** `{{custom_values.sender_name}}` (e.g., *The DRU CLEAR™ Team*)  
- **From email:** Your GHL sending address  
- **Subject line:** `Your AI Readiness Score is waiting, {{contact.first_name}}`

**Email Body Template:**

```
Hi {{contact.first_name}},

You started the DRU CLEAR™ AI Readiness Scorecard — but it looks like life got in the way before you could see your results.

Your score is just a few minutes away.

The assessment covers six pillars of AI readiness and takes about 5–7 minutes to complete. At the end, you'll receive a personalised tier rating and a breakdown of where your organisation stands today.

👉 Complete your assessment here:
https://assessment.druaiconsulting.com

Your answers are not saved between sessions, so you'll start fresh — but the questions are straightforward and the insights are worth it.

If you have any questions before diving in, just reply to this email.

To your clarity,

[Your Name]  
DRU AI Consulting  
assessment.druaiconsulting.com
```

> **Note:** The assessment URL is hardcoded rather than a personalised deep-link because the app does not currently support session resumption. If session persistence is added in a future version, replace this URL with a contact-specific `{{contact.referral_link}}` merge field.

---

#### Step 6 — Apply Tag: `re-engagement-sent`

Record that the email was dispatched so you can track open and reply rates separately.

- **Action type:** Add Tag  
- **Tag:** `re-engagement-sent`

---

#### Step 7 — Update Custom Field: `last_re_engagement_sent_at`

Log the timestamp so you can calculate time-to-re-engagement and avoid sending duplicate emails if the workflow is ever re-triggered.

- **Action type:** Update Contact Field  
- **Field name:** `last_re_engagement_sent_at`  
- **Value:** `{{now}}` (current timestamp)

---

## Custom Fields to Create

Navigate to **Settings → Custom Fields** in GHL and create the following field if it does not already exist:

| Field Label | Field Key | Type | Notes |
|---|---|---|---|
| Last Re-Engagement Sent At | `last_re_engagement_sent_at` | Date/Time | Prevents duplicate sends; useful for reporting |

---

## Smart Lists to Create

Navigate to **Contacts → Smart Lists** and create the following saved filters:

### 1. Abandoned Assessments (Active)

Contacts who abandoned and have not yet been re-engaged.

| Filter | Operator | Value |
|---|---|---|
| Tag | Contains | `scorecard-started` |
| Tag | Does Not Contain | `scorecard-completed` |
| Tag | Does Not Contain | `re-engagement-sent` |

### 2. Re-Engagement Sent — Awaiting Completion

Contacts who received the re-engagement email but still have not completed.

| Filter | Operator | Value |
|---|---|---|
| Tag | Contains | `re-engagement-sent` |
| Tag | Does Not Contain | `scorecard-completed` |

### 3. Re-Engagement Converted

Contacts who received the re-engagement email and subsequently completed the assessment.

| Filter | Operator | Value |
|---|---|---|
| Tag | Contains | `re-engagement-sent` |
| Tag | Contains | `scorecard-completed` |

---

## Optional: Second Re-Engagement (72-Hour Follow-Up)

If you want a second touch for contacts who still have not completed after the first email, duplicate the workflow and adjust the wait to 72 hours. Apply a separate tag `re-engagement-2-sent` and use a slightly different subject line:

```
Subject: Still thinking about your AI readiness, {{contact.first_name}}?
```

Keep the second email shorter — one or two sentences and the link. Avoid a third email; contacts who have not responded to two touches are unlikely to convert from a third and may mark the message as spam.

---

## Abandonment Rate Tracking

To calculate your abandonment rate, use the following formula in a GHL reporting dashboard or export:

```
Abandonment Rate = (contacts tagged assessment-abandoned) ÷ (contacts tagged scorecard-started) × 100
```

A healthy abandonment rate for a 5–7 minute assessment is typically 30–50%. Rates above 60% may indicate friction in the early questions or a mismatch between the lead magnet promise and the assessment content.

---

## Integration with Other DRU CLEAR™ GHL Workflows

| Workflow | Relationship |
|---|---|
| `GHL_REFERRAL_LINK_AND_TEST_CHECKLIST.md` | The referral link used in share emails should also appear in the re-engagement email once session persistence is added |
| `GHL_SHARE_CHANNEL_WORKFLOW.md` | Contacts who complete after re-engagement will still trigger share tracking on Page 8 |
| `GHL_VIP_PROMOTER_WORKFLOW.md` | Re-engaged completions count toward share_count and VIP Promoter thresholds |
| `GHL_PWA_INSTALLED_WORKFLOW.md` | If the contact installs the PWA before completing, the pwa_installed event fires independently and does not affect this workflow |

---

## Checklist Before Going Live

- [ ] Inbound webhook trigger is set to filter on `event_type` equals `lead_capture`
- [ ] Tags `scorecard-started`, `assessment-abandoned`, `re-engagement-sent` created in GHL
- [ ] Custom field `last_re_engagement_sent_at` created as Date/Time type
- [ ] If/Else branch condition correctly checks for absence of `scorecard-completed` tag
- [ ] Email sending address is verified and not flagged as spam
- [ ] Assessment URL in email body points to `https://assessment.druaiconsulting.com`
- [ ] All three Smart Lists created and returning expected results on test contacts
- [ ] Workflow is set to **Active** (not Draft)
