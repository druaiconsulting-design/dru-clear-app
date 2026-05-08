import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
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

    const { rpID, origin } = getRPConfig(req);

    const { data: challengeRows } = await supabaseAdmin
      .from("passkey_challenges")
      .select("challenge")
      .eq("user_id", user.id)
      .eq("type", "registration")
      .order("created_at", { ascending: false })
      .limit(1);

    if (!challengeRows || challengeRows.length === 0) {
      return res.status(400).json({ error: "No challenge found" });
    }

    const expectedChallenge = challengeRows[0].challenge;

    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: "Verification failed" });
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    await supabaseAdmin.from("passkey_credentials").insert({
      credential_id: credential.id,
      user_id: user.id,
      public_key: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      device_type: credentialDeviceType,
      backed_up: credentialBackedUp,
      transports: req.body.response?.transports || [],
      friendly_name: "My Passkey",
    });

    await supabaseAdmin
      .from("passkey_challenges")
      .delete()
      .eq("user_id", user.id)
      .eq("type", "registration");

    return res.json({ verified: true });
  } catch (error) {
    console.error("Register verify error:", error);
    return res.status(500).json({ error: "Verification failed" });
  }
}
