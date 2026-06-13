// api/social-publisher.ts
// Vercel edge function — sends approved social post to Make.com → LinkedIn, Facebook, Instagram
// PHASE 2: Detects multi-platform payload (linkedin_content/facebook_content/instagram_caption)
//          vs single-platform payload (content/platform) for backward compat
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
  const makeWebhookUrl = process.env.MAKE_LINKEDIN_WEBHOOK_URL;

  if (!makeWebhookUrl) {
    return new Response(
      JSON.stringify({ error: "MAKE_LINKEDIN_WEBHOOK_URL not set" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // Detect Phase 2 multi-platform payload vs Phase 1 single-platform
  const isMultiPlatform = !!(
    body.linkedin_content &&
    body.facebook_content &&
    body.instagram_caption
  );

  const makePayload = isMultiPlatform
    ? {
        // Phase 2 — platform-native content per channel
        linkedin_content:    body.linkedin_content,
        facebook_content:    body.facebook_content,
        instagram_caption:   body.instagram_caption,
        post_content:        body.linkedin_content, // backward compat for existing Make modules
        platforms_selected:  body.platforms_selected ?? ["LinkedIn", "Facebook", "Instagram"],
        agent_name:          "Darius King",
        category:            "social_post",
        approval_id:         body.approval_id,
        video_url:           body.video_url           ?? null,
        instagram_video_url: body.instagram_video_url ?? null,
        image_url:           body.image_url           ?? null,
      }
    : {
        // Phase 1 — single-platform (unchanged behavior)
        post_content: body.content,
        agent_name:   "Darius King",
        category:     "social_post",
        platform:     body.platform,
        approval_id:  body.approval_id,
        video_url:    body.video_url  ?? null,
        image_url:    body.image_url  ?? null,
      };

  const res = await fetch(makeWebhookUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(makePayload),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(
      JSON.stringify({
        error:       "Make.com webhook failed",
        detail:      err,
        approval_id: body.approval_id,
      }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success:        true,
      multi_platform: isMultiPlatform,
      approval_id:    body.approval_id,
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
}
