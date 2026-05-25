const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com","guerrillamail.com","guerrillamail.net","guerrillamail.org","tempmail.com","temp-mail.org","throwaway.email",
  "trashmail.com","trashmail.me","trashmail.net","dispostable.com","maildrop.cc","yopmail.com","yopmail.fr",
  "10minutemail.com","10minutemail.net","fakeinbox.com","fakemailgenerator.com","guerrillamailblock.com",
  "sharklasers.com","grr.la","spam4.me","spamgourmet.com","mohmal.com","mytemp.email","nada.email",
  "gmial.com","gmal.com","gmai.com","gmali.com","gmaill.com","yahooo.com","yahho.com","yaho.com",
  "hotmial.com","hotmal.com","hotmai.com","outlok.com","outloo.com",
]);

const DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com","gmal.com": "gmail.com","gmai.com": "gmail.com","gmali.com": "gmail.com","gmaill.com": "gmail.com",
  "yahooo.com": "yahoo.com","yahho.com": "yahoo.com","yaho.com": "yahoo.com","yhaoo.com": "yahoo.com",
  "hotmial.com": "hotmail.com","hotmal.com": "hotmail.com","hotmai.com": "hotmail.com","hotmaill.com": "hotmail.com",
  "outlok.com": "outlook.com","outloo.com": "outlook.com","outloook.com": "outlook.com",
};

async function checkMxRecord(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`, {
      headers: { Accept: "application/dns-json" },
    });
    if (!res.ok) return true;
    const data = await res.json();
    if (data.Status !== 0 || !Array.isArray(data.Answer) || data.Answer.length === 0) return false;
    return data.Answer.some((rec: { data: string }) => {
      const d = (rec.data || "").trim();
      return d !== "." && d !== "0 ." && !d.endsWith(" .");
    });
  } catch { return true; }
}

export async function verifyEmail(email: string): Promise<{ valid: boolean; error: string; suggestion?: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { valid: false, error: "Required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { valid: false, error: "Please enter a valid email address" };
  const domain = trimmed.split("@")[1];
  if (DOMAIN_TYPOS[domain]) return {
    valid: false,
    error: `Did you mean ${trimmed.split("@")[0]}@${DOMAIN_TYPOS[domain]}?`,
    suggestion: `${trimmed.split("@")[0]}@${DOMAIN_TYPOS[domain]}`,
  };
  if (DISPOSABLE_DOMAINS.has(domain)) return {
    valid: false,
    error: "Disposable email addresses are not accepted. Please use your work or personal email.",
  };
  const hasMx = await checkMxRecord(domain);
  if (!hasMx) return { valid: false, error: `No mail server found for "${domain}". Please check your email address.` };
  return { valid: true, error: "" };
}
