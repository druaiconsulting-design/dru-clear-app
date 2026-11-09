import { useEffect, useState } from "react";
import { callApi } from "../../lib/adminApi";
import { input, label, small, type Agent } from "./ui";

// The writer pick-list: your agents (grouped by division), then Claude, then ChatGPT. Nothing is preselected.
// Value is 'agent:<slug>', 'claude' or 'chatgpt'.
let cache: Agent[] | null = null;

export default function WriterPicker({ id, value, onChange, disabled }: { id: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [agents, setAgents] = useState<Agent[]>(cache || []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    callApi("/api/hub-studio?view=writers").then(r => {
      if (r.ok) { cache = r.body.agents as Agent[]; setAgents(cache); }
      else setError(r.body?.error || `The agents could not be loaded (${r.status}).`);
    });
  }, []);

  const divisions: string[] = [];
  for (const a of agents) if (!divisions.includes(a.division)) divisions.push(a.division);

  return (
    <div>
      <label htmlFor={id} style={label}>Writer</label>
      <select id={id} value={value} disabled={disabled} onChange={e => onChange(e.target.value)} style={input}>
        <option value="">Choose a writer…</option>
        {divisions.map(d => (
          <optgroup key={d} label={d}>
            {agents.filter(a => a.division === d).map(a => (
              <option key={a.slug} value={`agent:${a.slug}`}>{a.name} — {a.role}</option>
            ))}
          </optgroup>
        ))}
        <optgroup label="Plain AI">
          <option value="claude">Claude</option>
          <option value="chatgpt">ChatGPT</option>
        </optgroup>
      </select>
      {error && <p role="alert" style={{ ...small, color: "#B3261E", marginTop: 4 }}>{error}</p>}
      {value === "chatgpt" && <p style={{ ...small, marginTop: 4 }}>ChatGPT writing uses the OpenAI API account, which needs its own funds (separate from the ChatGPT subscription).</p>}
    </div>
  );
}
