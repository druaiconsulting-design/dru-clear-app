// The Finish step's film maker. It runs in the browser: the approved clips play in order on a canvas, each scene's recording and the music
// play through the browser's audio, and (when rendering) the canvas and the audio are recorded into one MP4 (WebM where the browser cannot make MP4).
// With record off it is the free preview: the same thing plays on screen and nothing is saved.

export interface Seg {
  sceneId: string; position: number; clipUrl: string; inS: number; outS: number;
  audioUrl: string | null; audioSeconds: number | null; lines: { speaker: string; text: string }[];
}
export interface EndCard { on: boolean; cta: string; website: string; seconds: number; logoUrl: string | null }
export interface Plan { segs: Seg[]; musicUrl: string | null; width: number; height: number; fps: number; endcard: EndCard; captions: boolean }
export interface Cue { start: number; end: number; text: string }

export const MUSIC_VOLUME = 0.25;

export const segDur = (s: Seg) => Math.max(0.1, s.outS - s.inS);
export function segStarts(segs: Seg[]): number[] {
  const out: number[] = [];
  segs.reduce((t, s) => { out.push(t); return t + segDur(s); }, 0);
  return out;
}
export const totalOf = (segs: Seg[]) => segs.reduce((t, s) => t + segDur(s), 0);

// Output size from the shape text ("Vertical 9:16 (phones)", "1:1", "16:9"). Clips are made at 720p, so the short side is 720.
export function sizeFor(shape: string): { width: number; height: number } | null {
  if (/9\s*:\s*16/.test(shape)) return { width: 720, height: 1280 };
  if (/16\s*:\s*9/.test(shape)) return { width: 1280, height: 720 };
  if (/1\s*:\s*1/.test(shape)) return { width: 720, height: 720 };
  return null;
}

// Captions: each scene's spoken lines share the length of that scene's recording, in proportion to how many characters each line has.
export function buildCues(segs: Seg[]): Cue[] {
  const starts = segStarts(segs);
  const cues: Cue[] = [];
  segs.forEach((s, i) => {
    if (!s.lines.length || !s.audioUrl) return;
    const span = Math.min(segDur(s), s.audioSeconds ?? segDur(s));
    const chars = s.lines.reduce((n, l) => n + l.text.length, 0) || 1;
    let t = starts[i];
    for (const l of s.lines) {
      const d = span * (l.text.length / chars);
      cues.push({ start: t, end: t + d, text: l.text });
      t += d;
    }
  });
  return cues;
}

