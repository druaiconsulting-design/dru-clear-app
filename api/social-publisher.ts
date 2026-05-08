// api/social-publisher.ts
// Vercel edge function — posts approved social content to GHL Social Planner

export const config = { runtime: "edge" };

// Known connected account IDs — update when new platforms are connected
const ACCOUNT_IDS: Record<string, string> = {
  LinkedIn:  "69517e68988b5630a9f5f936_g107I4JnbkGgW8zJprSz_8J5aciAqTq_profile",
  Facebook:  "", // add when Facebook is connected
  Instagram: "", // add when Instagram is connected
};

export default async function handler(req: Request) {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const { content, platform, approval_id } = await req.json();
  const ghlKey = process.env.GHL_API_KEY;

  if (!ghlKey) {
    return new Response(JSON.stringify({ error: "No GHL_API_KEY" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const accountId = ACCOUNT_IDS[platform] || "";

  if (!accountId) {
    return new Response(
      JSON.stringify({ error: `No account ID configured for ${platform}`, approval_id }),
      { status: 404, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // ── Post directly to GHL Social Planner ───────────────────────────────────
  const postRes = await fetch(
    `https://services.leadconnectorhq.com/social-media-posting/gl07I4JnbkGgW8zJprSz/posts`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ghlKey}`,
        "Version": "2021-07-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountIds: [accountId],
        content,
        type:   "post",
        status: "publish",
      }),
    }
  );

  if (!postRes.ok) {
    const err = await postRes.text();
    return new Response(
      JSON.stringify({ error: "GHL post failed", detail: err, approval_id }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const postData = await postRes.json();

  return new Response(
    JSON.stringify({
      success:     true,
      platform,
      account_id:  accountId,
      approval_id,
      ghl_post_id: postData?.id || postData?.postId || null,
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
}
