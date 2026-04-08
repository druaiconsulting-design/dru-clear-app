# GHL: Referral Link Field Setup & End-to-End Webhook Test Checklist

Two operational documents for completing the DRU CLEAR™ promoter tracking system and verifying the new webhook endpoint.

---

## Part 1 — `referral_link` Custom Field Setup

### Purpose

The Champion Nudge email template (in `GHL_NUDGE_AND_CONVERSION_RATE.md`) and any future referral-based email contain `{{contact.referral_link}}` as a merge field. Without this field populated on each contact, the merge tag renders blank in every email. This document explains how to create the field and populate it automatically.

### Custom Field Setup in GHL

Navigate to **Settings → Custom Fields → Contacts** and create a new field:

| Setting | Value |
|---|---|
| Field name | `referral_link` |
| Field type | Text |
| Label | Referral Link |
| Description | Pre-built scorecard URL with the contact's email as the ref parameter |

### Population Workflow

The `referral_link` field should be written once — when the contact first completes the scorecard — and never overwritten. This preserves the original link even if the contact's email changes later.

**Trigger:** Webhook received → `event_type` equals `scorecard_complete`

**Step 1 — If/Else guard (write-once)**

Add an If/Else branch: `referral_link` is empty (field has no value). Only proceed down the "Yes" branch.

**Step 2 — Update Contact: set referral_link**

In the Update Contact action, set `referral_link` using a dynamic value constructed from the contact's email:

```
https://assessment.druaiconsulting.com?ref={{contact.email}}
```

GHL's Update Contact action supports merge fields in the value, so `{{contact.email}}` will resolve to the contact's actual email address at the time the action runs.

**Complete action sequence:**

1. If/Else: `referral_link` is empty → proceed
2. Update Contact: `referral_link` = `https://assessment.druaiconsulting.com?ref={{contact.email}}`

### How the App Uses the Referral Link

When a referred visitor opens `https://assessment.druaiconsulting.com?ref=jane@acmecorp.com`, the app reads the `ref` query parameter and includes it in the `scorecard_complete` webhook payload as `referral_code`. The `GHL_REFERRED_COMPLETIONS_WORKFLOW.md` document explains how to use this field to increment `referred_completions_count` on the promoter contact.

### Email Merge Field Reference

Once the field is populated, use it in any GHL email as:

```
{{contact.referral_link}}
```

This renders as the full URL, e.g.:
```
https://assessment.druaiconsulting.com?ref=jane%40acmecorp.com
```

---

## Part 1b — LinkedIn Caption Template (Page 8)

A **Suggested LinkedIn Caption** block appears on Page 8 (Thank You screen) below the share buttons. It contains a pre-written post with the user's actual score, tier, referral URL, and four hashtags. A **Copy Caption** button copies the full text to the clipboard in one tap.

The caption text is dynamically generated per user:

```
Just completed the DRU CLEAR™ AI Readiness Scorecard by DRU AI Consulting and scored {score}/100 — {TIER} tier. If you're a leader wondering whether your organization is truly AI-ready, this 3-minute assessment is worth your time. Take it here: https://assessment.druaiconsulting.com?ref={email} #AIReadiness #DRUClear #AILeadership #DigitalTransformation
```

This caption is not tracked by GHL separately — if the user copies it and then clicks the LinkedIn share button, the `share_click` webhook fires with `channel=linkedin` as normal. If they only copy the caption without clicking the LinkedIn button, no webhook fires (the copy action is clipboard-only).

---

## Part 2 — End-to-End Webhook Test Checklist

Use this checklist to verify the new webhook endpoint (`5498d39b-2d12-43e6-884a-ddf24f51b0d1`) is receiving all payloads correctly before enabling downstream GHL automations.

### Pre-Test Setup

Before running the test, confirm the following in GHL:

- [ ] The new inbound webhook trigger is set to **Active** in the workflow
- [ ] The workflow has at least one action (e.g., a Tag action) so GHL processes the payload rather than discarding it
- [ ] The workflow is set to **Published** (draft workflows do not receive live data)
- [ ] GHL → Settings → Integrations → Webhooks shows the trigger URL as active

### Test Run Procedure

Complete a full scorecard run on the live site at `https://assessment.druaiconsulting.com`:

**Screen 1–2 (Splash + Welcome):** Proceed through without entering data.

