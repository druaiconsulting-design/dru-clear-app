// api/_lib/onDemandGuards.ts
// The same two safety gates twin-on-demand.ts uses before it starts an on-demand chain:
//   1. the one-chain-at-a-time lock (on_demand_lock, stale after 5 minutes)
//   2. the daily spend cap (daily_spend_cap, $10 a day, $0.15 reserved per chain)
// Support emails start a chain without a person typing in the Twin chat, so they pass
// through these same two gates before anything spends money.

const CHAIN_COST_ESTIMATE = 0.15;

function env(): { url: string; key: string } | null {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export async function acquireLock(lockedBy: string): Promise<boolean> {
  const e = env();
  if (!e) return false;
  const staleCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const res = await fetch(
    `${e.url}/rest/v1/on_demand_lock?id=eq.1&or=(is_locked.eq.false,locked_at.lt.${staleCutoff})`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", apikey: e.key, Authorization: `Bearer ${e.key}`, Prefer: "return=representation" },
      body: JSON.stringify({ is_locked: true, locked_at: new Date().toISOString(), locked_by: lockedBy }),
    }
  );
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

export async function releaseLock(): Promise<void> {
  const e = env();
  if (!e) return;
  await fetch(`${e.url}/rest/v1/on_demand_lock?id=eq.1`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", apikey: e.key, Authorization: `Bearer ${e.key}` },
    body: JSON.stringify({ is_locked: false, locked_by: null }),
  }).catch((err) => console.error("[onDemandGuards] releaseLock failed:", err));
}

// Tries for the lock a few times, since another chain may finish within a minute or two.
export async function acquireLockWithRetries(lockedBy: string, attempts: number, waitMs: number): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (await acquireLock(lockedBy)) return true;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, waitMs));
  }
  return false;
}

export async function checkAndReserveSpend(): Promise<{ ok: boolean; totalSpent?: number; cap?: number }> {
  const e = env();
  if (!e) return { ok: false };
  const today = new Date().toISOString().slice(0, 10);

  await fetch(`${e.url}/rest/v1/daily_spend_cap`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: e.key, Authorization: `Bearer ${e.key}`, Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify({ spend_date: today }),
  }).catch(() => {});

  const readRes = await fetch(`${e.url}/rest/v1/daily_spend_cap?spend_date=eq.${today}&select=total_spent,cap_amount`, {
    headers: { apikey: e.key, Authorization: `Bearer ${e.key}` },
  });
  if (!readRes.ok) return { ok: false };
  const rows = await readRes.json();
  const row = rows[0] ?? { total_spent: 0, cap_amount: 10.0 };

  if (Number(row.total_spent) + CHAIN_COST_ESTIMATE > Number(row.cap_amount)) {
    return { ok: false, totalSpent: Number(row.total_spent), cap: Number(row.cap_amount) };
  }

  await fetch(`${e.url}/rest/v1/daily_spend_cap?spend_date=eq.${today}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", apikey: e.key, Authorization: `Bearer ${e.key}` },
    body: JSON.stringify({ total_spent: Number(row.total_spent) + CHAIN_COST_ESTIMATE, updated_at: new Date().toISOString() }),
  });
  return { ok: true, totalSpent: Number(row.total_spent) + CHAIN_COST_ESTIMATE, cap: Number(row.cap_amount) };
}
