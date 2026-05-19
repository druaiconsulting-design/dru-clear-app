import { createClient } from "@supabase/supabase-js";
import type { VercelRequest } from "@vercel/node";

export const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export function getRPConfig(req: VercelRequest) {
  const host = req.headers.host || "localhost";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  const rpID = host.split(":")[0];
  return { rpName: "DRU Clear", rpID, origin };
}

export async function getUserFromToken(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  // @ts-ignore
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
