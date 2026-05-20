// api/lead-executor.ts
// Vercel Edge function
// Called by AdminApprovals when DeAnna approves a lead_intelligence card
// Fires GHL webhook with direction so the workflow routes the lead correctly
// Direction options: assessment_invite | follow_up_email | follow_up_sms | assign_task | nurture

export const config = { runtime: "edge" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  const webhookUrl = process.env.GHL_LEAD_EXECUTOR_WEBHOOK;
  if (!webhookUrl) {
    console.error("[lead-executor] GHL_LEAD_EXECUTOR_WEBHOOK not set");
    return new Response(JSON.stringify({ error: "GHL_LEAD_EXECUTOR_WEBHOOK not configured" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const { approval_id, output, direction, agent_name } = await req.json();

    if (!approval_id || !direction) {
      return new Response(JSON.stringify({ error: "approval_id and direction are required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Map direction value to human-readable label for GHL
    const DIRECTION_LABELS: Record<string, string> = {
      assessment_invite: "Assessment Invite — assessment.druaiconsulting.com",
      follow_up_email:   "Follow-up Email Sequence",
      follow_up_sms:     "Follow-up SMS",
      assign_task:       "Assign Task — Follow Up",
      nurture:           "Add to Nurture",
    };

    const payload = {
      // Core routing
      approval_id,
      direction,
      direction_label:  DIRECTION_LABELS[direction] ?? direction,
      cta:              "assessment.druaiconsulting.com",

      // Context for GHL workflow
      agent_name:       agent_name ?? "Ryan Nakamura",
      briefing_preview: typeof output === "string" ? output.slice(0, 600) : "",
      triggered_at:     new Date().toISOString(),
      triggered_by:     "DeAnna Upshaw",
      location_id:      "gl07I4JnbkGgW8zJprSz",

      // Tags to search for in GHL (Ryan already tagged leads during scoring)
      search_tags:      ["ai-scored", "intent-high"],
    };

    console.log(`[lead-executor] Firing GHL webhook | direction: ${direction} | approval: ${approval_id}`);

    const ghlRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!ghlRes.ok) {
      const errText = await ghlRes.text();
      console.error(`[lead-executor] GHL webhook failed: ${ghlRes.status} — ${errText.slice(0, 200)}`);
      return new Response(JSON.stringify({ error: `GHL webhook failed: ${ghlRes.status}` }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    console.log(`[lead-executor] ✓ GHL webhook fired | direction: ${direction}`);

    return new Response(JSON.stringify({ success: true, direction, approval_id }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    console.error("[lead-executor] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
}
