// api/social-publisher.ts
// Vercel edge function — posts approved social content to GHL Social Planner
// Same pattern as api/twin.ts — no wall clock timeout issues

export const config = { runtime: "edge" };

const GHL_BASE    = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const LOCATION_ID = "gl07I4JnbkGgW8zJprSz";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLATFORM_MAP: Record<string, string> = {
  LinkedIn:  "linkedin",
  Facebook:  "facebook",
  Instagram: "instagram",
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

    // ── Step 1: Get connected social accounts ────────────────────────────────
    const accountsRes = await fetch(
      `${GHL_BASE}/social-media-posting/oauth/${LOCATION_ID}/accounts`,
      { method: "GET", headers }
    );

    if (!accountsRes.ok) {
      const errText = await accountsRes.text();
      return new Response(
        JSON.stringify({ error: "Failed to fetch connected accounts", detail: errText }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const accountsData = await accountsRes.json();
    const allAccounts  = accountsData?.data || accountsData?.accounts || [];

    // ── Step 2: Filter by platform ───────────────────────────────────────────
    const targetPlatform = PLATFORM_MAP[platform] || platform.toLowerCase();
    const matching = allAccounts.filter(
      (a: any) => a.platform?.toLowerCase() === targetPlatform
    );

    if (matching.length === 0) {
      return new Response(
        JSON.stringify({ error: `No connected ${platform} account found`, approval_id }),
        { status: 404, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const accountIds = matching.map((a: any) => a.id);

    // ── Step 3: Post to GHL Social Planner ───────────────────────────────────
    const postRes = await fetch(
      `${GHL_BASE}/social-media-posting/${LOCATION_ID}/posts`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          accountIds,
          content,
          type:   "post",
          status: "publish",
        }),
      }
    );

    if (!postRes.ok) {
      const errText = await postRes.text();
      return new Response(
        JSON.stringify({ error: "GHL post failed", detail: errText }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const postData = await postRes.json();

    return new Response(
      JSON.stringify({
        success:     true,
        platform,
        accountIds,
        approval_id,
        ghl_post_id: postData?.id || postData?.postId || null,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
}
