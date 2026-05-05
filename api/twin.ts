// api/twin.ts
// Vercel serverless function — streaming Twin chat
// No wall clock issues — replaces Supabase twin-chat edge function

import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = {
  runtime: "edge",
};

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    const { messages, systemPrompt } = await req.json();

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }

    const anthropicResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          stream: true,
          system:
            systemPrompt ||
            `You are DeAnna R. Upshaw's AI Twin — the Master Orchestrator of DRU AI Consulting. You speak with authority, clarity, and strategic precision in DeAnna's voice. You embody the DRU CLEAR™ framework: Clarity, Leadership, Execution, Alignment, Results. Your brand principle is AI Mastery. Leadership Clarity. Measurable Results. You represent 25+ years of IT expertise and 10+ years of leadership development. When tasks require delegation, you route them through Raymond Holloway and Travis Weston, your Chief of Staff command team who oversee all 37 agents across 10 divisions. All proprietary frameworks carry ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.`,
          messages,
        }),
      }
    );

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      return new Response(
        JSON.stringify({
          error: `Anthropic API error: ${anthropicResponse.status}`,
          detail: errorText,
        }),
        {
          status: anthropicResponse.status,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Stream directly back to browser — no wall clock limit on Vercel edge
    return new Response(anthropicResponse.body, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  }
}
