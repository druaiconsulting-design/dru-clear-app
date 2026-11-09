import { useCallback, useEffect, useRef, useState } from "react";
import { callApi } from "../../lib/adminApi";
import { btn, card, chip, fmtTime, h2, small } from "./ui";

// Free film preview: plays the approved frames in order, each scene's approved recording, and the approved music in the browser.
// It makes no API calls and costs nothing.
interface PScene { id: string; position: number; length_s: number; frame_url: string | null; audio_url: string | null; audio_seconds: number | null; has_lines: boolean }

export default function PreviewFilm({ projectId, ratio }: { projectId: string; ratio: string }) {
  const [scenes, setScenes] = useState<PScene[] | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const voice = useRef<HTMLAudioElement | null>(null);
  const music = useRef<HTMLAudioElement | null>(null);
  const raf = useRef<number | null>(null);
  const clock = useRef({ base: 0, startedAt: 0 });
  const current = useRef(-1);

  useEffect(() => {
    callApi(`/api/hub-studio-audio?view=preview&id=${projectId}`).then(r => {
      if (r.ok) { setScenes(r.body.scenes as PScene[]); setMusicUrl((r.body.music_url as string) || null); }
      else setError(r.body?.error || `The preview could not be loaded (${r.status}).`);
    });
  }, [projectId]);

  const starts = (scenes || []).reduce<number[]>((acc, s, i) => { acc.push(i === 0 ? 0 : acc[i - 1] + (scenes as PScene[])[i - 1].length_s); return acc; }, []);
  const total = scenes && scenes.length ? starts[scenes.length - 1] + scenes[scenes.length - 1].length_s : 0;
  const indexAt = useCallback((time: number) => {
    if (!scenes) return 0;
    let idx = 0;
    for (let i = 0; i < scenes.length; i++) if (time >= starts[i]) idx = i;
    return idx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes]);

  const stopAudio = () => { voice.current?.pause(); music.current?.pause(); };

  // Puts the voice and music at `time`; plays them when `play` is true.
  const place = useCallback((time: number, play: boolean) => {
    if (!scenes) return;
    const i = indexAt(time);
    current.current = i;
    const sc = scenes[i];
    if (!voice.current) voice.current = new Audio();
    const v = voice.current;
    if (sc.audio_url) {
      if (v.src !== sc.audio_url) v.src = sc.audio_url;
      const off = Math.max(0, time - starts[i]);
      try { v.currentTime = off; } catch { /* not loaded yet */ }
      if (play && off < (sc.audio_seconds ?? 1e9)) v.play().catch(() => {}); else v.pause();
    } else v.pause();
    if (musicUrl) {
      if (!music.current) { music.current = new Audio(musicUrl); music.current.volume = 0.25; }
      try { music.current.currentTime = time; } catch { /* not loaded yet */ }
      if (play) music.current.play().catch(() => {}); else music.current.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, musicUrl, indexAt]);

  const tick = useCallback(() => {
    const now = clock.current.base + (performance.now() - clock.current.startedAt) / 1000;
    if (now >= total) { stopAudio(); setPlaying(false); setT(0); current.current = -1; return; }
    setT(now);
    if (indexAt(now) !== current.current) place(now, true);
    raf.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, indexAt, place]);

  function play() {
    if (!scenes || !total) return;
    const from = t >= total ? 0 : t;
    clock.current = { base: from, startedAt: performance.now() };
    place(from, true);
    setPlaying(true);
    raf.current = requestAnimationFrame(tick);
  }
  function pause() {
    if (raf.current) cancelAnimationFrame(raf.current);
    stopAudio();
    setPlaying(false);
  }
  function seek(time: number) {
    const clamped = Math.min(Math.max(0, time), Math.max(0, total - 0.01));
    setT(clamped);
    clock.current = { base: clamped, startedAt: performance.now() };
    place(clamped, playing);
  }
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); voice.current?.pause(); music.current?.pause(); }, []);

  if (error) return <p role="alert" style={{ ...small, color: "#B3261E" }}>{error}</p>;
  if (!scenes) return <p style={small}>Loading the preview…</p>;
  if (!scenes.length) return <p style={small}>No scenes yet. Write the script first.</p>;

  const idx = indexAt(t);
  const sc = scenes[idx];
  const noFrame = scenes.filter(s => !s.frame_url).length;
  const noVoice = scenes.filter(s => s.has_lines && !s.audio_url).length;
  const tooLong = scenes.filter(s => s.audio_seconds !== null && s.audio_seconds > s.length_s + 0.5);

  return (
    <div style={card}>
      <h2 style={{ ...h2, fontSize: "1.1rem" }}>Preview film</h2>
      <p style={{ ...small, marginBottom: "0.8rem" }}>Free. This plays your approved frames, approved recordings{musicUrl ? " and approved music" : ""} in the browser. Nothing is made or billed.</p>
      <div style={{ maxWidth: 420, margin: "0 auto 0.8rem" }}>
        {sc.frame_url ? (
          <img src={sc.frame_url} alt={`Scene ${sc.position}`} style={{ width: "100%", aspectRatio: ratio, objectFit: "cover", borderRadius: 8, display: "block" }} />
        ) : (
          <div role="img" aria-label={`Scene ${sc.position}: no approved frame yet`} style={{ width: "100%", aspectRatio: ratio, borderRadius: 8, background: "rgba(10,35,66,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={small}>Scene {sc.position}: no approved frame yet</span>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
        <button style={btn(true)} onClick={playing ? pause : play}>{playing ? "❚❚ Pause" : "▶ Play"}</button>
        <input type="range" aria-label="Position in the film" min={0} max={Math.max(1, Math.round(total * 10))} value={Math.round(t * 10)} onChange={e => seek(Number(e.target.value) / 10)} style={{ flex: 1 }} />
        <span style={small}>{fmtTime(Math.floor(t))} / {fmtTime(total)}</span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {scenes.map((s, i) => <button key={s.id} style={chip(i === idx)} onClick={() => seek(starts[i])}>Scene {s.position}</button>)}
      </div>
      {(noFrame > 0 || noVoice > 0 || tooLong.length > 0) && (
        <ul style={{ ...small, margin: 0, paddingLeft: "1.1rem" }}>
          {noFrame > 0 && <li>{noFrame} {noFrame === 1 ? "scene has" : "scenes have"} no approved frame yet.</li>}
          {noVoice > 0 && <li>{noVoice} {noVoice === 1 ? "scene has" : "scenes have"} spoken lines but no approved recording, so {noVoice === 1 ? "it plays" : "they play"} silent.</li>}
          {tooLong.map(s => <li key={s.id} style={{ color: "#B3261E" }}>Scene {s.position}: the recording (about {s.audio_seconds} s) is longer than the scene ({s.length_s} s) and is cut at the scene change.</li>)}
        </ul>
      )}
    </div>
  );
}
