// api/social-publisher.ts
// Vercel edge function — sends approved social post to Make.com → LinkedIn, Facebook, Instagram
// UPDATED: Fires one Make webhook call per selected platform so Make Router filters work correctly.
//          Each call carries a single `platform` field ("LinkedIn" | "Facebook" | "Instagram")
//          plus the full content fields so existing Make module mappings are unchanged.

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

  // Detect multi-platform vs single-platform payload
  const isMultiPlatform = !!(
    body.linkedin_content &&
    body.facebook_content &&
    body.instagram_caption
  );

  // ── SINGLE-PLATFORM (Phase 1 backward compat) ─────────────────────────────
  if (!isMultiPlatform) {
    const res = await fetch(makeWebhookUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        post_content: body.content,
        agent_name:   "Darius King",
        category:     "social_post",
        platform:     body.platform,
        approval_id:  body.approval_id,
        video_url:    body.video_url  ?? null,
        image_url:    body.image_url  ?? null,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(
        JSON.stringify({ error: "Make.com webhook failed", detail: err, approval_id: body.approval_id }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, multi_platform: false, approval_id: body.approval_id }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // ── MULTI-PLATFORM: one Make call per selected platform ───────────────────
  // Each call has a single `platform` string so Make Router filters work:
  //   LinkedIn branch filter: platform Equal to "LinkedIn"
  //   Facebook branch filter: platform Equal to "Facebook"
  //   Instagram branch filter: platform Equal to "Instagram"

  const selectedPlatforms: string[] =
    Array.isArray(body.platforms_selected) && body.platforms_selected.length > 0
      ? body.platforms_selected
      : ["LinkedIn", "Facebook", "Instagram"];

  const results = await Promise.allSettled(
    selectedPlatforms.map(async (platform: string) => {
      const payload = {
        // Single platform for this call — Make Router filters on this field
        platform,

        // Full content fields — existing Make module mappings unchanged
        linkedin_content:    body.linkedin_content,
        facebook_content:    body.facebook_content,
        instagram_caption:   body.instagram_caption,
        post_content:        body.linkedin_content, // backward compat

        // Metadata
        agent_name:          "Darius King",
        category:            "social_post",
        approval_id:         body.approval_id,

        // Media — Instagram gets its own reel URL if provided
        video_url:           platform === "Instagram"
                               ? (body.instagram_video_url ?? body.video_url ?? null)
                               : (body.video_url ?? null),
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
        throw new Error(`Make webhook failed for ${platform}: ${err}`);
      }

      return platform;
    })
  );

  const succeeded = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map(r => r.value);

  const failed = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map(r => r.reason?.message ?? "unknown error");

  // ── SOCIAL ASSETS: Auto-log on successful publish ─────────────────────────
  const assetUrl = body.video_url || body.image_url || null;

  if (assetUrl && succeeded.length > 0) {
    try {
      const assetType   = body.video_url ? "video" : "image";
      const urlParts    = assetUrl.split("/");
      const bunnyVideoId = assetType === "video" ? urlParts[urlParts.length - 2] : null;
      const thumbnailUrl = assetType === "video"
        ? assetUrl.replace("/play_720p.mp4", "/thumbnail.jpg")
        : assetUrl;

      const today = new Date().toISOString().slice(0, 10);

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
          platform:         succeeded.join(", "),
          thumbnail_url:    thumbnailUrl,
          bunny_library_id: assetType === "video" ? "681486" : null,
          bunny_video_id:   bunnyVideoId,
          used_count:       1,
          last_used_at:     new Date().toISOString(),
          is_active:        true,
        }),
      });
    } catch (e) {
      // Non-fatal — publish already succeeded
      console.error("social_assets insert failed:", e);
    }
  }
  // ── END SOCIAL ASSETS ─────────────────────────────────────────────────────

  if (failed.length > 0 && succeeded.length === 0) {
    return new Response(
      JSON.stringify({ error: "All platform webhooks failed", details: failed, approval_id: body.approval_id }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success:        true,
      multi_platform: true,
      platforms_sent: succeeded,
      platforms_failed: failed.length > 0 ? failed : undefined,
      approval_id:    body.approval_id,
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
}
