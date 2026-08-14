// client/src/lib/brandCopy.ts
// Live-fetches brand wording (positioning, hooks, tagline) from the brand_copy
// Supabase table, so a single edit there updates every page that uses it.
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const BRAND_COPY_FALLBACK: Record<string, string> = {
  positioning: "EQ Meets AI: People-Centered Leadership, AI-Powered Insight",
};

export function useBrandCopy(key: string): string {
  const [value, setValue] = useState<string>(BRAND_COPY_FALLBACK[key] || "");

  useEffect(() => {
    let active = true;
    supabase
      .from("brand_copy")
      .select("value")
      .eq("key", key)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data?.value) setValue(data.value);
      });
    return () => {
      active = false;
    };
  }, [key]);

  return value;
}
