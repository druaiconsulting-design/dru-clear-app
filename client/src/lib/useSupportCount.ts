import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// The number on the Support Tickets menu item: every support@ / info@ email and Support Hub ticket still waiting on DeAnna.
// That is each Support Reply card not yet approved or rejected, plus each ticket with no reply drafted.
export async function fetchSupportWaitingCount(): Promise<number> {
  const [cards, open] = await Promise.all([
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("category", "support_reply").eq("status", "pending"),
    supabase.from("support_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  if (cards.error || open.error) return 0;
  return (cards.count ?? 0) + (open.count ?? 0);
}

export const SUPPORT_COUNT_REFRESH_MS = 30000;

export function useSupportCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const n = await fetchSupportWaitingCount().catch(() => 0);
      if (alive) setCount(n);
    };
    load();
    const timer = window.setInterval(load, SUPPORT_COUNT_REFRESH_MS);
    const onRefresh = () => { load(); };
    window.addEventListener("support-tickets-changed", onRefresh);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener("support-tickets-changed", onRefresh); };
  }, []);
  return count;
}
