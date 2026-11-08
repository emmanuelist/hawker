"use client";
// The ledger page around AG Studio: Hawker's rail, the live link to the stall, the ticker along the
// binding, and Studio loaded on the client only (it measures the DOM). The rows refresh whenever the
// stall's stream changes; each refresh is compared with the last, so the motion layer (live.ts) and
// the stamp sound fire only for copies that changed while the page was open.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { linkLabel, useLiveSnapshot } from "@/components/live";
import { useStampSound } from "@/components/sound";
import type { LedgerRow } from "@/lib/service/ledger";
import { diffRows, markFresh } from "./live";

const LedgerStudio = dynamic(() => import("./LedgerStudio"), {
  ssr: false,
  loading: () => <Opening what="Opening AG Studio…" />,
});

/** While AG Studio loads (a large bundle on a cold visit), the stall's live counts are already known. */
function Opening({ what, counters }: { what: string; counters?: { Paid: number; Passed: number; Holding: number } }) {
  return (
    <div className="flex h-full items-center justify-center p-6" role="status">
      <div className="grid justify-items-center gap-4 text-center">
        {counters && (
          <p className="flex items-center gap-5 text-[0.9375rem]">
            <span className="flex items-center gap-2">
              <span className="stamp text-[0.875rem]" data-kind="paid">
                Paid
              </span>
              <span className="font-mono text-xl font-bold num">{counters.Paid}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="stamp text-[0.875rem]" data-kind="passed">
                Passed
              </span>
              <span className="font-mono text-xl font-bold num">{counters.Passed}</span>
            </span>
            {counters.Holding > 0 && (
              <span className="text-ink-muted">
                <span className="font-mono font-bold text-ink num">{counters.Holding}</span> holding
              </span>
            )}
          </p>
        )}
        <p className="text-ink-muted">{what}</p>
      </div>
    </div>
  );
}

