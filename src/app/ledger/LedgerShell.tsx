"use client";
// The ledger page around AG Studio: Hawker's rail, the live link to the stall, and Studio loaded on
// the client only (it measures the DOM). The rows refresh whenever the stall's stream changes.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { linkLabel, useLiveSnapshot } from "@/components/live";
import type { LedgerRow } from "@/lib/service/ledger";

const LedgerStudio = dynamic(() => import("./LedgerStudio"), {
  ssr: false,
  loading: () => <p className="p-6 text-ink-muted">Opening the ledger…</p>,
});

export function LedgerShell({ stall }: { stall: string }) {
  const { snap, link } = useLiveSnapshot(stall, "desk");
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const version = snap ? `${snap.counters.Waiting}-${snap.counters.Holding}-${snap.counters.Paid}-${snap.counters.Passed}-${snap.nextSerial}` : "";

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stalls/${encodeURIComponent(stall)}/ledger`);
        const json = (await res.json()) as { rows?: LedgerRow[]; error?: string };
        if (!live) return;
        if (!res.ok || !json.rows) setError(json.error ?? "Couldn't read the ledger.");
        else {
          setRows(json.rows);
          setError(null);
        }
      } catch {
        if (live) setError("No connection. The ledger will refresh when it's back.");
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [stall, version]);

  return (
    <div className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr]">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-rail px-5 py-3 text-rail-ink">
        <Link href="/" className="font-display text-lg font-black tracking-[0.16em] uppercase">
          Hawker
        </Link>
        <h1 className="text-[0.9375rem] font-semibold">
          {snap?.stall.name ?? "Ada's Closet"} · the hold ledger
          <span className="ml-2 text-[0.8125rem] font-normal text-rail-muted">AG Studio · every row is a real hold</span>
        </h1>
        <p className="flex items-center gap-2 text-[0.8125rem] text-rail-muted">
          <span className={`inline-block size-2 rounded-full ${link === "live" ? "bg-[#7ee2a1]" : "bg-[#ffb4b4]"}`} aria-hidden="true" />
          {linkLabel(link)}
          {rows && <span>· {rows.length} copies</span>}
        </p>
        <nav aria-label="Hawker" className="ml-auto flex items-center gap-4 text-[0.875rem]">
          <Link href="/desk" className="underline">
            Desk
          </Link>
          <Link href={`/s/${stall}`} className="underline">
            Demo stall
          </Link>
        </nav>
      </header>
      <main className="min-h-0">
        {error && !rows ? (
          <p className="p-6 text-serial" role="alert">
            {error}
          </p>
        ) : rows ? (
          <LedgerStudio stall={stall} rows={rows} />
        ) : (
          <p className="p-6 text-ink-muted">Reading the ledger…</p>
        )}
      </main>
    </div>
  );
}