const stamp = (sec: number) => {
  const ms = Math.round(sec * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor((ms % 3600000) / 60000))}:${p(Math.floor((ms % 60000) / 1000))},${p(ms % 1000, 3)}`;
};
export const toSrt = (cues: Cue[]) => cues.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join("\n");

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous"; v.muted = true; v.playsInline = true; v.preload = "auto";
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("A clip could not be loaded into the browser."));
    v.src = url;
  });
}
function seekTo(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise(resolve => {
    if (Math.abs(v.currentTime - t) < 0.02 && v.readyState >= 2) { resolve(); return; }
    const done = () => { v.removeEventListener("seeked", done); resolve(); };
    v.addEventListener("seeked", done);
    v.currentTime = t;
  });
}
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = url;
  });
}
async function decode(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`A recording could not be loaded (${r.status}).`);
  return ctx.decodeAudioData(await r.arrayBuffer());
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawCover(c: CanvasRenderingContext2D, v: HTMLVideoElement, W: number, H: number) {
  const vw = v.videoWidth || W, vh = v.videoHeight || H;
  const scale = Math.max(W / vw, H / vh);
  const w = vw * scale, h = vh * scale;
  c.drawImage(v, (W - w) / 2, (H - h) / 2, w, h);
}

function drawCaption(c: CanvasRenderingContext2D, text: string, W: number, H: number) {
  const size = Math.round(H * (W > H ? 0.06 : 0.036));
  c.font = `700 ${size}px Inter, Arial, sans-serif`;
  c.textAlign = "center"; c.textBaseline = "alphabetic"; c.lineJoin = "round";
  const lines = wrap(c, text, W * 0.86);
  const lh = size * 1.28;
  let y = H * 0.86 - (lines.length - 1) * lh;
  for (const ln of lines) {
    c.lineWidth = size * 0.28; c.strokeStyle = "rgba(0,0,0,0.9)"; c.strokeText(ln, W / 2, y);
    c.fillStyle = "#FFFFFF"; c.fillText(ln, W / 2, y);
    y += lh;
  }
}

function drawEndCard(c: CanvasRenderingContext2D, e: EndCard, logo: HTMLImageElement | null, alpha: number, W: number, H: number) {
  c.save();
  c.globalAlpha = alpha * 0.82; c.fillStyle = "#0A2342"; c.fillRect(0, 0, W, H);
  c.globalAlpha = alpha; c.textAlign = "center"; c.textBaseline = "alphabetic";
  let y = H * 0.2;
  if (logo) {
    const maxW = W * 0.5, maxH = H * 0.3;
    const s = Math.min(maxW / logo.width, maxH / logo.height);
    const w = logo.width * s, h = logo.height * s;
    c.drawImage(logo, (W - w) / 2, y, w, h);
    y += h + H * 0.06;
  } else y = H * 0.38;
  if (e.cta) {
    const size = Math.round(H * (W > H ? 0.075 : 0.042));
    c.font = `700 ${size}px "Playfair Display", Georgia, serif`; c.fillStyle = "#FFFFFF";
    const lines = wrap(c, e.cta, W * 0.82);
    for (const ln of lines) { y += size * 1.25; c.fillText(ln, W / 2, y); }
    y += size * 0.4;
  }
  if (e.website) {
    const size = Math.round(H * (W > H ? 0.06 : 0.034));
    c.font = `600 ${size}px Inter, Arial, sans-serif`; c.fillStyle = "#D4AF37";
    y += size * 1.4; c.fillText(e.website, W / 2, y);
  }
  c.restore();
}

export function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const list = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return list.find(m => MediaRecorder.isTypeSupported(m)) || null;
}

// WebM files from MediaRecorder often report no length until they are scanned to the end, so ask for a far position first.
export function measureDuration(blob: Blob): Promise<number> {
  return new Promise(resolve => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(blob);
    const finish = (d: number) => { URL.revokeObjectURL(url); resolve(Number.isFinite(d) ? d : 0); };
    v.preload = "metadata";
    v.onerror = () => finish(0);
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration) && v.duration > 0) { finish(v.duration); return; }
      v.ontimeupdate = () => { if (Number.isFinite(v.duration)) { v.ontimeupdate = null; finish(v.duration); } };
      v.currentTime = 1e7;
    };
    v.src = url;
  });
}

export interface RunOptions { record: boolean; onProgress?: (t: number, total: number) => void; signal?: AbortSignal; onStage?: (text: string) => void }
export interface RunResult { blob: Blob | null; mime: string | null; seconds: number }

export async function runFilm(plan: Plan, canvas: HTMLCanvasElement, opts: RunOptions): Promise<RunResult> {
  const { segs, width: W, height: H, fps } = plan;
  if (!segs.length) throw new Error("There are no clips to put together.");
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("This browser could not start the picture canvas.");
  const starts = segStarts(segs), total = totalOf(segs);
  const cues = plan.captions ? buildCues(segs) : [];

  const mime = opts.record ? pickRecorderMime() : null;
  if (opts.record && !mime) throw new Error("This browser cannot record video. Use Chrome, Edge or Safari.");

  opts.onStage?.("Loading the clips and recordings…");
  const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
  const actx = new AC();
  const cleanup: (() => void)[] = [() => { actx.close().catch(() => {}); }];
  try {
    const [videos, buffers, music, logo] = await Promise.all([
      Promise.all(segs.map(s => loadVideo(s.clipUrl))),
      Promise.all(segs.map(s => (s.audioUrl ? decode(actx, s.audioUrl) : Promise.resolve(null)))),
      plan.musicUrl ? decode(actx, plan.musicUrl) : Promise.resolve(null),
      plan.endcard.on && plan.endcard.logoUrl ? loadImage(plan.endcard.logoUrl) : Promise.resolve(null),
    ]);
    await Promise.all(videos.map((v, i) => seekTo(v, segs[i].inS)));
    // A canvas that has drawn a clip from another web address is blocked from being recorded unless the address allows it.
    try { c.drawImage(videos[0], 0, 0, 2, 2); c.getImageData(0, 0, 1, 1); } catch { throw new Error("The browser blocked reading the clips for recording. Reload the page and try again."); }

    const dest = opts.record ? actx.createMediaStreamDestination() : null;
    const sink: AudioNode = dest ?? actx.destination;
    let recorder: MediaRecorder | null = null;
    const chunks: Blob[] = [];
    if (opts.record && dest && mime) {
      const stream = canvas.captureStream(fps);
      dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 128_000 });
      recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    }

    await actx.resume();
    opts.onStage?.(opts.record ? "Putting the film together. Keep this tab open." : "Playing…");
    const startAt = actx.currentTime + 0.6;
    const sources: AudioScheduledSourceNode[] = [];
    segs.forEach((s, i) => {
      const buf = buffers[i];
      if (!buf) return;
      const src = actx.createBufferSource(); src.buffer = buf; src.connect(sink);
      src.start(startAt + starts[i]); src.stop(startAt + starts[i] + segDur(s));
      sources.push(src);
    });
    if (music) {
      const g = actx.createGain(); g.gain.value = MUSIC_VOLUME; g.connect(sink);
      const src = actx.createBufferSource(); src.buffer = music; src.connect(g);
      src.start(startAt); src.stop(startAt + total);
      sources.push(src);
    }
    cleanup.push(() => { try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch { /* already stopped */ } });
    cleanup.push(() => { sources.forEach(s => { try { s.stop(); } catch { /* already stopped */ } }); videos.forEach(v => v.pause()); });

    // The recorder starts at film time 0, so the finished film has no lead-in before the first scene.
    let recording = false;
    let current = -1;
    const result = await new Promise<RunResult>((resolve, reject) => {
      const frame = () => {
        if (opts.signal?.aborted) { reject(new Error("Stopped.")); return; }
        const t = actx.currentTime - startAt;
        if (!recording && t >= 0) { recording = true; recorder?.start(500); }
        const tt = Math.max(0, Math.min(t, total - 0.001));
        let idx = 0;
        for (let i = 0; i < segs.length; i++) if (tt >= starts[i]) idx = i;
        if (idx !== current) {
          if (current >= 0) videos[current].pause();
          current = idx;
          const v = videos[idx];
          v.currentTime = segs[idx].inS;
          v.play().catch(() => {});
        }
        c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
        const v = videos[idx];
        if (v.readyState >= 2) drawCover(c, v, W, H);
        const cue = cues.find(q => tt >= q.start && tt < q.end);
        if (cue) drawCaption(c, cue.text, W, H);
        if (plan.endcard.on && (plan.endcard.cta || plan.endcard.website || logo)) {
          const into = tt - (total - plan.endcard.seconds);
          if (into > 0) drawEndCard(c, plan.endcard, logo, Math.min(1, into / 0.4), W, H);
        }
        opts.onProgress?.(Math.max(0, tt), total);
        if (t >= total) {
          if (!recorder) { resolve({ blob: null, mime: null, seconds: total }); return; }
          recorder.onstop = () => resolve({ blob: new Blob(chunks, { type: mime!.split(";")[0] }), mime: mime!.split(";")[0], seconds: total });
          recorder.stop();
          return;
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    return result;
  } finally {
    cleanup.reverse().forEach(f => f());
  }
}
