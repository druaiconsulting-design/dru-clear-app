// api/social-publisher.ts
// Vercel edge function — sends approved social post to Make.com → LinkedIn, Facebook, Instagram
// PHASE 2: Detects multi-platform payload (linkedin_content/facebook_content/instagram_caption)
//          vs single-platform payload (content/platform) for backward compat
// SOCIAL ASSETS: Auto-logs video/image to social_assets table on every successful publish

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

  // ── SOCIAL ASSETS: Auto-log published asset ──────────────────────────────
  // Fires only when a video_url or image_url is present on the approved card.
  // Non-fatal — if this write fails, the publish already succeeded.
  const assetUrl = body.video_url || body.image_url || null;

  if (assetUrl) {
    try {
      const assetType = body.video_url ? "video" : "image";

      // Extract Bunny video GUID from URL:
      // https://vz-65fe52c5-439.b-cdn.net/[GUID]/play_720p.mp4 → GUID is second-to-last segment
      const urlParts = assetUrl.split("/");
      const bunnyVideoId = assetType === "video" ? urlParts[urlParts.length - 2] : null;

      // Derive thumbnail — swap play_720p.mp4 for thumbnail.jpg on Bunny video URLs
      const thumbnailUrl =
        assetType === "video"
          ? assetUrl.replace("/play_720p.mp4", "/thumbnail.jpg")
          : assetUrl;

      // Platform string — join array for multi-platform, use single value for Phase 1
      const platform = isMultiPlatform
        ? (body.platforms_selected ?? ["LinkedIn", "Facebook", "Instagram"]).join(", ")
        : body.platform ?? "LinkedIn";

      // Title — date-stamped for easy identification in Supabase
      const today = new Date().toISOString().slice(0, 10);
      const title = `Social post — ${today}`;

      const socialAssetPayload = {
        title,
        asset_url:        assetUrl,
        asset_type:       assetType,
        category:         "social_post",
        platform,
        thumbnail_url:    thumbnailUrl,
        bunny_library_id: assetType === "video" ? "681486" : null,
        bunny_video_id:   bunnyVideoId,
        used_count:       1,
        last_used_at:     new Date().toISOString(),
        is_active:        true,
      };

      const supabaseUrl = "https://dsflijqygsegonwxauce.supabase.co";
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      await fetch(`${supabaseUrl}/rest/v1/social_assets`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "apikey":        supabaseKey!,
          "Authorization": `Bearer ${supabaseKey!}`,
          "Prefer":        "return=minimal",
        },
        body: JSON.stringify(socialAssetPayload),
      });
    } catch (e) {
      // Non-fatal — log but don't block the publish response
      console.error("social_assets insert failed:", e);
    }
  }
  // ── END SOCIAL ASSETS ────────────────────────────────────────────────────

  return new Response(
    JSON.stringify({
      success:        true,
      multi_platform: isMultiPlatform,
      approval_id:    body.approval_id,
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
}
