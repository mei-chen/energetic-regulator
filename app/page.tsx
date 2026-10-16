"use client";
import { useEffect, useRef, useState } from "react";
import { Binaural } from "@/lib/audio";
import { FaceReader, type FaceState } from "@/lib/face";
import type { PassageT } from "./api/passage/route";

type Kind = "open" | "deepen" | "steady";

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const youRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const sideRefs = useRef<(HTMLElement | null)[]>([null, null, null, null]);   // left mark, left value, right mark, right value
  const sidePos = (hz: number) => `${(1 - (Math.log(hz) - Math.log(150)) / (Math.log(700) - Math.log(150))) * 100}%`;
  const [begun, setBegun] = useState(false);
  const [caption, setCaption] = useState("");
  const [captionOn, setCaptionOn] = useState(false);
  const [faceLive, setFaceLive] = useState(false);
  const [youCorner, setYouCorner] = useState(false);
  const [flip, setFlip] = useState(false);   // tap the circle to flip it; cameras differ in whether they mirror
  useEffect(() => { try { setFlip(localStorage.getItem("flip") === "1"); } catch {} }, []);
  const toggleFlip = () => setFlip((f) => { try { localStorage.setItem("flip", f ? "0" : "1"); } catch {} return !f; });
  const [readout, setReadout] = useState("4.50");
  const [phase, setPhase] = useState("");
  const [weather, setWeather] = useState("");

  // Everything that runs per frame lives in refs so the loop never re-subscribes.
  const R = useRef({
    audio: new Binaural(), face: null as FaceReader | null, faceState: { present: false, calibrated: false, ease: 0.5, trend: 0, eyesClosed: false, closedSeconds: 0, blinkRate: 0, stillness: 1, breath: 0, breathing: false } as FaceState,
    hue: 350, passage: 0, passageAt: 0, startedAt: 0, passageBeat: 4.5, lastTune: 0, lastKind: "open" as Kind,
    whispers: [] as string[], spoken: [] as string[], whisperIdx: 0, whisperTimer: 0 as ReturnType<typeof setTimeout> | 0,
    affirmations: [] as string[], affIdx: 0, floatTimer: 0 as ReturnType<typeof setTimeout> | 0,
    planning: false, deepSince: 0, tenseSince: 0, faceLive: false, faceLiveAt: 0, cornered: false, setYouCorner: (v: boolean) => {}, setWeather: (w: string) => {}, running: false,
    show: (t: string, ms: number) => {}, setPhase: (p: string) => {},
  });
  R.current.show = (t, ms) => { setCaption(t); setCaptionOn(true); setTimeout(() => setCaptionOn(false), ms); };
  R.current.setPhase = setPhase;
  R.current.setWeather = setWeather;
  R.current.setYouCorner = setYouCorner;

  // ----- whispers: paced by the page, shown beneath the orb -----
  function startWhispering() {
    const r = R.current; clearTimeout(r.whisperTimer);
    const tick = () => {
      if (!r.running || !r.whispers.length) return;
      r.show(r.whispers[r.whisperIdx++ % r.whispers.length], 6500);
      r.whisperTimer = setTimeout(tick, 13000 + Math.random() * 9000);
    };
    r.whisperTimer = setTimeout(tick, 7000);
  }

  // ----- affirmations: faint, rising through the background -----
  function startFloating() {
    const r = R.current; clearTimeout(r.floatTimer);
    const tick = () => {
      if (!r.running) return;
      const host = floatRef.current;
      if (host && r.affirmations.length) {
        const el = document.createElement("span");
        el.textContent = r.affirmations[r.affIdx++ % r.affirmations.length];
        el.style.left = `${8 + Math.random() * 74}vw`; el.style.top = `${40 + Math.random() * 45}vh`;
        el.style.animationDuration = `${26 + Math.random() * 12}s`;
        el.addEventListener("animationend", () => el.remove());
        host.appendChild(el);
      }
      r.floatTimer = setTimeout(tick, 5000 + Math.random() * 4000);
    };
    r.floatTimer = setTimeout(tick, 3000);
  }

  // ----- Oriel plans a passage -----
  async function plan(kind: Kind) {
    const r = R.current; if (r.planning || !r.running) return;
    r.planning = true; r.lastKind = kind;
    try {
      const t = r.audio.targets;
      const res = await fetch("/api/passage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        kind, minutes: Math.round((Date.now() - r.startedAt) / 60000), passage: r.passage, ease: r.faceState.ease, trend: r.faceState.trend, eyesClosed: r.faceState.eyesClosed, closedSeconds: Math.round(r.faceState.closedSeconds), blinkRate: r.faceState.blinkRate, stillness: r.faceState.stillness, calibrated: r.faceState.calibrated, present: r.faceState.present,
        carrierHz: t.carrier, beatHz: r.passageBeat, alreadyWhispered: r.spoken.slice(-30) }) });
      if (!res.ok) throw new Error(String(res.status));
      const p = (await res.json()) as PassageT;
      if (!r.running) return;
      r.passage++; r.passageAt = Date.now(); r.passageBeat = Math.min(7, Math.max(2, p.beatHz));
      r.hue = ((p.hue % 360) + 360) % 360;
      r.audio.tune(Math.min(963, Math.max(174, p.carrierHz)), r.passageBeat, 45);
      const short = p.whispers.filter((w) => w.trim().split(/\s+/).length <= 5);   // the type is huge: keep only what fits in a breath
      r.whispers = short.length >= 4 ? short : p.whispers; r.whisperIdx = 0; r.spoken.push(...p.whispers);
      r.affirmations = p.affirmations.filter((w) => w.trim().split(/\s+/).length <= 7); r.affIdx = 0; r.spoken.push(...p.affirmations);
      if (r.passage === 1) startFloating();
      r.setPhase(p.phase.toLowerCase());
      const hold = r.passage === 1 ? 10500 - (Date.now() - r.startedAt) : 0;     // let the first instruction be read
      if (hold > 0) await new Promise((res) => setTimeout(res, hold));
      if (!r.running) return;
      r.show(p.speak, 11000);
      setTimeout(startWhispering, 8000);
    } catch (e) {
      console.warn("Oriel could not plan:", e);
      if (r.passage === 0) { // a scripted opening so the room still opens
        r.passage++; r.passageAt = Date.now(); r.whispers = ["the weight of your hands", "your breath is here", "all of it is welcome", "soft chest", "loved as you are", "warm belly", "room for everything", "home in this body"];
        r.affirmations = ["you are loved", "you are safe here", "nothing to earn", "you can rest now", "all of you is welcome", "you are held", "there is time", "you belong here"];
        r.spoken.push(...r.whispers, ...r.affirmations); r.setPhase("the opening"); startFloating();
        r.show("528 and 532. The door opens.", 11000); setTimeout(startWhispering, 8000);
      }
    } finally { r.planning = false; }
  }

  // ----- begin / end -----
  async function begin() {
    const r = R.current; if (r.running) return;
    r.running = true; r.startedAt = Date.now(); setBegun(true);
    r.audio.start(0.6);
    r.show("Sit back. Breathe slowly. Let the camera see your face.", 9500);
    try { await (navigator as Navigator & { wakeLock?: { request(t: string): Promise<unknown> } }).wakeLock?.request("screen"); } catch {}
    void plan("open");
    // camera and face model load alongside the opening
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 480, height: 360 }, audio: false });
      const v = videoRef.current!; v.srcObject = stream; await v.play();
      const face = new FaceReader(); await face.load(); r.face = face; r.faceLive = true; r.faceLiveAt = Date.now(); r.cornered = false; setYouCorner(false); setFaceLive(true);
    } catch (e) { console.warn("no camera; Oriel listens without a face", e); }
  }
  function end() {
    const r = R.current; r.running = false; clearTimeout(r.whisperTimer); clearTimeout(r.floatTimer);
    if (floatRef.current) floatRef.current.replaceChildren();
    r.show("the door stays open", 6000);
    r.audio.stop(); const v = videoRef.current; (v?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop()); if (v) v.srcObject = null;
    r.faceLive = false; r.cornered = false; setYouCorner(false); setBegun(false); setFaceLive(false); setPhase(""); setWeather(""); r.whispers = []; r.passage = 0;
  }

  // ----- the loop: draw the orb, read the face, feed the beat -----
  useEffect(() => {
    const canvas = canvasRef.current!, ctx = canvas.getContext("2d")!;
    const fb = document.createElement("canvas"), fbx = fb.getContext("2d")!;   // last frame, for the trails
    // The breath is slow (many seconds per cycle) and nothing flashes, so the pattern keeps moving even with the OS "reduce motion" setting on.
    const reduced = false;
    let raf = 0, frame = 0, lastRead = 0, lastReadout = 0, lastT = 0, orbit = 0;
    const draw = (now: number) => {
      const r = R.current; const t = now / 1000; frame++;
      const dt = lastT ? Math.min(0.1, t - lastT) : 0.016; lastT = t;
      // size
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      if (canvas.width !== Math.round(rect.width * dpr)) { canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = rect.width, H = rect.height, cx = W / 2, cy = H / 2, Rr = Math.min(W, H) / 2;
      // face, ~15 fps
      if (r.face && videoRef.current && now - lastRead > 66) {
        lastRead = now; r.faceState = r.face.read(videoRef.current, now);
        if (r.running) r.audio.setBreath(r.faceState.present && r.faceState.breathing ? r.faceState.breath : null);
      }
      const f = r.faceState, ease = f.present ? f.ease : 0.5;
      // the loop. tense lifts the beat a little and closes the music down, warm and held; soft sinks the beat toward delta and opens the music.
      if (r.running && f.present && now - r.lastTune > 4000) {
        r.lastTune = now;
        const rel = f.calibrated ? ease : 0.5;                       // before calibration, hold the passage as written
        const closedBonus = Math.min(1.5, f.closedSeconds / 20);      // eyes closed a while: ease the beat down further
        // tension lifts the beat only a little (never out of the body); softening sinks it toward deep theta
        const shift = rel < 0.5 ? (0.5 - rel) * 2 : (0.5 - rel) * 2.5;
        const beat = Math.min(7, Math.max(2, r.passageBeat + shift - closedBonus));
        r.audio.tune(r.audio.targets.carrier, beat, 12);
        r.audio.setBloom(f.calibrated ? (rel - 0.5) * 2 + Math.max(0, f.trend) * 0.5 : 0);
        // the weather word
        r.setWeather(!f.calibrated ? "reading you" : f.eyesClosed ? "settling" : f.trend > 0.12 ? "softening" : f.trend < -0.12 ? "tightening" : rel > 0.65 ? "open" : rel < 0.35 ? "holding on" : "steady");
        // when the weather has held long enough, Oriel speaks to it
        const age = Date.now() - r.passageAt;
        const softening = f.calibrated && (f.trend > 0.12 || rel > 0.72 || f.closedSeconds > 30);
        const tightening = f.calibrated && (f.trend < -0.12 || rel < 0.28);
        if (softening) { r.tenseSince = 0; if (!r.deepSince) r.deepSince = now; } else r.deepSince = 0;
        if (tightening) { r.deepSince = 0; if (!r.tenseSince) r.tenseSince = now; } else r.tenseSince = 0;
        if (r.passage > 0 && !r.planning) {
          if ((r.deepSince && now - r.deepSince > 15000 && age > 120000) || age > 330000) { r.deepSince = 0; void plan("deepen"); }
          else if (r.tenseSince && now - r.tenseSince > 15000 && age > 90000 && r.lastKind !== "steady") { r.tenseSince = 0; void plan("steady"); }
        }
      } else if (r.running && !f.present && now - r.lastTune > 4000) {
        r.lastTune = now; r.audio.setBloom(0); r.setWeather("");
        if (Date.now() - r.passageAt > 330000 && r.passage > 0 && !r.planning) void plan("deepen");
      }
      r.audio.tick();
      // orb: two ring sources, one per ear, orbiting the centre. On the in-breath they draw together and the whole lattice
      // dilates and coheres into one bright concentric bloom; on the out-breath they part, the lattice contracts and the rings
      // fall into drifting moire fringes. Each frame is painted over a zoomed, slightly turned copy of the last, so every ring
      // leaves a trail that spirals out on the in-breath and in on the out-breath. The hues drift through the spectrum.
      const breathe = reduced ? 0 : r.running ? r.audio.breath : Math.sin(t * 2 * Math.PI * 0.058);
      const inhale = (breathe + 1) / 2;                                   // 0 exhaled .. 1 inhaled
      if (reduced) ctx.clearRect(0, 0, W, H);
      else {
        if (fb.width !== canvas.width || fb.height !== canvas.height) { fb.width = canvas.width; fb.height = canvas.height; }
        fbx.clearRect(0, 0, fb.width, fb.height); fbx.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.save(); ctx.globalAlpha = 0.84; ctx.translate(cx, cy); ctx.rotate(0.01 + 0.035 * breathe); const z = 1 + 0.05 * breathe; ctx.scale(z, z);
        ctx.drawImage(fb, -cx, -cy, W, H); ctx.restore();
      }
      const drift = reduced ? 0 : t * 9;                                 // the slow walk through the spectrum
      const lam = Math.max(5, 2600 / r.audio.carrier) * (0.55 + 0.9 * inhale); // the lattice dilates hard on the in-breath
      const sep = Rr * (0.02 + 0.5 * (1 - inhale));                       // sources meet on the in-breath
      orbit += reduced ? 0 : dt * (0.15 + 0.9 * inhale);                  // and orbit the centre, quickening on the in-breath
      const ang = orbit;
      const ph = reduced ? 0 : (t * r.audio.beat * 0.35) % 1;             // the right source drifts at the beat
      const glow = r.running ? 0.085 + ease * 0.05 : 0.075;
      ctx.globalCompositeOperation = "lighter"; ctx.lineWidth = 1.2 + inhale * 1.8;
      // three sources: one per ear orbiting the centre, and a third at the centre turning the other way, so the fringes fold into petals
      for (const [sgn, p, hs, L] of [[-1, 0, 0, lam], [1, ph, 150, lam * (1 + 0.012 * r.audio.beat)], [0, 1 - ph * 0.5, 270, lam * 0.96]] as const) {
        const sx = cx + sgn * sep * Math.cos(ang), sy = cy + sgn * sep * Math.sin(ang);
        const n = Math.ceil((Rr + sep) / L);
        for (let i = 0; i < n; i++) {
          const rad = (i + p) * L; if (rad <= 0) continue;
          const a = glow * (0.85 + 0.15 * inhale) * (1 - rad / (Rr + sep));
          ctx.strokeStyle = `hsla(${r.hue + hs + drift + i * (8 + 14 * inhale)},92%,68%,${a})`;
          ctx.beginPath(); ctx.arc(sx, sy, rad, 0, Math.PI * 2); ctx.stroke();
        }
      }
      // rings and trails live inside a soft circle, never the square of the canvas
      const vg = ctx.createRadialGradient(cx, cy, Rr * 0.5, cx, cy, Rr * 0.98); vg.addColorStop(0, "rgba(0,0,0,1)"); vg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalCompositeOperation = "destination-in"; ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      // the dot: swells with the breath and throbs gently on top, about once every three seconds
      const throb = reduced ? 0 : Math.sin(t * 2 * Math.PI * 0.33) * 0.02;
      const orbR = Rr * Math.max(0.03, 0.14 + 0.15 * breathe + throb + (r.running ? 0.05 + ease * 0.08 : 0));
      const og = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR * 2.6);
      og.addColorStop(0, `hsla(${r.hue + 20 + drift},85%,${76 + ease * 10 + inhale * 10}%,${r.running ? 0.95 : 0.6})`);
      og.addColorStop(0.3, `hsla(${r.hue + drift * 0.5},80%,60%,${(r.running ? 0.3 + ease * 0.3 : 0.25) * (0.6 + 0.4 * inhale)})`);
      og.addColorStop(1, `hsla(${r.hue + 60 + drift},70%,40%,0)`);
      ctx.fillStyle = og; ctx.beginPath(); ctx.arc(cx, cy, orbR * 2.6, 0, Math.PI * 2); ctx.fill();
      captionRef.current?.style.setProperty("--inhale", inhale.toFixed(3));   // the words breathe too
      // you: the camera breathes with the orb, swelling and brightening on the in-breath
      // once the baseline is taken (or half a minute has passed), it glides from the centre to the corner
      if (r.faceLive && !r.cornered && (f.calibrated || Date.now() - r.faceLiveAt > 30000)) { r.cornered = true; r.setYouCorner(true); }
      const you = youRef.current;
      if (you) {
        you.style.opacity = !r.faceLive ? "0" : r.cornered ? String(0.28 + 0.3 * inhale + ease * 0.15) : String(0.6 + 0.3 * inhale);
        you.style.setProperty("--s", (0.9 + 0.14 * inhale).toFixed(3));
        you.style.filter = `drop-shadow(0 0 ${8 + inhale * 22}px hsla(${r.hue},70%,65%,${0.25 + inhale * 0.3}))`;
      }
      if (now - lastReadout > 250) {
        lastReadout = now; setReadout(r.audio.beat.toFixed(2));
        const glowCss = `0 0 10px 2px hsla(${r.hue},70%,70%,.55)`;
        const m = markRef.current; if (m) { m.style.left = `${Math.max(0, Math.min(100, (r.audio.beat - 2) / 5 * 100))}%`; m.style.boxShadow = glowCss; }
        const [lm, lv, rm, rv] = sideRefs.current, L = r.audio.carrier, Rh = r.audio.carrier + r.audio.beat;
        if (lm && lv && rm && rv) { lm.style.top = lv.style.top = sidePos(L); rm.style.top = rv.style.top = sidePos(Rh); lv.textContent = L.toFixed(2); rv.textContent = Rh.toFixed(2); lm.style.boxShadow = rm.style.boxShadow = glowCss; }
      }
      raf = requestAnimationFrame(safe);
    };
    const safe = (now: number) => { try { draw(now); } catch (e) { console.warn("draw", e); raf = requestAnimationFrame(safe); } };
    raf = requestAnimationFrame(safe);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <main className="screen">
      <div className="float" ref={floatRef} aria-hidden="true" />
      <div className="freq">{readout} hz</div>
      {[0, 2].map((i) => (
        <div className={`side ${i ? "r" : "l"}`} key={i} aria-hidden="true">
          {[174, 396, 417, 432, 528, 639].map((hz) => <span className="tick" key={hz} style={{ top: sidePos(hz) }} />)}
          <div className="mark" ref={(el) => { sideRefs.current[i] = el; }} style={{ top: sidePos(i ? 532.5 : 528) }} />
          <span className="val" ref={(el) => { sideRefs.current[i + 1] = el; }} style={{ top: sidePos(i ? 532.5 : 528) }}>{i ? "532.50" : "528.00"}</span>
          <span className="lab">{i ? "right ear" : "left ear"}</span>
        </div>
      ))}
      <div className="scale" aria-hidden="true"><span className="tick" /><div className="mark" ref={markRef} style={{ left: "50%" }} /><span className="l">delta</span><span className="r">theta</span></div>
      <div className="stage">
        <canvas className="orb" ref={canvasRef} aria-hidden="true" />
        <button className={`begin ${begun ? "gone" : ""}`} onClick={begin}>Begin</button>
      </div>
      <div className={`you ${faceLive ? "live" : ""} ${youCorner ? "corner" : ""} ${flip ? "flip" : ""}`} ref={youRef} onClick={toggleFlip} title="tap to flip the mirror">
        <video ref={videoRef} muted playsInline />
      </div>
      <div className="band">
        <p className={`intro ${begun ? "gone" : ""}`}>528 Hz is the frequency of love. The camera calibrates to your face and modulates the sound.</p>
        <div className={`caption ${captionOn ? "show" : ""}`} ref={captionRef} aria-live="polite"><span>{caption}</span></div>
      </div>
      {begun ? (
        <div className="foot">
          <span>{phase}{weather ? ` · ${weather}` : ""}</span>
          <button onClick={end}>end</button>
        </div>
      ) : (
        <div className="hint">headphones preferred</div>
      )}
    </main>
  );
}
