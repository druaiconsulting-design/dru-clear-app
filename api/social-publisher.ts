// api/social-publisher.ts
// ONE webhook call to Make. Router filters on content fields:
//   LinkedIn branch:  linkedin_content  Is not empty
//   Facebook branch:  facebook_content  Is not empty
//   Instagram branch: instagram_caption Is not empty

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

  // Resolve selected platforms
  const selectedPlatforms: string[] =
    Array.isArray(body.platforms_selected) && body.platforms_selected.length > 0
      ? body.platforms_selected
      : body.platform
        ? [body.platform]
        : ["LinkedIn"];

  const onLinkedIn  = selectedPlatforms.includes("LinkedIn");
  const onFacebook  = selectedPlatforms.includes("Facebook");
  const onInstagram = selectedPlatforms.includes("Instagram");

  // Only populate a platform's content field if that platform is selected.
  // Make Router filters on: linkedin_content / facebook_content / instagram_caption Is not empty.
  // These fields are already in Make's detected schema — no re-detection needed.
  const payload = {
    linkedin_content:    onLinkedIn  ? (body.linkedin_content  || body.content || "") : "",
    facebook_content:    onFacebook  ? (body.facebook_content  || body.content || "") : "",
    instagram_caption:   onInstagram ? (body.instagram_caption || body.content || "") : "",
    post_content:        body.linkedin_content || body.content || "",
    agent_name:          "Darius King",
    category:            "social_post",
    approval_id:         body.approval_id,
    platforms_selected:  selectedPlatforms,
    video_url:           body.video_url          ?? null,
    instagram_video_url: body.instagram_video_url ?? null,
    image_url:           body.image_url           ?? null,
    // FB Reel — 9:16 vertical only, optional; fires alongside the regular Facebook post/video
    facebook_reel_url:   onFacebook ? (body.facebook_reel_url ?? null) : null,
  };

  const res = await fetch(makeWebhookUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(
      JSON.stringify({ error: "Make webhook failed", detail: err, approval_id: body.approval_id }),
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
          platform:         selectedPlatforms.join(", "),
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

  return new Response(
    JSON.stringify({ success: true, platforms_sent: selectedPlatforms, approval_id: body.approval_id }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
}
