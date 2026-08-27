// DRU AI Leadership Ecosystem™ — api/cost-summary.ts
// Aggregates real Anthropic API spend from model_usage_log (written by every
// agent trigger file's callAnthropic helper) into the numbers DeAnna actually
// wants to see: today, this week, this month, and a by-model / by-source
// breakdown. Read-only — never writes.

export const config = { maxDuration: 30 };

interface UsageRow {
  source_file: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
}

async function fetchSince(isoDate: string): Promise<UsageRow[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const res = await fetch(
    `${url}/rest/v1/model_usage_log?created_at=gte.${encodeURIComponent(isoDate)}&select=source_file,model,input_tokens,output_tokens,cost_usd,created_at`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) return [];
  return (await res.json()) as UsageRow[];
}

function summarize(rows: UsageRow[]) {
  const totalCost = rows.reduce((sum, r) => sum + Number(r.cost_usd), 0);
  const totalCalls = rows.length;
  const byModel: Record<string, { calls: number; cost_usd: number }> = {};
  const bySourceFile: Record<string, { calls: number; cost_usd: number }> = {};
  for (const r of rows) {
    byModel[r.model] ??= { calls: 0, cost_usd: 0 };
    byModel[r.model].calls += 1;
    byModel[r.model].cost_usd += Number(r.cost_usd);
    bySourceFile[r.source_file] ??= { calls: 0, cost_usd: 0 };
    bySourceFile[r.source_file].calls += 1;
    bySourceFile[r.source_file].cost_usd += Number(r.cost_usd);
  }
  const round = (n: number) => Math.round(n * 1_000_000) / 1_000_000;
  for (const k of Object.keys(byModel)) byModel[k].cost_usd = round(byModel[k].cost_usd);
  for (const k of Object.keys(bySourceFile)) bySourceFile[k].cost_usd = round(bySourceFile[k].cost_usd);
  return { total_cost_usd: round(totalCost), total_calls: totalCalls, by_model: byModel, by_source_file: bySourceFile };
}

export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setUTCHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfToday); startOfWeek.setUTCDate(startOfWeek.getUTCDate() - 7);
    const startOfMonth = new Date(startOfToday); startOfMonth.setUTCDate(startOfMonth.getUTCDate() - 30);

    // One fetch covering the widest window, then slice in memory —
    // cheaper than three separate Supabase round trips.
    const monthRows = await fetchSince(startOfMonth.toISOString());
    const todayRows = monthRows.filter(r => new Date(r.created_at) >= startOfToday);
    const weekRows  = monthRows.filter(r => new Date(r.created_at) >= startOfWeek);

    res.status(200).json({
      success: true,
      generated_at: now.toISOString(),
      today: summarize(todayRows),
      last_7_days: summarize(weekRows),
      last_30_days: summarize(monthRows),
    });
  } catch (error) {
    console.error('[cost-summary] Error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
}