export function LedgerShell({ stall }: { stall: string }) {
  const { snap, link } = useLiveSnapshot(stall, "desk");
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const [skewMs, setSkewMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const sound = useStampSound();
  const lastRows = useRef<LedgerRow[] | null>(null);
  const { play } = sound;
  const version = snap ? `${snap.counters.Waiting}-${snap.counters.Holding}-${snap.counters.Paid}-${snap.counters.Passed}-${snap.nextSerial}` : "";

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      try {
        const sent = Date.now();
        const res = await fetch(`/api/stalls/${encodeURIComponent(stall)}/ledger`);
        const json = (await res.json()) as { rows?: LedgerRow[]; at?: string; error?: string };
        if (!live) return;
        if (!res.ok || !json.rows) {
          setError(json.error ?? "Couldn't read the ledger.");
          return;
        }
        // The server's clock, so a copy's time left matches the stall's (half the round trip in).
        if (json.at) setSkewMs(Date.parse(json.at) - (sent + Date.now()) / 2);
        const changes = diffRows(lastRows.current, json.rows);
        markFresh(changes);
        const ended = changes.find((c) => c.kind === "Paid" || c.kind === "Passed");
        if (ended && ended.kind !== "new") play(ended.kind);
        lastRows.current = json.rows;
        setRows(json.rows);
        setError(null);
      } catch {
        if (live) setError("No connection. The ledger will refresh when it's back.");
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [stall, version, play]);

  return (
    <div className="hawker-ledger grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[auto_auto_1fr]">
      <header className="binding flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
        <Link href="/" className="font-display text-lg font-black tracking-[0.16em] uppercase">
          Hawker
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h1 className="text-[0.9375rem] font-semibold">{snap?.stall.name ?? "Ada's Closet"} · the hold ledger</h1>
          <p className="text-[0.8125rem] text-rail-muted">AG Studio · every row is a real hold</p>
        </div>
        <p className="flex items-center gap-2 text-[0.8125rem] text-rail-muted">
          <span className={`inline-block size-2 rounded-full ${link === "live" ? "bg-[#7ee2a1]" : "bg-[#ffb4b4]"}`} aria-hidden="true" />
          {linkLabel(link)}
          {rows && <span>· {rows.length} copies</span>}
        </p>
        <nav aria-label="Hawker" className="ml-auto flex items-center gap-4 text-[0.875rem]">
          <button
            type="button"
            aria-pressed={sound.enabled}
            onClick={sound.toggle}
            className="inline-flex min-h-8 items-center gap-1.5 text-[0.8125rem] text-rail-muted hover:text-rail-ink"
            title="A stamp sound when a copy is paid or passed"
          >
            <SpeakerIcon on={sound.enabled} />
            Sound {sound.enabled ? "on" : "off"}
          </button>
          <Link href="/desk" className="underline">
            Desk
          </Link>
          <Link href={`/s/${stall}`} className="underline">
            Demo stall
          </Link>
        </nav>
      </header>
      <Ticker rows={rows} />
      <main className="min-h-0">
        {error && !rows ? (
          <p className="p-6 text-serial" role="alert">
            {error}
          </p>
        ) : rows ? (
          <LedgerStudio stall={stall} rows={rows} skewMs={skewMs} />
        ) : (
          <Opening what="Reading every copy on the ledger…" counters={snap?.counters} />
        )}
      </main>
    </div>
  );
}

/** The latest copies along the binding: who holds now, then the newest endings. */
function Ticker({ rows }: { rows: LedgerRow[] | null }) {
  const [paused, setPaused] = useState(false);
  if (!rows || rows.length === 0) return <div className="lg-ticker" aria-hidden="true" />;
  const holding = rows.filter((r) => r.state === "Holding");
  const ended = rows
    .filter((r) => r.endedAt && (r.state === "Paid" || r.state === "Passed"))
    .sort((a, b) => Date.parse(b.endedAt ?? "") - Date.parse(a.endedAt ?? ""))
    .slice(0, 10);
  const items = [...holding, ...ended];
  const latest = ended[0];
  const run = (dup: boolean) => (
    <div className="flex" data-dup={dup ? "" : undefined}>
      {items.map((r) => (
        <span key={r.copy} className="lg-ticker-item">
          <span className="lg-copy">{r.copy}</span>
          {r.state === "Holding" ? (
            <span className="lg-ticker-holding">Holding</span>
          ) : (
            <span className="stamp" data-kind={r.state === "Paid" ? "paid" : "passed"}>
              {r.state}
            </span>
          )}
          <span>{r.buyer}</span>
          <span className="lg-ticker-muted">{r.item}</span>
          <span className="lg-amount">${r.amountUsd.toFixed(2)}</span>
          {r.state === "Paid" && r.paypalTxn && <span className="lg-ticker-muted">PayPal {r.paypalTxn}</span>}
          {r.state === "Passed" && <span className="lg-ticker-muted">{r.passedTo ? `→ ${r.passedTo}` : "→ next buyer"}</span>}
        </span>
      ))}
    </div>
  );
  return (
    <div className="lg-ticker" data-paused={paused}>
      <span className="print lg-ticker-label">Latest</span>
      {/* The moving strip repeats the grid below, so it is hidden from screen readers; this says the newest ending once. */}
      <p className="sr-only">
        {latest ? `Latest ending: ${latest.copy}, ${latest.state}, ${latest.buyer}, $${latest.amountUsd.toFixed(2)}.` : "No copy has ended yet."}
        {holding.length ? ` ${holding.length} holding now.` : ""}
      </p>
      <div className="lg-ticker-window" aria-hidden="true">
        <div className="lg-ticker-track" style={{ ["--tick-dur" as string]: `${Math.max(30, items.length * 7)}s` }}>
          {run(false)}
          {run(true)}
        </div>
      </div>
      <button type="button" className="lg-ticker-pause" aria-pressed={paused} aria-label={paused ? "Play the ticker" : "Pause the ticker"} onClick={() => setPaused((p) => !p)}>
        <svg className="size-3.5" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
          {paused ? <path d="M3 1.5v11l9-5.5z" /> : <path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" />}
        </svg>
      </button>
    </div>
  );
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M2.5 6h2.5l3.5-3v10L5 10H2.5z" strokeLinejoin="round" />
      {on ? <path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.8a6 6 0 0 1 0 8.4" strokeLinecap="round" /> : <path d="m11 6 3.5 4m0-4L11 10" strokeLinecap="round" />}
    </svg>
  );
}
