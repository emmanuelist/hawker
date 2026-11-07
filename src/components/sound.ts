"use client";
// The stamp's sound, synthesised (no audio file): a short low thump and a paper slap. Off until the
// helper turns it on; browsers only allow audio after a user gesture, which that toggle is.
import { useCallback, useRef, useState, useSyncExternalStore } from "react";

const KEY = "hawker.sound";

function readPref(): boolean {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function useStampSound() {
  const enabled = useSyncExternalStore(subscribe, readPref, () => false);
  const ctxRef = useRef<AudioContext | null>(null);
  const [, force] = useState(0);

  const toggle = useCallback(() => {
    const next = !readPref();
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      /* private mode: the toggle still works for this page */
    }
    if (next && !ctxRef.current && typeof AudioContext !== "undefined") ctxRef.current = new AudioContext();
    void ctxRef.current?.resume();
    listeners.forEach((l) => l());
    force((n) => n + 1);
  }, []);

  const play = useCallback(
    (kind: "Paid" | "Passed") => {
      if (!enabled) return;
      if (!ctxRef.current && typeof AudioContext !== "undefined") ctxRef.current = new AudioContext();
      const ctx = ctxRef.current;
      if (!ctx || ctx.state !== "running") return;
      const t = ctx.currentTime;
      const body = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      body.type = "sine";
      body.frequency.setValueAtTime(kind === "Paid" ? 160 : 112, t);
      body.frequency.exponentialRampToValueAtTime(44, t + 0.13);
      bodyGain.gain.setValueAtTime(0.0001, t);
      bodyGain.gain.exponentialRampToValueAtTime(0.55, t + 0.006);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      body.connect(bodyGain).connect(ctx.destination);
      body.start(t);
      body.stop(t + 0.22);

      const len = Math.floor(0.045 * ctx.sampleRate);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
      const slap = ctx.createBufferSource();
      slap.buffer = buf;
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = kind === "Paid" ? 2200 : 1500;
      const slapGain = ctx.createGain();
      slapGain.gain.value = 0.3;
      slap.connect(band).connect(slapGain).connect(ctx.destination);
      slap.start(t);
    },
    [enabled],
  );

  return { enabled, toggle, play };
}
