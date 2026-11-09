import { supabase } from "./supabase";

export interface ApiResult { ok: boolean; status: number; body: any }

// Calls one of the app's own backend routes with the signed-in admin token.
export async function callApi(path: string, init?: { method?: string; body?: unknown }): Promise<ApiResult> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return { ok: false, status: 401, body: { error: "You are signed out. Sign in again and retry." } };
  const res = await fetch(path, {
    method: init?.method || "GET",
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  let body: any = {};
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  return { ok: res.ok && body?.ok !== false, status: res.status, body };
}
