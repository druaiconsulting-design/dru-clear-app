// api/social-publisher.ts
// Vercel edge function — posts approved social content to GHL Social Planner

export const config = { runtime: "edge" };

const GHL_BASE    = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const LOCATION_ID = "gl07I4JnbkGgW8zJprSz";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { content, platform, approval_id } = await req.json();

    const ghlKey = process.env.GHL_API_KEY;
    if (!ghlKey) {
      return new Response(
        JSON.stringify({ error: "GHL_API_KEY not configured" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const headers = {
      "Authorization": `Bearer ${ghlKey}`,
      "Version":       GHL_VERSION,
      "Content-Type":  "application/json",
    };

    // ── Step 1: Get connected social accounts — return full raw response ─────
    const accountsRes = await fetch(
      `${GHL_BASE}/social-media-posting/${LOCATION_ID}/accounts`,
      { method: "GET", headers }
    );

    const rawText = await accountsRes.text();
    let accountsData: any = {};
    try { accountsData = JSON.parse(rawText); } catch (_) {}

    // Return full raw response so we can see exact structure from GHL
    if (!accountsRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch accounts", status: accountsRes.status, raw: rawText }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Return the entire accountsData so we can inspect it
    return new Response(
      JSON.stringify({
        debug:        true,
        http_status:  accountsRes.status,
        raw_keys:     Object.keys(accountsData),
        full_response: accountsData,
        approval_id,
        platform,
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
}

