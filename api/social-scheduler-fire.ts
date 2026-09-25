// api/social-scheduler-fire.ts
// Called by pg_cron (dru-social-scheduler-fire) every 15 minutes, 9am-5pm Central window only.
// Finds every approvals row that's been scheduled and whose time has arrived, sends its frozen
// payload through the exact same /api/social-publisher endpoint the "Approve + Publish" button
// uses, then marks it posted. A row that fails stays "scheduled" so the next run retries it.

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const incomingSecret = req.headers.get("x-cron-secret");
  if (incomingSecret !== process.env.CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = "https://dsflijqygsegonwxauce.supabase.co";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseKey) {
    return new Response(JSON.stringify({ error: "SUPABASE_SERVICE_ROLE_KEY not set" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  const dbHeaders = {
    "Content-Type": "application/json",
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
  };

  const nowIso = new Date().toISOString();

  // Every "scheduled" row whose time has arrived — including any from a slot that already
  // passed before this run caught it, so nothing scheduled ever silently gets skipped.
  const dueRes = await fetch(
    `${supabaseUrl}/rest/v1/approvals?status=eq.scheduled&scheduled_post_at=lte.${encodeURIComponent(nowIso)}&select=id,scheduled_payload`,
    { headers: dbHeaders }
  );

  if (!dueRes.ok) {
    const err = await dueRes.text();
    return new Response(JSON.stringify({ error: "Failed to read due approvals", detail: err }), {
      status: 502,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const due: { id: string; scheduled_payload: Record<string, any> }[] = await dueRes.json();
  const results: { id: string; posted: boolean }[] = [];

  for (const row of due) {
    let posted = false;
    try {
      const publishRes = await fetch("https://app.druaiconsulting.com/api/social-publisher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row.scheduled_payload),
      });
      posted = publishRes.ok;
    } catch (e) {
      console.error(`social-scheduler-fire: publish call failed for ${row.id}:`, e);
    }

    if (posted) {
      await fetch(`${supabaseUrl}/rest/v1/approvals?id=eq.${row.id}`, {
        method: "PATCH",
        headers: { ...dbHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ status: "posted" }),
      });
    }
    // If posting failed, the row stays "scheduled" — the next 15-minute run tries it again.

    results.push({ id: row.id, posted });
  }

  return new Response(JSON.stringify({ checked_at: nowIso, found: due.length, results }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
