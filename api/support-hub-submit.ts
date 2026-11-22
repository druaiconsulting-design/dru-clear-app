// api/support-hub-submit.ts
// Receives a request from the Support Hub form on members.druaiconsulting.com ("Contact The Team").
// The member is signed in, and the form sends their sign-in token with the request. This endpoint:
//   1. confirms the token and reads the member's own email address from it (the form's own name and email are not used)
//   2. reads the member's name and tier from their profile
//   3. allows 3 requests per hour per member
//   4. saves the request as a ticket in support_requests with the member's category and attached file
//   5. password reset requests: Isaiah Carter replies right away with the reset steps. Every other request gets
//      Isaiah's instant reply (sent from support@support.druaiconsulting.com), and he drafts the full reply,
//      which waits on the Support Tickets page for DeAnna.
// The ticket is the same kind of ticket an email creates, so the Support Tickets page shows both together.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { waitUntil } from "@vercel/functions";
import { sb, handleTicket } from "./_lib/supportIsaiah.js";

export const config = { maxDuration: 300 };

const SUPPORT_ADDRESS = "support@support.druaiconsulting.com";
const CATEGORIES = ["Account & Billing", "Course Access", "Community", "Frameworks", "Other"];
const MAX_REQUESTS_PER_MEMBER_PER_HOUR = 3;
const MAX_QUESTION_CHARS = 5000;
const ALLOWED_ORIGINS = ["https://members.druaiconsulting.com", "https://app.druaiconsulting.com"];

function setCors(req: VercelRequest, res: VercelResponse): void {
  const origin = String(req.headers.origin ?? "");
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCors(req, res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "Method not allowed" }); return; }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceKey) { res.status(500).json({ ok: false, error: "Database settings are missing." }); return; }

  // 1. Who is signed in.
  const token = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!token) { res.status(401).json({ ok: false, error: "Please sign in again and retry." }); return; }
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${token}` } });
  if (!userRes.ok) { res.status(401).json({ ok: false, error: "Please sign in again and retry." }); return; }
  const user = (await userRes.json()) as { id?: string; email?: string };
  const memberId = String(user?.id ?? "");
  const memberEmail = String(user?.email ?? "").trim().toLowerCase();
  if (!/^[0-9a-f-]{36}$/i.test(memberId) || !memberEmail) { res.status(401).json({ ok: false, error: "Please sign in again and retry." }); return; }

  // What they wrote.
  const category = String(req.body?.category ?? "");
  const question = String(req.body?.question ?? "").trim();
  if (!CATEGORIES.includes(category)) { res.status(400).json({ ok: false, error: "Please choose a topic." }); return; }
  if (!question) { res.status(400).json({ ok: false, error: "Please write your question." }); return; }
  if (question.length > MAX_QUESTION_CHARS) { res.status(400).json({ ok: false, error: `Please keep your question under ${MAX_QUESTION_CHARS} characters.` }); return; }

  // An attached file counts only when it is in this member's own folder of the support-files bucket.
  const requestedFile = String(req.body?.file_url ?? "");
  const ownFilePrefix = `${supabaseUrl}/storage/v1/object/public/support-files/${memberId}/`;
  const fileUrl = requestedFile.startsWith(ownFilePrefix) && requestedFile.length < 600 ? requestedFile : null;

  // 2. The member's name and tier from their profile.
  let memberName: string | null = null;
  let memberTier: string | null = null;
  try {
    const pRes = await sb(`profiles?id=eq.${memberId}&select=first_name,last_name,tier&limit=1`);
    const row = pRes.ok ? (await pRes.json())?.[0] : null;
    if (row) {
      memberName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || null;
      memberTier = row.tier ?? null;
    }
  } catch { /* the ticket is still saved with the email address */ }

  // 3. Three requests per hour per member.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recentRes = await sb(`support_requests?member_id=eq.${memberId}&created_at=gte.${since}&select=id`);
  const recent = recentRes.ok ? await recentRes.json() : [];
  if (Array.isArray(recent) && recent.length >= MAX_REQUESTS_PER_MEMBER_PER_HOUR) {
    res.status(429).json({ ok: false, error: "You have sent 3 requests in the last hour. Please try again a little later." });
    return;
  }

  // 4. Save the ticket.
  const subject = `Support Hub: ${category}`;
  const insert = await sb("support_requests", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      category,
      question: `Subject: ${subject}\n\n${question}`,
      status: "open",
      member_id: memberId,
      member_email: memberEmail,
      member_name: memberName ?? memberEmail,
      member_tier: memberTier ?? "free",
      file_url: fileUrl,
      source_address: SUPPORT_ADDRESS,
    }),
  });
  if (!insert.ok) {
    console.error(`[support-hub-submit] Ticket save failed: ${insert.status} ${await insert.text()}`);
    res.status(500).json({ ok: false, error: "Your request could not be saved. Please try again." });
    return;
  }
  const ticketId = (await insert.json())?.[0]?.id as string | undefined;
  if (!ticketId) { res.status(500).json({ ok: false, error: "Your request could not be saved. Please try again." }); return; }

  res.status(200).json({ ok: true, ticket_id: ticketId });

  // 5. Isaiah's instant reply and full draft, after the member has their answer.
  waitUntil(handleTicket({
    id: ticketId, ghlContactId: "", ghlMessageId: "",
    fromName: memberName, fromEmail: memberEmail, toAddress: SUPPORT_ADDRESS, subject, body: question,
    memberName, memberTier,
  }));
}
