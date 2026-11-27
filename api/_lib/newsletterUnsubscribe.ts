// api/_lib/newsletterUnsubscribe.ts
// Shared pieces for the newsletter unsubscribe link (Nov 26, 2026).
//
// GHL fills in its own unsubscribe link for bulk email, workflows and campaigns, but leaves it blank
// for one-to-one messages sent through the Conversations API — which is how every newsletter and
// Jaylen email leaves this app. So the app makes its own link. Each link carries the person's email
// address plus a signed code that only this app can produce, so nobody can unsubscribe someone else
// by editing the address in the link.

import { createHmac, timingSafeEqual } from 'crypto';

const APP_ORIGIN = 'https://app.druaiconsulting.com';

function signingKey(): string {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return createHmac('sha256', 'newsletter-unsubscribe').update(base).digest('hex');
}

export function unsubscribeCode(email: string): string {
  return createHmac('sha256', signingKey()).update(email.trim().toLowerCase()).digest('hex');
}

export function isValidUnsubscribeCode(email: string, code: string): boolean {
  if (!email || !code) return false;
  const expected = Buffer.from(unsubscribeCode(email), 'hex');
  let given: Buffer;
  try { given = Buffer.from(code, 'hex'); } catch { return false; }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function unsubscribeUrl(email: string): string {
  const e = email.trim().toLowerCase();
  return `${APP_ORIGIN}/api/newsletter-unsubscribe?e=${encodeURIComponent(e)}&t=${unsubscribeCode(e)}`;
}
