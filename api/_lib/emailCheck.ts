// api/_lib/emailCheck.ts
// The same four email checks the DRU CLEAR assessment uses (client/src/pages/DruClearAssessment/emailVerification.ts):
// the address looks like an email, a common typo gets a suggested fix, throwaway addresses are blocked, and the
// domain has a working mail server. The website chat asks this file, so the chat and the assessment share one set of rules.

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com","guerrillamail.com","guerrillamail.net","guerrillamail.org","tempmail.com","temp-mail.org","throwaway.email",
  "trashmail.com","trashmail.me","trashmail.net","dispostable.com","maildrop.cc","yopmail.com","yopmail.fr",
  "10minutemail.com","10minutemail.net","fakeinbox.com","fakemailgenerator.com","guerrillamailblock.com",
  "sharklasers.com","grr.la","spam4.me","spamgourmet.com","mohmal.com","mytemp.email","nada.email",
]);

const DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com","gmal.com": "gmail.com","gmai.com": "gmail.com","gmali.com": "gmail.com","gmaill.com": "gmail.com",
  "yahooo.com": "yahoo.com","yahho.com": "yahoo.com","yaho.com": "yahoo.com","yhaoo.com": "yahoo.com",
  "hotmial.com": "hotmail.com","hotmal.com": "hotmail.com","hotmai.com": "hotmail.com","hotmaill.com": "hotmail.com",
  "outlok.com": "outlook.com","outloo.com": "outlook.com","outloook.com": "outlook.com",
};

async function hasMailServer(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`, { headers: { Accept: "application/dns-json" } });
    if (!res.ok) return true;
    const data = await res.json();
    if (data.Status !== 0 || !Array.isArray(data.Answer) || data.Answer.length === 0) return false;
    return data.Answer.some((rec: { data: string }) => {
      const d = (rec.data || "").trim();
      return d !== "." && d !== "0 ." && !d.endsWith(" .");
    });
  } catch { return true; }
}

export type EmailCheckResult =
  | { valid: true; email: string }
  | { valid: false; reason: "empty" | "format" | "typo" | "disposable" | "no_mail_server"; suggestion?: string };

export async function checkEmail(raw: string): Promise<EmailCheckResult> {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!email) return { valid: false, reason: "empty" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { valid: false, reason: "format" };
  const [local, domain] = email.split("@");
  if (DOMAIN_TYPOS[domain]) return { valid: false, reason: "typo", suggestion: `${local}@${DOMAIN_TYPOS[domain]}` };
  if (DISPOSABLE_DOMAINS.has(domain)) return { valid: false, reason: "disposable" };
  if (!(await hasMailServer(domain))) return { valid: false, reason: "no_mail_server" };
  return { valid: true, email };
}
