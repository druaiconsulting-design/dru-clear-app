// api/social-publisher.ts
// Vercel edge function — sends approved LinkedIn post to Make.com → LinkedIn
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

  const { content, platform, approval_id } = await req.json();

  const makeWebhookUrl = process.env.MAKE_LINKEDIN_WEBHOOK_URL;
  if (!makeWebhookUrl) {
    return new Response(
      JSON.stringify({ error: "MAKE_LINKEDIN_WEBHOOK_URL not set" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const res = await fetch(makeWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      post_content: content,
      agent_name:   "Darius King",
      category:     "linkedin_post",
      platform,
      approval_id,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(
      JSON.stringify({ error: "Make.com webhook failed", detail: err, approval_id }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, platform, approval_id }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
}
