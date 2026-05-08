import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { supabaseAdmin, getRPConfig, getUserFromToken } from "../_lib/config.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { rpName, rpID } = getRPConfig(req);

    const { data: existingCreds } = await supabaseAdmin
      .from("passkey_credentials")
      .select("credential_id")
      .eq("user_id", user.id);

    const excludeCredentials = (existingCreds || []).map((cred) => ({
      id: cred.credential_id,
      type: "public-key" as const,
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email || user.id,
      userDisplayName: user.email || "DRU Clear User",
      attestationType: "none",
      excludeCredentials,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    await supabaseAdmin.from("passkey_challenges").insert({
      challenge: options.challenge,
      user_id: user.id,
      type: "registration",
    });

    return res.json(options);
  } catch (error) {
    console.error("Register options error:", error);
    return res.status(500).json({ error: "Failed to generate options" });
  }
}
