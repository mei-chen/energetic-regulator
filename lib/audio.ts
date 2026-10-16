// The sound of the room: calm music underneath, a quiet binaural beat inside it, a slow breath over all of it.
// Five long ambient tracks in different palettes play in a shuffled order with a crossfade, so the room never falls silent or repeats itself soon.
const TRACKS = ["/music/dawn.mp3", "/music/dusk.mp3", "/music/rain.mp3", "/music/tide.mp3", "/music/grove.mp3"];
const XFADE = 10;       // seconds of overlap between tracks
const MUSIC = 0.55;     // music level under the master
const BEAT = 0.055;     // the binaural tones, felt more than heard
const BREATH_HZ = 0.058; // the swell on the music, about three and a half breaths a minute

export class Binaural {
  private ac: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private tone!: BiquadFilterNode;
  private oscs: { osc: OscillatorNode; f: (c: number, b: number) => number }[] = [];
  private buffers: (AudioBuffer | null)[] = [];
  private playing: { src: AudioBufferSourceNode; g: GainNode; endsAt: number } | null = null;
  private order: number[] = [];   // a shuffled walk through the tracks
  private pos = 0;
  private nextQueued = false;
  private breathStart = 0;
  private breathLfo!: GainNode;
  private faceBreath: number | null = null;
  carrier = 528;
  beat = 4.5;
  private targetCarrier = 528;
  private targetBeat = 4.5;

  start(volume = 0.6) {
    if (this.ac) { void this.ac.resume(); return; }
    const ac = new AudioContext();
    this.ac = ac;
    this.master = ac.createGain(); this.master.gain.value = 0; this.master.connect(ac.destination);
    // the beat: one pure sine per ear, a few hertz apart, low under the music
    const merger = ac.createChannelMerger(2); merger.connect(this.master);
    const mk = (f: (c: number, b: number) => number, ch: number) => {
      const osc = ac.createOscillator(); osc.type = "sine"; osc.frequency.value = f(this.carrier, this.beat);
      const g = ac.createGain(); g.gain.value = BEAT; osc.connect(g); g.connect(merger, 0, ch); osc.start();
      this.oscs.push({ osc, f });
    };
    mk((c) => c, 0); mk((c, b) => c + b, 1);
    // the music: through a warm lowpass that opens as the listener softens
    this.tone = ac.createBiquadFilter(); this.tone.type = "lowpass"; this.tone.frequency.value = 3000; this.tone.Q.value = 0.3;
    this.music = ac.createGain(); this.music.gain.value = MUSIC;
    this.tone.connect(this.music); this.music.connect(this.master);
    // the breath: a slow, clearly felt swell on the music, about three and a half breaths a minute
    const breath = ac.createOscillator(); breath.frequency.value = BREATH_HZ;
    const bg = ac.createGain(); bg.gain.value = MUSIC * 0.3; breath.connect(bg); bg.connect(this.music.gain);
    this.breathLfo = bg; this.breathStart = ac.currentTime; breath.start(this.breathStart);
    this.master.gain.setTargetAtTime(volume, ac.currentTime, 2.5);
    void this.loadAndPlay();
  }

  private async load(i: number) {
    if (this.buffers[i]) return this.buffers[i]!;
    const res = await fetch(TRACKS[i]); const buf = await this.ac!.decodeAudioData(await res.arrayBuffer());
    this.buffers[i] = buf; return buf;
  }

  private shuffle() {
    const idx = TRACKS.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    if (this.order.length && idx[0] === this.order[this.order.length - 1]) idx.push(idx.shift()!); // never the same track twice running
    this.order = idx; this.pos = 0;
  }

  private async loadAndPlay() {
    this.shuffle();
    const first = await this.load(this.order[0]);
    if (!this.ac) return;
    this.play(first, this.ac.currentTime + 0.1, 6);
    void this.load(this.order[1]);
  }

  /** Start a track at `at`, fading in over `fade` seconds; the previous track fades out across the same window. */
  private play(buf: AudioBuffer, at: number, fade: number) {
    const ac = this.ac!;
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(1, at + fade);
    src.connect(g); g.connect(this.tone); src.start(at);
    if (this.playing) { const old = this.playing; old.g.gain.setValueAtTime(1, at); old.g.gain.linearRampToValueAtTime(0, at + fade); old.src.stop(at + fade + 0.1); }
    this.playing = { src, g, endsAt: at + buf.duration };
    this.nextQueued = false;
  }

  /** Glide to a new carrier and beat over `glide` seconds. */
  tune(carrier: number, beat: number, glide = 20) {
    this.targetCarrier = carrier; this.targetBeat = beat;
    if (!this.ac) { this.carrier = carrier; this.beat = beat; return; }
    const now = this.ac.currentTime, t = now + Math.max(0.5, glide);
    for (const { osc, f } of this.oscs) {
      osc.frequency.cancelScheduledValues(now);
      osc.frequency.setValueAtTime(osc.frequency.value, now);
      osc.frequency.linearRampToValueAtTime(f(carrier, beat), t);
    }
  }

  /** Call each frame: eases the displayed values toward the target and keeps the music going. */
  tick() {
    this.carrier += (this.targetCarrier - this.carrier) * 0.01; this.beat += (this.targetBeat - this.beat) * 0.01;
    const ac = this.ac, p = this.playing;
    if (!ac || !p || this.nextQueued) return;
    const at = p.endsAt - XFADE;
    if (ac.currentTime < at - 2) return;
    if (this.pos + 1 >= this.order.length) { const last = this.order[this.pos]; this.shuffle(); this.order.unshift(last); }
    const next = this.order[this.pos + 1], buf = this.buffers[next];
    if (!buf) { void this.load(next); return; }            // not decoded yet: try again next frame
    this.pos++; this.nextQueued = true;
    this.play(buf, Math.max(at, ac.currentTime + 0.05), XFADE);
    void this.load(this.order[this.pos + 1] ?? this.order[0]);
  }

  /** -1..1, 0 at the listener's baseline. The music opens and brightens as they soften; it closes, warm and held, as they tighten. */
  setBloom(level: number) {
    if (!this.ac) return;
    const l = Math.max(-1, Math.min(1, level));
    this.tone.frequency.setTargetAtTime(3000 * Math.pow(2, l * 1.5), this.ac.currentTime, 4);
  }

  stop() { if (this.ac) this.master.gain.setTargetAtTime(0, this.ac.currentTime, 1.5); }
  /** Hand the music the listener's own breath (-1..1), or null to let it breathe on its own. */
  setBreath(v: number | null) {
    if (!this.ac) return;
    const now = this.ac.currentTime, was = this.faceBreath !== null;
    this.faceBreath = v;
    if (v === null) { if (was) { this.breathLfo.gain.setTargetAtTime(MUSIC * 0.3, now, 3); this.music.gain.setTargetAtTime(MUSIC, now, 3); } return; }
    if (!was) this.breathLfo.gain.setTargetAtTime(0, now, 3);
    this.music.gain.setTargetAtTime(MUSIC * (1 + 0.3 * v), now, 0.35);
  }
  /** -1..1, the breath the music is swelling with: the listener's own when the face gives one, otherwise its own slow one. */
  get breath() { return this.faceBreath ?? (this.ac ? Math.sin((this.ac.currentTime - this.breathStart) * 2 * Math.PI * BREATH_HZ) : 0); }
  get targets() { return { carrier: this.targetCarrier, beat: this.targetBeat }; }
}
