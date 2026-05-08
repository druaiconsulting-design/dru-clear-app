// api/social-publisher.ts
// Vercel edge function — posts approved social content to GHL Social Planner

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const body = await req.json();
  const { content, platform, approval_id } = body;
  const ghlKey = process.env.GHL_API_KEY;

  if (!ghlKey) {
    return new Response(JSON.stringify({ error: "No GHL_API_KEY" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const ghlHeaders = {
    "Authorization": `Bearer ${ghlKey}`,
    "Version": "2021-07-28",
    "Content-Type": "application/json",
  };

  // ── Step 1: Fetch connected accounts ─────────────────────────────────────
  const accountsRes = await fetch(
    `https://services.leadconnectorhq.com/social-media-posting/gl07I4JnbkGgW8zJprSz/accounts`,
    { method: "GET", headers: ghlHeaders }
  );

  if (!accountsRes.ok) {
    const err = await accountsRes.text();
    return new Response(JSON.stringify({ error: "Failed to fetch accounts", detail: err }), {
      status: 502,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const accountsData = await accountsRes.json();
  // GHL returns accounts at results.accounts
  const allAccounts = accountsData?.results?.accounts || [];

  // ── Step 2: Match by platform key (e.g. account has a "linkedin" field) ──
  const platformKey = platform.toLowerCase(); // "linkedin", "facebook", "instagram"
  const matching = allAccounts.filter((a: any) =>
    Object.keys(a).some((k) => k.toLowerCase() === platformKey)
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
    `https://services.leadconnectorhq.com/social-media-posting/gl07I4JnbkGgW8zJprSz/posts`,
    {
      method: "POST",
      headers: ghlHeaders,
      body: JSON.stringify({
        accountIds,
        content,
        type:   "post",
        status: "publish",
      }),
    }
  );

  if (!postRes.ok) {
    const err = await postRes.text();
    return new Response(JSON.stringify({ error: "GHL post failed", detail: err }), {
      status: 502,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
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
}
