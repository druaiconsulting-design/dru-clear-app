// Add these cron entries to your existing vercel.json "crons" array.
// All POST to /api/ghl-agent-trigger with the appropriate trigger_type.
// Schedule uses UTC. DRU agents run 6:00-7:30 AM CST = 12:00-13:30 UTC.
// CC agents staggered 1 minute apart starting at 12:30 UTC (7:30 AM CST).

// --- PASTE INTO vercel.json "crons": [ ... ] ---
// (These go alongside your existing P1-P8 cron entries)

{
  "schedule": "30 12 * * *",
  "path": "/api/ghl-agent-trigger?trigger_type=cron_dominique_daily_insight"
},
{
  "schedule": "31 12 * * *",
  "path": "/api/ghl-agent-trigger?trigger_type=cron_elijah_framework_lesson"
},
{
  "schedule": "32 12 * * *",
  "path": "/api/ghl-agent-trigger?trigger_type=cron_solange_action_challenge"
},
{
  "schedule": "33 12 * * *",
  "path": "/api/ghl-agent-trigger?trigger_type=cron_isaiah_webb_framework"
},
{
  "schedule": "34 12 * * *",
  "path": "/api/ghl-agent-trigger?trigger_type=cron_nadia_strategic_edge"
},
{
  "schedule": "35 12 * * *",
  "path": "/api/ghl-agent-trigger?trigger_type=cron_victor_engagement"
},
{
  "schedule": "36 12 * * *",
  "path": "/api/ghl-agent-trigger?trigger_type=cron_sasha_sales_insight"
},
{
  "schedule": "37 12 * * *",
  "path": "/api/ghl-agent-trigger?trigger_type=cron_tariq_pdf_brief"
},
{
  "schedule": "38 12 * * *",
  "path": "/api/ghl-agent-trigger?trigger_type=cron_zoe_community_lead"
},
{
  "schedule": "39 12 * * *",
  "path": "/api/ghl-agent-trigger?trigger_type=cron_micah_member_experience"
}

// NOTE: Vercel crons use GET requests by default.
// If your ghl-agent-trigger handler requires POST, add a thin GET wrapper
// or set your handler to accept both GET and POST (check req.method === 'POST' || 'GET').
// The trigger_type is read from req.query on GET, req.body on POST.
// Simplest fix: add this to the top of your handler before the POST check:
//   if (req.method === 'GET' && req.query.trigger_type) {
//     req.body = { trigger_type: req.query.trigger_type };
//   }
