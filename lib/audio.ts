// The sound of the room: calm music underneath, a quiet binaural beat inside it, a slow breath over all of it.
// Two long ambient tracks alternate with a crossfade so the room never falls silent.
const TRACKS = ["/music/dawn.mp3", "/music/dusk.mp3"];
const XFADE = 10;       // seconds of overlap between tracks
const MUSIC = 0.55;     // music level under the master
const BEAT = 0.055;     // the binaural tones, felt more than heard

export class Binaural {
  private ac: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private tone!: BiquadFilterNode;
  private oscs: { osc: OscillatorNode; f: (c: number, b: number) => number }[] = [];
  private buffers: (AudioBuffer | null)[] = [];
  private playing: { src: AudioBufferSourceNode; g: GainNode; endsAt: number } | null = null;
  private trackIdx = 0;
  private nextQueued = false;
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
    const breath = ac.createOscillator(); breath.frequency.value = 0.058;
    const bg = ac.createGain(); bg.gain.value = MUSIC * 0.3; breath.connect(bg); bg.connect(this.music.gain); breath.start();
    this.master.gain.setTargetAtTime(volume, ac.currentTime, 2.5);
    void this.loadAndPlay();
  }

  private async loadAndPlay() {
    const ac = this.ac!;
    const load = async (i: number) => {
      if (this.buffers[i]) return this.buffers[i];
      const res = await fetch(TRACKS[i]); const buf = await ac.decodeAudioData(await res.arrayBuffer());
      this.buffers[i] = buf; return buf;
    };
    const first = await load(0);
    if (!this.ac) return;
    this.play(first, ac.currentTime + 0.1, 6);
    void load(1);
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
    const next = (this.trackIdx + 1) % TRACKS.length, buf = this.buffers[next] ?? this.buffers[this.trackIdx];
    if (!buf) return;
    this.trackIdx = this.buffers[next] ? next : this.trackIdx;
    this.nextQueued = true;
    this.play(buf, Math.max(at, ac.currentTime + 0.05), XFADE);
  }

  /** -1..1, 0 at the listener's baseline. The music opens and brightens as they soften; it closes, warm and held, as they tighten. */
  setBloom(level: number) {
    if (!this.ac) return;
    const l = Math.max(-1, Math.min(1, level));
    this.tone.frequency.setTargetAtTime(3000 * Math.pow(2, l * 1.5), this.ac.currentTime, 4);
  }

  stop() { if (this.ac) this.master.gain.setTargetAtTime(0, this.ac.currentTime, 1.5); }
  get targets() { return { carrier: this.targetCarrier, beat: this.targetBeat }; }
}
