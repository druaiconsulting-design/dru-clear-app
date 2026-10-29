import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// Approvals card for one client's Strategic AI Insight Report.
// It shows who the report is for and opens the review page. The generic Client Delivery PDF flow does not apply here.

type Props = {
  approval: { id: string; created_at: string; context: string | null; task_brief: string; agent_name: string; agent_role: string; priority: string };
  photo?: string;
};

function longDate(iso?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return "";
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" });
}

export default function SdReportCard({ approval, photo }: Props) {
  const token = approval.context ?? "";
  const [info, setInfo] = useState<{ name: string; badge: string; date: string; status: string; sent_at: string | null; tier: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!token) return;
      const { data } = await supabase.rpc("admin_sd_report", { p_token: token });
      if (!alive || !data) return;
      const d = data as any;
      setInfo({
        name: [d.first_name, d.last_name].filter(Boolean).join(" ") || d.email,
        badge: d.numbers?.badge ?? "",
        date: longDate(d.numbers?.report_date),
        status: d.status,
        sent_at: d.sent_at,
        tier: d.tier ?? "",
      });
    })();
    return () => { alive = false; };
  }, [token]);

  // An Executive report (tier "executive") opens its own 21-page review page; a Strategic report opens the 16-page one.
  const isEd = info ? info.tier === "executive" : approval.task_brief.startsWith("Executive AI Alignment Report");
  const reviewPath = isEd ? "/admin-ed-report" : "/admin-report";
  const label = { fontFamily: "'Montserrat', sans-serif", color: "rgba(212,175,55,0.8)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "0.25rem" };
  const value = { fontFamily: "'Inter', sans-serif", color: "#0A2342", fontSize: "0.85rem", margin: 0 };
  const statusText = info?.status === "sent" ? "Sent to client" : info?.status === "insight_written" ? "Ready for your review" : info?.status === "approved" || info?.status === "report_built" ? "Approved, not yet sent" : info?.status ?? "";

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(212,175,55,0.25)", background: "#FFFFFF" }}>
      <div style={{ background: "#071A2E", padding: "0.65rem 1rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        {photo && <img src={photo} alt={approval.agent_name} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(212,175,55,0.5)" }} />}
        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.58rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#A68920", color: "#FFFFFF" }}>{isEd ? "ED Report" : "SD Report"}</span>
        <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(212,175,55,0.8)", fontSize: "0.62rem" }}>{approval.agent_name} · {approval.agent_role}</span>
      </div>
      <div style={{ padding: "1rem", display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
        <div><p style={label}>Client</p><p style={value}>{info?.name ?? approval.task_brief.replace("Strategic AI Insight Report for ", "").replace("Executive AI Alignment Report for ", "")}</p></div>
        <div><p style={label}>{isEd ? "ED tier" : "SD tier"}</p><p style={value}>{info?.badge ? info.badge.charAt(0) + info.badge.slice(1).toLowerCase() : "—"}</p></div>
        <div><p style={label}>Date</p><p style={value}>{info?.date || new Date(approval.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p></div>
        <div><p style={label}>Status</p><p style={value}>{statusText || "—"}</p></div>
        <a href={`${reviewPath}?token=${encodeURIComponent(token)}`} target="_blank" rel="noopener noreferrer"
          style={{ marginLeft: "auto", fontFamily: "'Montserrat', sans-serif", fontSize: "0.7rem", fontWeight: 700, padding: "0.6rem 1.25rem", borderRadius: 6, background: "#D4AF37", color: "#0A2342", letterSpacing: "0.06em", textDecoration: "none" }}>
          Open report
        </a>
      </div>
    </div>
  );
}
