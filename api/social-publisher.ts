// api/social-publisher.ts
// Vercel edge function — posts text-only content to GHL Social Planner API

export const config = { runtime: "edge" };

const LOCATION_ID = "gl07I4JnbkGgW8zJprSz";
const ACCOUNT_ID  = "69517e68988b5630a9f5f936_g107I4JnbkGgW8zJprSz_8J5aciAqTq_profile";
const USER_ID     = "69517e68988b5630a9f5f936";
const GHL_BASE    = "https://services.leadconnectorhq.com";

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
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const postRes = await fetch(`${GHL_BASE}/social-media-posting/${LOCATION_ID}/posts`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ghlKey}`,
      "Version": "2021-07-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId:     USER_ID,
      accountIds: [ACCOUNT_ID],
      summary:    content,
      type:       "post",
      media:      [],
      status:     "draft",
    }),
  });

  if (!postRes.ok) {
    const err = await postRes.text();
    return new Response(JSON.stringify({ error: "GHL post failed", detail: err, approval_id }), {
      status: 502, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const postData = await postRes.json();
  return new Response(
    JSON.stringify({ success: true, platform, approval_id, ghl_post_id: postData?.id || null }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
}
