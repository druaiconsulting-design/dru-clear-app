# GHL Workflow: PWA Installed — Welcome to the App

**Purpose:** When a user installs the DRU CLEAR™ PWA to their home screen, fire a personalized "Welcome to the app" email, apply a tracking tag, and record the install date. This turns a silent install event into a measurable milestone in the contact timeline.

**Trigger event:** `event_type = pwa_installed`

---

## Webhook Payload

The app fires this payload automatically when the browser's `appinstalled` event fires (triggered when the user confirms the "Add to Home Screen" prompt):

| Field | Example Value | Notes |
|---|---|---|
| `event_type` | `pwa_installed` | Always this exact value |
| `email` | `jane@acme.com` | Contact identity for GHL lookup |
| `first_name` | `Jane` | For email personalization |
| `last_name` | `Smith` | For email personalization |
| `phone` | `14155551234` | Digits only, no formatting |
| `company` | `Acme Corp` | |
| `browser` | `Chrome` | Detected browser name |
| `platform` | `Android` | `iOS`, `Android`, `Windows`, `macOS`, `Linux` |
| `user_agent` | `Mozilla/5.0 ...` | Full UA string for debugging |
| `installed_at` | `2026-04-08T14:32:00.000Z` | ISO 8601 UTC timestamp |
| `utm_source` | `linkedin` | Preserved from original visit |
| `utm_medium` | `social` | |
| `utm_campaign` | `q2-launch` | |
| `referral_code` | `jane@referrer.com` | Email of the promoter who shared the link |

---

## Part 1: Custom Fields to Create

Navigate to **Settings → Custom Fields** and create the following fields on the **Contact** object:

| Field Label | API Key | Type | Notes |
|---|---|---|---|
| PWA Installed At | `pwa_installed_at` | Date/Time | Records when the install occurred |
| PWA Platform | `pwa_platform` | Dropdown | Options: iOS, Android, Windows, macOS, Linux |
| PWA Browser | `pwa_browser` | Text | Chrome, Safari, Firefox, Samsung Internet, Edge |

---

## Part 2: Workflow Setup

### Trigger Configuration

1. In GHL, go to **Automation → Workflows → + New Workflow**.
2. Name it: `DRU CLEAR™ — PWA Installed`.
3. Set trigger: **Inbound Webhook**.
4. Select the same webhook endpoint used by the scorecard (`VITE_GHL_WEBHOOK_URL`).
5. Add a **Filter**: `event_type` **equals** `pwa_installed`.
6. Click **Save Trigger**.

### Action Sequence

**Action 1 — Apply Tag**

- Action type: **Add Tag**
- Tag: `pwa-installed`
- Purpose: Creates a filterable segment of all installed-app users without needing a Smart List.

**Action 2 — Update Contact: Install Date**

- Action type: **Update Contact Field**
- Field: `pwa_installed_at`
- Value: `{{trigger.installed_at}}`
- This records the exact install timestamp for timeline analysis.

**Action 3 — Update Contact: Platform**

- Action type: **Update Contact Field**
- Field: `pwa_platform`
- Value: `{{trigger.platform}}`

**Action 4 — Update Contact: Browser**

- Action type: **Update Contact Field**
- Field: `pwa_browser`
- Value: `{{trigger.browser}}`

**Action 5 — Wait**

- Duration: **5 minutes**
- Purpose: Gives the contact a moment to explore the app before receiving the welcome email, so it feels timely rather than immediate.

**Action 6 — Send Email: Welcome to the App**

See the email template in Part 3 below.

---

## Part 3: Welcome Email Template

**Subject:** You're in the app, {{contact.first_name}} — DRU CLEAR™ is now on your home screen

**Body:**

> Hi {{contact.first_name}},
>
> Your DRU CLEAR™ AI Readiness Scorecard is now installed on your device — you can open it anytime, even offline.
>
> **What you can do from the app:**
> - Retake the assessment as your AI strategy evolves
> - Share your results with your leadership team
> - Book your AI Strategy Call directly from your results page
>
> Your results are saved and waiting for you. Tap the DRU CLEAR™ icon on your home screen to pick up where you left off.
>
> If you haven't booked your strategy call yet, now is the perfect time:
>
> **[Book My AI Strategy Call →]** *(insert your GHL booking link)*
>
> To your AI leadership,
>
> **The DRU AI Consulting Team**
> *AI Mastery. Leadership Clarity. Measurable Results.*
>
> ---
> © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting

**Personalization merge fields used:**
- `{{contact.first_name}}` — first name from lead capture
- `{{contact.pwa_platform}}` — optionally add "on your {{contact.pwa_platform}} device" to the subject line

---

## Part 4: Smart Lists for Reporting

### Smart List 1 — All PWA Installers

| Filter | Condition |
|---|---|
| Tag | contains `pwa-installed` |

This gives you a real-time count of all users who have installed the app.

### Smart List 2 — High-Value Installers (Installed + Shared)

| Filter | Condition |
|---|---|
| Tag | contains `pwa-installed` |
| `share_count` | greater than or equal to `1` |

Identifies your most engaged cohort: users who both installed the app and shared their results.

### Smart List 3 — Installers Who Haven't Booked

| Filter | Condition |
|---|---|
| Tag | contains `pwa-installed` |
| Tag | does NOT contain `booked-call` |

Use this list for a follow-up sequence nudging installers toward booking a strategy call.

---

## Part 5: How This Connects to Other Workflows

The `pwa_installed` workflow integrates with the broader DRU CLEAR™ automation ecosystem:

| Workflow | Connection |
|---|---|
| `GHL_SHARE_CHANNEL_WORKFLOW.md` | Combine `pwa-installed` + `vip-advocate` tags to identify your most engaged promoters |
| `GHL_VIP_PROMOTER_WORKFLOW.md` | Add `pwa-installed` as an additional filter on the VIP threshold trigger for higher-confidence promoter identification |
| `GHL_CAPTION_COPIED_WORKFLOW.md` | Cross-reference `pwa-installed` with `caption-copied-linkedin` to find users who installed and prepared to share on LinkedIn |
| `GHL_COPY_INTENT_SCORE.md` | Add a `+2` bonus to `copy_intent_score` for contacts with the `pwa-installed` tag, since app installers are significantly more engaged than browser-only users |

---

## Summary

This workflow turns a silent browser event into a five-field contact update, a segmentation tag, and a personalized welcome email — all without any manual action. The `pwa-installed` tag is the foundation for three Smart Lists that let you track, segment, and follow up with your most engaged users independently of any other workflow.
