# DRU CLEAR™ AI Readiness Scorecard — Setup & Configuration Guide

**DRU AI Consulting | DeAnna R. Upshaw — AI Authority**

---

## 1. Connecting Your GoHighLevel Webhook

The app is pre-wired for CRM integration. All you need to do is paste your GoHighLevel webhook URL into one configuration variable.

### Step 1 — Locate the config file

Open the file:

```
client/src/pages/DruClearApp.tsx
```

Near the top of the file, find this block (around line 35):

```typescript
// WEBHOOK CONFIGURATION
// To connect your GoHighLevel CRM, update this URL:
const WEBHOOK_CONFIG = {
  url: "", // ← PASTE YOUR GHL WEBHOOK URL HERE
};
```

### Step 2 — Paste your GHL webhook URL

Replace the empty string with your GoHighLevel webhook URL:

```typescript
const WEBHOOK_CONFIG = {
  url: "https://services.leadconnectorhq.com/hooks/YOUR_WEBHOOK_ID/webhook-trigger/YOUR_TRIGGER_ID",
};
```

Save the file. That's it — no other changes required.

---

## 2. Webhook Payloads (JSON Structure)

The app sends **two separate webhook events** to your configured URL.

### Event 1 — Lead Capture (Screen 3)

Fires immediately when the user submits their contact information, before they begin the scorecard.

```json
{
  "event": "lead_capture",
  "fullName": "Jane Smith",
  "email": "jane@acmecorp.com",
  "company": "Acme Corporation",
  "role": "Chief Operating Officer",
  "timestamp": "2026-04-04T14:32:00.000Z"
}
```

### Event 2 — Scorecard Complete (Screen 10)

Fires when the user reaches the Results screen, after all 15 questions are answered.

```json
{
  "event": "scorecard_complete",
  "fullName": "Jane Smith",
  "email": "jane@acmecorp.com",
  "company": "Acme Corporation",
  "role": "Chief Operating Officer",
  "totalScore": 52,
  "pillarScores": {
    "clarity": 11,
    "leadership": 9,
    "execution": 12,
    "alignment": 10,
    "results": 10
  },
  "tier": "ADVANCING",
  "topGaps": ["Leadership", "Alignment"],
  "timestamp": "2026-04-04T14:38:15.000Z"
}
```

**Tier values** (based on total score out of 75):

| Score Range | Tier Label |
|-------------|------------|
| 15 – 30 | `EMERGING` |
| 31 – 45 | `DEVELOPING` |
| 46 – 60 | `ADVANCING` |
| 61 – 75 | `LEADING` |

---

## 3. Local Storage Backup

Every webhook submission is also saved to the user's browser `localStorage` as a backup, in case the webhook fails (e.g., the user is offline). Data is stored under the key `dru_clear_submissions` as an array of objects.

To retrieve all submissions from the browser console:

```javascript
JSON.parse(localStorage.getItem('dru_clear_submissions'))
```

---

## 4. Testing the Webhook Connection

Before going live, test your webhook using a free service like [Webhook.site](https://webhook.site):

1. Go to [https://webhook.site](https://webhook.site) and copy your unique URL.
2. Paste it into `WEBHOOK_CONFIG.url` in `DruClearApp.tsx`.
3. Run through the app — fill in the lead capture form and complete the scorecard.
4. Return to Webhook.site and verify both payloads (`lead_capture` and `scorecard_complete`) appear with the correct data.
5. Once confirmed, replace the test URL with your real GoHighLevel webhook URL.

---

## 5. GoHighLevel Workflow Setup

In GoHighLevel, create a **Workflow** triggered by an inbound webhook:

1. Navigate to **Automation → Workflows → New Workflow**.
2. Add a **Webhook Trigger** and copy the generated webhook URL.
3. Paste that URL into `WEBHOOK_CONFIG.url`.
4. Map the incoming fields to your GHL contact fields:
   - `fullName` → Contact Name
   - `email` → Email
   - `company` → Company Name
   - `role` → Job Title / Custom Field
5. Add a **Tag** action to tag contacts by their tier (e.g., `DRU-CLEAR-ADVANCING`).
6. Optionally add an **Email** action to send the personalized results report.

---

## 6. Deploying to Your Custom Domain (druaiconsulting.com)

### Option A — Manus Hosting (Recommended)

The app is already hosted on the Manus platform. To publish it:

1. Click the **Publish** button in the Manus Management UI (top-right of the interface).
2. In **Settings → Domains**, you can either:
   - Customize the auto-generated subdomain (e.g., `dru-clear.manus.space`), or
   - Purchase a new domain directly within Manus, or
   - Bind your existing `druaiconsulting.com` domain by adding a CNAME record.

**CNAME record to add at your DNS provider:**

| Type | Name | Value |
|------|------|-------|
| CNAME | `@` or `www` | `[your-manus-app].manus.space` |

### Option B — Self-Hosting (Static Files)

If you prefer to host the files yourself:

1. Download the project source code via **Code → Download All Files** in the Manus Management UI.
2. Install dependencies and build:
   ```bash
   pnpm install
   pnpm build
   ```
3. The compiled output will be in the `dist/` folder.
4. Upload the contents of `dist/` to any static hosting provider (Netlify, Vercel, Cloudflare Pages, AWS S3 + CloudFront, etc.).
5. Point your `druaiconsulting.com` domain to the hosting provider per their DNS instructions.

**Important:** Ensure your hosting provider serves the app with the correct MIME type for `manifest.json` (`application/manifest+json`) and that `sw.js` is served from the root path.

---

## 7. PWA Installation

Once deployed, users can install the app to their home screen:

- **iOS (Safari):** Tap the Share button → "Add to Home Screen"
- **Android (Chrome):** Tap the browser menu → "Add to Home Screen" or "Install App"
- **Desktop (Chrome/Edge):** Click the install icon in the address bar

The app will launch in standalone mode (no browser chrome) and work offline once loaded.

---

## 8. File Structure Reference

```
dru-clear-pwa/
├── client/
│   ├── public/
│   │   ├── manifest.json        ← PWA manifest (icons, name, theme)
│   │   └── sw.js                ← Service worker (offline support)
│   ├── src/
│   │   ├── pages/
│   │   │   └── DruClearApp.tsx  ← ALL 10 screens + webhook config
│   │   ├── App.tsx              ← Root component
│   │   └── index.css            ← Brand design tokens & global styles
│   └── index.html               ← HTML entry point with PWA meta tags
└── DRU_CLEAR_SETUP_GUIDE.md     ← This file
```

---

## 9. Customization Reference

| What to change | Where to change it |
|---|---|
| Webhook URL | `WEBHOOK_CONFIG.url` in `DruClearApp.tsx` |
| Booking link | `BOOKING_URL` constant in `DruClearApp.tsx` |
| Brand colors | CSS variables in `client/src/index.css` |
| Scorecard questions | `questions` arrays in `DruClearApp.tsx` |
| Tier score thresholds | `getTier()` function in `DruClearApp.tsx` |
| Gap messages | `GAP_MESSAGES` object in `DruClearApp.tsx` |
| Tier messages | `TIER_MESSAGES` object in `DruClearApp.tsx` |
| App name / icons | `client/public/manifest.json` |

---

*DRU CLEAR™ is a trademark of DRU AI Consulting. All rights reserved.*
