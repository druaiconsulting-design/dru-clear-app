import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { supabaseAdmin, getRPConfig } from "../_lib/config.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { rpID, origin } = getRPConfig(req);
    const credentialID = req.body.id;

    const { data: credRow, error: credError } = await supabaseAdmin
      .from("passkey_credentials")
      .select("*")
      .eq("credential_id", credentialID)
      .single();

    if (credError || !credRow) {
      return res.status(400).json({ error: "Passkey not recognized" });
    }

    const { data: challengeRows } = await supabaseAdmin
      .from("passkey_challenges")
      .select("challenge")
      .eq("type", "authentication")
      .order("created_at", { ascending: false })
      .limit(1);

    if (!challengeRows || challengeRows.length === 0) {
      return res.status(400).json({ error: "No challenge found" });
    }

    const expectedChallenge = challengeRows[0].challenge;

    const publicKeyBytes = Uint8Array.from(
      Buffer.from(credRow.public_key, "base64url")
    );

    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credRow.credential_id,
        publicKey: publicKeyBytes,
        counter: credRow.counter,
        transports: credRow.transports || [],
      },
    });

    if (!verification.verified) {
      return res.status(400).json({ error: "Verification failed" });
    }

    await supabaseAdmin
      .from("passkey_credentials")
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq("credential_id", credentialID);

    await supabaseAdmin
      .from("passkey_challenges")
      .delete()
      .eq("challenge", expectedChallenge);

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(
      credRow.user_id
    );

    if (!userData?.user?.email) {
      return res.status(500).json({ error: "User not found" });
    }

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: userData.user.email,
      });

    if (linkError || !linkData) {
      return res.status(500).json({ error: "Failed to create session" });
    }

    return res.json({
      verified: true,
      email: userData.user.email,
      token_hash: linkData.properties.hashed_token,
    });
  } catch (error) {
    console.error("Auth verify error:", error);
    return res.status(500).json({ error: "Verification failed" });
  }
}
