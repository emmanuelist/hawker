"use client";
// Live snapshot over Server-Sent Events. EventSource reconnects on its own; we surface the state so
// the UI can say "reconnecting" instead of showing stale numbers as current.
import { useEffect, useState } from "react";
import type { Snapshot } from "@/lib/service/snapshot";

export type LinkState = "connecting" | "live" | "reconnecting" | "trouble" | "gone";

/** One wording for the link state on every surface. */
export function linkLabel(link: LinkState): string {
  switch (link) {
    case "live":
      return "Live";
    case "reconnecting":
      return "Reconnecting…";
    case "trouble":
      return "Can't read the stall · retrying";
    case "gone":
      return "Not live";
    default:
      return "Connecting…";
  }
}

const REOPEN_MS = 5000;

export function useLiveSnapshot(stall: string, view: "desk" | "stall", nonce = 0, initial: Snapshot | null = null) {
  const [snap, setSnap] = useState<Snapshot | null>(initial);
  const [offset, setOffset] = useState(0); // server time − client time, ms
  const [link, setLink] = useState<LinkState>("connecting");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const es = new EventSource(`/api/stalls/${encodeURIComponent(stall)}/stream?view=${view}`);
    let reopen: ReturnType<typeof setTimeout> | null = null;
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
    // The server couldn't read the stall; it retries on its own and the next snapshot clears this.
    es.addEventListener("oops", () => setLink((l) => (l === "gone" ? l : "trouble")));
    es.onerror = () => {
      setLink((l) => (l === "gone" ? l : "reconnecting"));
      // EventSource retries dropped connections itself, but gives up for good on an error response
      // (a 500 before the stream opens). Reopen it ourselves so the page never stalls.
      if (es.readyState === EventSource.CLOSED && !reopen) {
        reopen = setTimeout(() => setAttempt((a) => a + 1), REOPEN_MS);
      }
    };
    return () => {
      if (reopen) clearTimeout(reopen);
      es.close();
    };
  }, [stall, view, nonce, attempt]);

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
