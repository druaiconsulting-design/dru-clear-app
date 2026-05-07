import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Supabase Admin Client (uses service role key) ─────────────────
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// ─── Helper: Get RP config from request ─────────────────────────────
function getRPConfig(req: express.Request) {
  const origin = `${req.protocol}://${req.get("host")}`;
  const rpID = req.get("host")?.split(":")[0] || "localhost";
  return { rpName: "DRU Clear", rpID, origin };
}

// ─── Helper: Get user from auth token ───────────────────────────────
async function getUserFromToken(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Parse JSON bodies for API routes
  app.use(express.json());

  // ═══════════════════════════════════════════════════════════════════
  // PASSKEY API ROUTES
  // ═══════════════════════════════════════════════════════════════════

  // ─── 1. Registration Options (user must be logged in) ─────────────
  app.post("/api/passkey/register-options", async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { rpName, rpID } = getRPConfig(req);

      // Get existing passkeys for this user
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

      // Store challenge in database
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
  });

  // ─── 2. Registration Verify (user must be logged in) ──────────────
  app.post("/api/passkey/register-verify", async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { rpID, origin } = getRPConfig(req);

      // Get the stored challenge
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

      // Store the credential in database
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

      // Clean up used challenge
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
  });

  // ─── 3. Authentication Options (no login required) ────────────────
  app.post("/api/passkey/auth-options", async (req, res) => {
    try {
      const { rpID } = getRPConfig(req);

      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: "preferred",
      });

      // Store challenge (no user_id since they're not logged in yet)
      await supabaseAdmin.from("passkey_challenges").insert({
        challenge: options.challenge,
        type: "authentication",
      });

      return res.json(options);
    } catch (error) {
      console.error("Auth options error:", error);
      return res.status(500).json({ error: "Failed to generate options" });
    }
  });

  // ─── 4. Authentication Verify (no login required) ─────────────────
  app.post("/api/passkey/auth-verify", async (req, res) => {
    try {
      const { rpID, origin } = getRPConfig(req);
      const credentialID = req.body.id;

      // Look up the credential in the database
      const { data: credRow, error: credError } = await supabaseAdmin
        .from("passkey_credentials")
        .select("*")
        .eq("credential_id", credentialID)
        .single();

      if (credError || !credRow) {
        return res.status(400).json({ error: "Passkey not recognized" });
      }

      // Get the stored challenge
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

      // Reconstruct the public key as Uint8Array
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

      // Update the counter and last_used_at
      await supabaseAdmin
        .from("passkey_credentials")
        .update({
          counter: verification.authenticationInfo.newCounter,
          last_used_at: new Date().toISOString(),
        })
        .eq("credential_id", credentialID);

      // Clean up used challenge
      await supabaseAdmin
        .from("passkey_challenges")
        .delete()
        .eq("challenge", expectedChallenge);

      // Get the user's email so we can create a session
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(
        credRow.user_id
      );

      if (!userData?.user?.email) {
        return res.status(500).json({ error: "User not found" });
      }

      // Generate a magic link token for passwordless sign-in
      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: userData.user.email,
        });

      if (linkError || !linkData) {
        return res.status(500).json({ error: "Failed to create session" });
      }

      // Extract the token hash from the generated link
      const url = new URL(linkData.properties.action_link);
      const tokenHash = url.searchParams.get("token_hash") || url.hash;

      return res.json({
        verified: true,
        email: userData.user.email,
        token_hash: linkData.properties.hashed_token,
      });
    } catch (error) {
      console.error("Auth verify error:", error);
      return res.status(500).json({ error: "Verification failed" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // STATIC FILE SERVING
  // ═══════════════════════════════════════════════════════════════════

  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
