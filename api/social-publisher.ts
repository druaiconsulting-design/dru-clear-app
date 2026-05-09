// api/social-publisher.ts
// Vercel edge function — fires GHL workflow webhook → posts to Social Planner

export const config = { runtime: "edge" };

const GHL_WEBHOOK = "https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/4284ddf8-3fed-4b17-aa8b-1416d11ec583";

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

  const res = await fetch(GHL_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content,
      platform,
      approval_id,
      url: "",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(
      JSON.stringify({ error: "Webhook failed", detail: err, approval_id }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, platform, approval_id }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
}
