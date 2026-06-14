// api/social-publisher.ts
// Sends approved social post to Make.com Social Media Flow.
// ONE webhook call per post. platforms_selected sent as comma-separated string.
// Make Router filters: platforms_selected Contains LinkedIn / Facebook / Instagram

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

  // Resolve selected platforms from either a platforms_selected array (multi-platform card)
  // or a platform string (single-platform card). Default to LinkedIn if neither is present.
  const selectedPlatforms: string[] =
    Array.isArray(body.platforms_selected) && body.platforms_selected.length > 0
      ? body.platforms_selected
      : body.platform
        ? [body.platform]
        : ["LinkedIn"];

  // Comma-separated string — Make's "Contains" filter works on this:
  //   LinkedIn branch:  platforms_selected Contains LinkedIn
  //   Facebook branch:  platforms_selected Contains Facebook
  //   Instagram branch: platforms_selected Contains Instagram
  // "platforms_selected" is already in Make's detected schema so no re-detection needed.
  const platformsStr = selectedPlatforms.join(",");

  const payload = {
    platforms_selected:  selectedPlatforms,
    platform:            selectedPlatforms[0],            // backward compat for Make module mappings
    linkedin_content:    body.linkedin_content  || body.content || "",
    facebook_content:    body.facebook_content  || body.content || "",
    instagram_caption:   body.instagram_caption || body.content || "",
    post_content:        body.linkedin_content  || body.content || "",
    agent_name:          "Darius King",
    category:            "social_post",
    approval_id:         body.approval_id,
    video_url:           body.video_url          ?? null,
    instagram_video_url: body.instagram_video_url ?? null,
    image_url:           body.image_url           ?? null,
  };

  const res = await fetch(makeWebhookUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(
      JSON.stringify({ error: "Make.com webhook failed", detail: err, approval_id: body.approval_id }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // ── SOCIAL ASSETS: Auto-log on successful publish ─────────────────────────
  const assetUrl = body.video_url || body.image_url || null;
  if (assetUrl) {
    try {
      const assetType    = body.video_url ? "video" : "image";
      const urlParts     = assetUrl.split("/");
      const bunnyVideoId = assetType === "video" ? urlParts[urlParts.length - 2] : null;
      const thumbnailUrl = assetType === "video"
        ? assetUrl.replace("/play_720p.mp4", "/thumbnail.jpg")
        : assetUrl;
      const today       = new Date().toISOString().slice(0, 10);
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
        body: JSON.stringify({
          title:            `Social post — ${today}`,
          asset_url:        assetUrl,
          asset_type:       assetType,
          category:         "social_post",
          platform:         platformsStr,
          thumbnail_url:    thumbnailUrl,
          bunny_library_id: assetType === "video" ? "681486" : null,
          bunny_video_id:   bunnyVideoId,
          used_count:       1,
          last_used_at:     new Date().toISOString(),
          is_active:        true,
        }),
      });
    } catch (e) {
      console.error("social_assets insert failed:", e);
    }
  }
  // ── END SOCIAL ASSETS ─────────────────────────────────────────────────────

  return new Response(
    JSON.stringify({
      success:        true,
      platforms_sent: selectedPlatforms,
      approval_id:    body.approval_id,
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
}
