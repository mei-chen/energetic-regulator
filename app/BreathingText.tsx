"use client";
// Breathing text, ported from the acid-trip page: every letter rides its own slow wave of scale, drift, skew,
// letter spacing, lift and warmth, phase-shifted along the line so the motion travels through the words.
import { useEffect, useRef } from "react";

const A = 0.04, A2 = 0.015;                 // scale amplitudes
const OMEGA_LO = 0.5 * 2 * Math.PI, OMEGA_HI = 1.0 * 2 * Math.PI, OMEGA2 = 0.7 * 2 * Math.PI;
const Y_AMP = 2, Y_AMP2 = 0.8;              // px at 22px type; scaled with the font size
const SKEW_AMP = 2, SKEW_AMP2 = 0.7;        // degrees
const PHI_STEP = 0.2;

export function BreathingText({ text, intensity = 0.35, speed = 0.12, depth = 0.4 }: { text: string; intensity?: number; speed?: number; depth?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = ref.current; if (!host) return;
    const chars = Array.from(host.querySelectorAll<HTMLSpanElement>("span[data-c]"));
    if (!chars.length) return;
    const px = parseFloat(getComputedStyle(host).fontSize) / 22;   // the original was tuned at 22px
    let raf = 0, time = 0, last = 0;
    const k = intensity;
    const tick = (now: number) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016; last = now;
      time += dt * (0.2 + speed * 1.2);
      const t = time;
      for (let i = 0; i < chars.length; i++) {
        const el = chars[i], phi = i * PHI_STEP;
        const s1 = Math.sin(OMEGA_LO * t + phi), s2 = Math.sin(OMEGA2 * t + phi * 1.3 + 1.7);
        const scale = 1 + A * s1 * k + A2 * s2 * k;
        const dy = (Y_AMP * s1 + Y_AMP2 * s2) * k / 0.4 * px;
        const skew = (SKEW_AMP * Math.sin(OMEGA_HI * t + phi) + SKEW_AMP2 * s2) * k / 0.4;
        const spacing = Math.sin(OMEGA_LO * t + phi + 0.5) * 1.2 * k * px;
        const lift = Math.sin(OMEGA_LO * 0.7 * t + phi + 2) * depth;
        const warmth = Math.sin(OMEGA_LO * 0.5 * t + phi + 3) * 0.12 * k;
        const echo = Math.sin(OMEGA2 * 0.6 * t + phi + 5);
        const up = Math.max(0, lift);
        el.style.transform = `translateY(${(dy - lift * 2 * px).toFixed(2)}px) skewX(${skew.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        el.style.marginRight = `${spacing.toFixed(2)}px`;
        el.style.color = `rgba(${Math.round(239 + warmth * 90)},${Math.round(230 - warmth * 120)},${Math.round(220 - warmth * 180)},${(0.88 + lift * 0.06).toFixed(3)})`;
        el.style.textShadow = `0 ${(up * 3 * px).toFixed(1)}px ${(6 + up * 10) * px}px hsla(350,70%,70%,${(up * 0.35 * depth).toFixed(3)}), ${(echo * 2 * px).toFixed(1)}px ${(-echo * 1.5 * px).toFixed(1)}px 0 hsla(40,70%,70%,${(Math.abs(echo) * 0.12 * depth).toFixed(3)})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, intensity, speed, depth]);
  // words stay together: each word is a no-wrap run of letter spans, spaces are ordinary spaces between runs
  const words = text.split(" ");
  return (
    <span ref={ref} className="breathing" aria-label={text}>
      {words.map((w, wi) => (
        <span key={wi} aria-hidden="true">
          <span className="w">{Array.from(w).map((c, ci) => <span key={ci} data-c="">{c}</span>)}</span>
          {wi < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}
