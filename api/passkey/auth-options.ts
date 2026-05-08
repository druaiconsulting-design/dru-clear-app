import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { supabaseAdmin, getRPConfig } from "../_lib/config.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { rpID } = getRPConfig(req);

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
    });

    await supabaseAdmin.from("passkey_challenges").insert({
      challenge: options.challenge,
      type: "authentication",
    });

    return res.json(options);
  } catch (error) {
    console.error("Auth options error:", error);
    return res.status(500).json({ error: "Failed to generate options" });
  }
}
