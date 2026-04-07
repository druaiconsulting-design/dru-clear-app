# GHL: Champion Nudge Email & Referred Conversion Rate

Two companion enhancements to the DRU CLEAR™ promoter tracking system.

---

## Part 1 — Champion Nudge Email Workflow (share_count = 7 or 8)

### Purpose

The Champion Tier workflow fires at `share_count = 10`. This nudge workflow fires two shares earlier — at 7 or 8 — to accelerate progression by making the contact aware they are close to Champion status. It converts passive sharers into intentional advocates.

### Trigger Configuration

| Field | Value |
|---|---|
| Trigger type | Contact field updated |
| Field | `share_count` |
| Condition | Value equals `7` OR value equals `8` |
| Filter | `vip_promoter_tier` is not equal to `champion` (prevents sending to already-promoted contacts) |

**Note:** GHL evaluates the trigger on every update to `share_count`. The `vip_promoter_tier` filter ensures this workflow does not re-fire after a contact has already been promoted to Champion.

### Workflow Actions

**Step 1 — Wait (optional)**
Add a 30-minute wait before the email to avoid sending immediately after a share event, which can feel automated and impersonal. Adjust to taste.

**Step 2 — Send Email**

- **Subject:** `You're almost a DRU CLEAR™ Champion — just {{custom_field.shares_remaining}} more to go`
- **From name:** Your name or "DRU AI Consulting"
- **From email:** Your GHL connected inbox

**Email body template:**

```
Hi {{contact.first_name}},

You've shared the DRU CLEAR™ AI Readiness Scorecard {{contact.share_count}} times — 
and you're just {{custom_field.shares_remaining}} share(s) away from Champion status.

Champions receive [describe your highest-value offer here — e.g., a complimentary 
group workshop seat, a co-branded LinkedIn feature, or a private strategy session].

Keep sharing your unique link:
{{contact.referral_link}}

Every share you make helps another leader discover where their organization stands 
on AI readiness — and brings you one step closer to Champion.

Thank you for spreading the word.

[Your name]
DRU AI Consulting
```

**Step 3 — Calculate shares_remaining**

Before sending the email, add a **Math Operation** action to compute `shares_remaining`:

| Field | Value |
|---|---|
| Action type | Math Operation |
| Field | `shares_remaining` (create as Number field) |
| Operation | Subtract |
| Value | `{{contact.share_count}}` from `10` |

GHL does not natively support inline arithmetic in email merge fields, so pre-computing `shares_remaining` as a custom field is the correct approach. Set this action **before** the Send Email step.

**Step 4 — Apply tag**
Apply tag: `nudged-to-champion`

This tag prevents duplicate sends if the contact shares again at count 8 (after already receiving the nudge at count 7). Add a workflow filter: `nudged-to-champion` tag does not exist.

### Complete Action Order

1. Math Operation: `shares_remaining = 10 - share_count`
2. Wait 30 minutes (optional)
3. Send Email (Champion nudge template)
4. Apply tag: `nudged-to-champion`

### Smart List

Create a Smart List named **"Champion Nudge Sent"** with filter: tag contains `nudged-to-champion`. This shows all contacts who received the nudge, and you can cross-reference with the Champion Smart List to measure conversion rate from nudge to Champion.

---

## Part 2 — Referred Conversion Rate Custom Field

### Purpose

`referred_conversion_rate` is a calculated efficiency metric: the percentage of a promoter's shares that resulted in a referred contact completing the scorecard. A contact with 2 shares and 2 completions (100%) is a stronger advocate than one with 20 shares and 2 completions (10%), even though their `share_count` is much higher.

### Custom Field Setup

| Setting | Value |
|---|---|
| Field name | `referred_conversion_rate` |
| Field type | Number (or Text if you want to store as percentage string) |
| Label | Referred Conversion Rate (%) |
| Description | Percentage of shares that resulted in a referred scorecard completion |

### Calculation Workflow

GHL does not support formula fields natively. The conversion rate must be computed inside a workflow and written back to the contact.

**Trigger:** Contact field updated → `referred_completions_count` (fires every time a referred completion is recorded)

**Step 1 — Guard: share_count > 0**
Add an If/Else branch: `share_count` is greater than `0`. Only proceed if true (avoids division by zero).

**Step 2 — Math Operation (division)**

GHL's Math Operation action supports division:

| Field | Value |
|---|---|
| Action type | Math Operation |
| Field | `referred_conversion_rate` |
| Operation | Divide |
| Dividend | `{{contact.referred_completions_count}}` |
| Divisor | `{{contact.share_count}}` |

**Step 3 — Math Operation (multiply by 100)**

| Field | Value |
|---|---|
| Action type | Math Operation |
| Field | `referred_conversion_rate` |
| Operation | Multiply |
| Value | `100` |

After these two steps, `referred_conversion_rate` holds the percentage as a whole number (e.g., `50` for 50%).

### Filtering and Sorting in GHL Contacts

Once the field is populated, you can:

1. Go to **Contacts → Filters**
2. Add filter: `referred_conversion_rate` is greater than `0`
3. Sort by `referred_conversion_rate` descending

This surfaces your highest-quality promoters — those whose shares convert at the highest rate — independently of raw volume.

### Recommended Smart Lists

| Smart List name | Filter |
|---|---|
| High-Quality Promoters | `referred_conversion_rate` ≥ 50 |
| Active but Low-Converting | `share_count` ≥ 5 AND `referred_conversion_rate` < 20 |
| Top Advocates (combined) | `share_count` ≥ 3 AND `referred_conversion_rate` ≥ 50 |

The "Active but Low-Converting" list is particularly actionable: these contacts are sharing but their links are not converting. Consider sending them a message with tips on how to frame the scorecard when sharing (e.g., a suggested caption or LinkedIn post template).

---

## Combined Promoter Metrics Summary

| Field | Type | Updated by | Purpose |
|---|---|---|---|
| `share_count` | Number | `share_click` webhook → Math Operation | Total shares across all channels |
| `last_share_channel` | Dropdown | `share_click` webhook → Update Contact | Most recent share platform |
| `first_share_channel` | Dropdown | `share_click` webhook → Update Contact (write-once) | Original share platform preference |
| `referred_completions_count` | Number | `scorecard_complete` webhook → Math Operation | Completions driven by this promoter |
| `referred_conversion_rate` | Number | Computed workflow → Math Operation | Conversion efficiency (%) |
| `vip_promoter_tier` | Dropdown | VIP workflows → Update Contact | `advocate` (5 shares) or `champion` (10 shares) |
| `shares_remaining` | Number | Nudge workflow → Math Operation | Temporary field for nudge email merge |