**Screen 3 (Lead Capture):** Enter test data:

| Field | Test value |
|---|---|
| First name | Test |
| Last name | Webhook |
| Email | your-real-email@domain.com (use a real address so you can verify GHL contact creation) |
| Phone | A valid number in the correct format for the selected country |
| Company | DRU AI Consulting |
| Role | Chief AI Officer |

**Screens 4–8 (Pillar Questions):** Answer all 15 questions. Choose a mix of scores to produce a non-trivial total (aim for ADVANCING or LEADING tier for the clearest test).

**Screen 9 (Calculating):** Wait for the animation to complete.

**Screen 10 (Results):** Confirm the Results screen loads with a score, tier badge, and pillar breakdown.

**Screen 11 (Thank You):** Click through to the Thank You screen to confirm the `share_click` webhook fires correctly when you click a share button.

### GHL Verification Checklist

After completing the test run, verify each of the following in GHL:

**Contact creation:**
- [ ] A new contact was created with the test email address
- [ ] `First Name`, `Last Name`, `Email`, `Phone`, `Company`, and `Job Title` are all populated correctly
- [ ] The contact's `Phone` field contains only digits (no spaces, dashes, or country code prefix)

**Scorecard complete payload:**
- [ ] `event_type` = `scorecard_complete` is visible in the webhook history
- [ ] `score` is a number between 15 and 75
- [ ] `tier` is one of: `EMERGING`, `DEVELOPING`, `ADVANCING`, `LEADING`
- [ ] `pillar_clarity`, `pillar_leadership`, `pillar_execution`, `pillar_alignment`, `pillar_results` are all present
- [ ] `top_gaps` contains a comma-separated list of pillar names
- [ ] `timestamp` is a valid ISO 8601 date string

**Share click payload (after clicking a share button on Page 8):**
- [ ] `event_type` = `share_click` is visible in the webhook history
- [ ] `channel` is one of: `linkedin`, `whatsapp`, `telegram`, `email`, `clipboard`
- [ ] `score` and `tier` are present and match the scorecard_complete values

**Workflow actions:**
- [ ] The tier tag (e.g., `dru-clear-advancing`) was applied to the contact
- [ ] `last_share_channel` was written after clicking a share button
- [ ] `share_count` was incremented to 1 after the first share click

### Payload Field Reference

The complete list of fields sent in the `scorecard_complete` event:

| Field | Type | Example |
|---|---|---|
| `event_type` | String | `scorecard_complete` |
| `first_name` | String | `Jane` |
| `last_name` | String | `Smith` |
| `full_name` | String | `Jane Smith` |
| `email` | String | `jane@acmecorp.com` |
| `phone` | String | `14155552671` |
| `company` | String | `Acme Corporation` |
| `role` | String | `Chief Operating Officer` |
| `score` | Number | `52` |
| `tier` | String | `ADVANCING` |
| `pillar_clarity` | Number | `11` |
| `pillar_leadership` | Number | `9` |
| `pillar_execution` | Number | `12` |
| `pillar_alignment` | Number | `10` |
| `pillar_results` | Number | `10` |
| `top_gaps` | String (comma-separated) | `Leadership,Alignment` |
| `referral_code` | String | `jane@acmecorp.com` (empty if no `?ref=` param) |
| `timestamp` | String (ISO 8601) | `2026-04-08T14:38:15.000Z` |

The `share_click` event sends: `event_type`, `email`, `full_name`, `score`, `tier`, `channel`, `timestamp`.

### If Payloads Are Not Arriving

If no data appears in GHL after completing the test run, check the following in order:

1. **Workflow status** — Confirm the workflow is Published, not Draft.
2. **Trigger URL** — Open the workflow trigger and confirm the URL matches exactly: `https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/5498d39b-2d12-43e6-884a-ddf24f51b0d1`
3. **Browser network tab** — Open DevTools → Network, complete the scorecard, and look for a request to `services.leadconnectorhq.com`. Confirm it returns HTTP 200.
4. **Retry queue** — If the request failed due to a network error, the app queues it in `localStorage` under `dru_clear_webhook_queue` and retries on the next page load. Open the browser console and run: `JSON.parse(localStorage.getItem('dru_clear_webhook_queue'))` to check for queued items.
5. **GHL webhook history** — In GHL, navigate to the workflow → Execution History to see raw incoming payloads and any processing errors.
