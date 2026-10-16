// Reads the listener's face on-device with MediaPipe blendshapes. Nothing leaves the browser.
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export type FaceState = {
  present: boolean;
  calibrated: boolean;   // a personal baseline has been taken
  ease: number;          // 0..1 relative to the listener's own baseline (0.5 = their resting face)
  trend: number;         // -1..1: fast ease minus slow ease. Positive = softening, negative = tightening
  eyesClosed: boolean;
  closedSeconds: number;
  blinkRate: number;     // blinks per minute over the last minute
  stillness: number;     // 0..1, how still the head is
};

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const CALIBRATION_MS = 20000;

export class FaceReader {
  private lm: FaceLandmarker | null = null;
  private fast = 0.5;          // ~2 s
  private slow = 0.5;          // ~25 s
  private baseline: number | null = null;
  private calSamples: number[] = [];
  private firstSeen = 0;
  private closedSince = 0;
  private wasClosed = false;
  private blinks: number[] = [];
  private lastNose: { x: number; y: number } | null = null;
  private motion = 0;
  private lastT = 0;
  state: FaceState = { present: false, calibrated: false, ease: 0.5, trend: 0, eyesClosed: false, closedSeconds: 0, blinkRate: 0, stillness: 1 };

  async load() {
    const files = await FilesetResolver.forVisionTasks(WASM);
    this.lm = await FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
      runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: false,
    });
  }

  /** Run on a video frame. Returns the smoothed state. */
  read(video: HTMLVideoElement, now: number): FaceState {
    if (!this.lm || video.readyState < 2) return this.state;
    const dt = this.lastT ? Math.min(0.5, (now - this.lastT) / 1000) : 0.066; this.lastT = now;
    const r = this.lm.detectForVideo(video, now);
    const shapes = r.faceBlendshapes?.[0]?.categories;
    const pts = r.faceLandmarks?.[0];
    if (!shapes || !pts) { this.state = { ...this.state, present: false }; this.lastNose = null; return this.state; }
    const g = (n: string) => shapes.find((c) => c.categoryName === n)?.score ?? 0;
    const smile = (g("mouthSmileLeft") + g("mouthSmileRight")) / 2;
    const brow = (g("browDownLeft") + g("browDownRight")) / 2;
    const press = (g("mouthPressLeft") + g("mouthPressRight")) / 2;
    const squint = (g("eyeSquintLeft") + g("eyeSquintRight")) / 2;
    const frown = (g("mouthFrownLeft") + g("mouthFrownRight")) / 2;
    const jaw = g("jawOpen");
    const blink = (g("eyeBlinkLeft") + g("eyeBlinkRight")) / 2;

    // head stillness from nose-tip motion (landmark 1), in normalized image units per second
    const nose = pts[1];
    if (this.lastNose) {
      const v = Math.hypot(nose.x - this.lastNose.x, nose.y - this.lastNose.y) / Math.max(dt, 0.016);
      this.motion += (v - this.motion) * 0.1;
    }
    this.lastNose = { x: nose.x, y: nose.y };
    const stillness = Math.max(0, Math.min(1, 1 - this.motion / 0.12));

    // blinks: count closures; eyes "closed" after 2.5 s of closure
    const closed = blink > 0.5;
    if (closed && !this.wasClosed) this.blinks.push(now);
    this.wasClosed = closed;
    if (closed) { if (!this.closedSince) this.closedSince = now; } else this.closedSince = 0;
    const closedSeconds = this.closedSince ? (now - this.closedSince) / 1000 : 0;
    const eyesClosed = closedSeconds > 2.5;
    this.blinks = this.blinks.filter((t) => now - t < 60000);
    const blinkRate = this.blinks.length;

    // raw ease: expression, plus stillness and a calm blink rate
    const raw = Math.min(1, Math.max(0,
      0.55 + 0.6 * smile - 0.7 * brow - 0.4 * press - 0.3 * squint - 0.3 * frown - 0.15 * Math.max(0, jaw - 0.25)
      + 0.15 * (stillness - 0.5) - 0.1 * Math.max(0, Math.min(1, (blinkRate - 15) / 20))));

    // two time scales
    this.fast += (raw - this.fast) * (1 - Math.exp(-dt / 2));
    this.slow += (raw - this.slow) * (1 - Math.exp(-dt / 25));

    // personal baseline over the first 20 s with a face in view
    if (!this.firstSeen) this.firstSeen = now;
    if (this.baseline === null) {
      this.calSamples.push(raw);
      if (now - this.firstSeen > CALIBRATION_MS) {
        const s = [...this.calSamples].sort((a, b) => a - b);
        this.baseline = s[Math.floor(s.length / 2)];
        this.slow = this.fast;
      }
    }
    const base = this.baseline ?? 0.5;
    const ease = Math.max(0, Math.min(1, 0.5 + (this.fast - base) * 2));
    const trend = Math.max(-1, Math.min(1, (this.fast - this.slow) * 5));
    this.state = { present: true, calibrated: this.baseline !== null, ease, trend, eyesClosed, closedSeconds, blinkRate, stillness };
    return this.state;
  }
}
