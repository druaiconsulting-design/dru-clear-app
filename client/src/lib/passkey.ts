import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { supabase } from "./supabase";

// ─── Register a Passkey (user must be logged in) ─────────────────────
export async function registerPasskey(): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: "You must be logged in to set up a passkey." };

    // 1. Get registration options from server
    const optionsRes = await fetch("/api/passkey/register-options", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!optionsRes.ok) {
      const err = await optionsRes.json();
      return { success: false, error: err.error || "Failed to get registration options." };
    }

    const options = await optionsRes.json();

    // 2. Prompt biometric (Face ID / fingerprint / Windows Hello)
    const credential = await startRegistration({ optionsJSON: options });

    // 3. Send credential to server for verification
    const verifyRes = await fetch("/api/passkey/register-verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(credential),
    });

    if (!verifyRes.ok) {
      const err = await verifyRes.json();
      return { success: false, error: err.error || "Passkey verification failed." };
    }

    return { success: true };
  } catch (err: any) {
    if (err.name === "NotAllowedError") {
      return { success: false, error: "Passkey setup was cancelled." };
    }
    return { success: false, error: err.message || "Failed to register passkey." };
  }
}

// ─── Login with Passkey (no password needed) ─────────────────────────
export async function loginWithPasskey(): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Get authentication options from server
    const optionsRes = await fetch("/api/passkey/auth-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!optionsRes.ok) {
      const err = await optionsRes.json();
      return { success: false, error: err.error || "Failed to start passkey login." };
    }

    const options = await optionsRes.json();

    // 2. Prompt biometric (Face ID / fingerprint / Windows Hello)
    const credential = await startAuthentication({ optionsJSON: options });

    // 3. Send to server for verification
    const verifyRes = await fetch("/api/passkey/auth-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credential),
    });

    if (!verifyRes.ok) {
      const err = await verifyRes.json();
      return { success: false, error: err.error || "Passkey not recognized." };
    }

    const { token_hash } = await verifyRes.json();

    // 4. Use the token hash to create a real Supabase session
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: "magiclink",
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    if (err.name === "NotAllowedError") {
      return { success: false, error: "Passkey login was cancelled." };
    }
    return { success: false, error: err.message || "Passkey login failed." };
  }
}
