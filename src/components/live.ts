"use client";
// Live snapshot over Server-Sent Events. EventSource reconnects on its own; we surface the state so
// the UI can say "reconnecting" instead of showing stale numbers as current.
import { useEffect, useState } from "react";
import type { Snapshot } from "@/lib/service/snapshot";

export type LinkState = "connecting" | "live" | "reconnecting" | "gone";

export function useLiveSnapshot(stall: string, view: "desk" | "stall", nonce = 0) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [offset, setOffset] = useState(0); // server time − client time, ms
  const [link, setLink] = useState<LinkState>("connecting");

  useEffect(() => {
    const es = new EventSource(`/api/stalls/${encodeURIComponent(stall)}/stream?view=${view}`);
    es.onmessage = (e) => {
      const s = JSON.parse(e.data) as Snapshot;
      setOffset(new Date(s.now).getTime() - Date.now());
      setSnap(s);
      setLink("live");
    };
    es.addEventListener("gone", () => {
      setLink("gone");
      es.close();
    });
    es.onerror = () => setLink((l) => (l === "gone" ? l : "reconnecting"));
    return () => es.close();
  }, [stall, view, nonce]);

  return { snap, offset, link };
}

/** Server-adjusted clock that ticks every second, for countdowns. 0 until mounted (no Date.now() in prerender). */
export function useServerNow(offset: number): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset);
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [offset]);
  return now;
}

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
export const copyNo = (n: number) => `No. ${String(n).padStart(4, "0")}`;
export const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
