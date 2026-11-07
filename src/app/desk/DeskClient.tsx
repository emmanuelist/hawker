"use client";
// The helper's board (direction contract: .impeccable/surfaces/src-app-desk-page-tsx.md).
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Copy } from "@/components/Copy";
import { copyNo, money, useLiveSnapshot, useServerNow } from "@/components/live";
import type { Snapshot, SnapshotHold } from "@/lib/service/snapshot";

const SOURCE: Record<string, string> = { fast: "fast path", groq: "Groq Qwen", gemini: "Gemini", unavailable: "AI unavailable" };
const READING: Record<string, string> = { claim: "Claim", cancel: "Cancel", question: "Question", unclear: "Unclear", other: "Chatter" };

export function DeskClient({ stall }: { stall: string }) {
  const { snap, offset, link } = useLiveSnapshot(stall, "desk");
  const now = useServerNow(offset);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setOnScreen = useCallback(
    async (code: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/stalls/${encodeURIComponent(stall)}/on-screen`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (!res.ok) setError(((await res.json()) as { error?: string }).error ?? "Couldn't change the item.");
      } catch {
        setError("No connection. The on-screen item didn't change.");
      } finally {
        setBusy(false);
      }
    },
    [stall],
  );

  const next = useMemo(() => {
    if (!snap) return null;
    const i = snap.items.findIndex((x) => x.code === snap.onScreen);
    return snap.items[(i + 1) % snap.items.length]?.code ?? null;
  }, [snap]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement)?.closest("input, textarea, [contenteditable]")) return;
      if (next && !busy) void setOnScreen(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, busy, setOnScreen]);

  if (!snap) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-ink-muted">{link === "gone" ? "This stall isn't live." : "Opening the desk…"}</p>
      </main>
    );
  }

  const active = snap.holds
    .filter((h) => h.state === "Holding" || h.state === "Waiting")
    .sort((a, b) => (a.state === b.state ? (a.state === "Holding" ? (a.deadlineAt ?? "").localeCompare(b.deadlineAt ?? "") : a.serial - b.serial) : a.state === "Holding" ? -1 : 1));
  const ended = snap.holds.filter((h) => h.state === "Paid" || h.state === "Passed").sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""));
  const item = snap.items.find((i) => i.code === snap.onScreen) ?? null;

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr_auto] overflow-hidden">
      <Rail snap={snap} link={link} />

      <main className="grid min-h-0 grid-cols-[19rem_1fr_22rem] max-[1180px]:grid-cols-[17rem_1fr_19rem]">
        <section aria-labelledby="onscreen" className="min-h-0 overflow-y-auto border-r border-rule px-5 py-5">
          {item ? (
            <>
              <h2 id="onscreen" className="font-display text-[7.5rem] leading-[0.8] font-black tracking-[-0.04em]">
                {item.code}
              </h2>
              <p className="mt-3 text-lg leading-tight font-semibold">{item.name}</p>
              <p className="font-mono text-xl font-bold num">{money(item.priceCents)}</p>
              <table className="mt-5 w-full text-[0.875rem] num">
                <caption className="sr-only">Stock for {item.code}</caption>
                <thead>
                  <tr className="label text-left text-ink-muted">
                    <th scope="col" className="pb-2 font-[inherit]">Variant</th>
                    <th scope="col" className="pb-2 text-right font-[inherit]">Left</th>
                    <th scope="col" className="pb-2 text-right font-[inherit]">Held</th>
                    <th scope="col" className="pb-2 text-right font-[inherit]">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {item.variants.map((v) => (
                    <tr key={v.label} className="border-t border-rule">
                      <th scope="row" className="py-2 text-left font-semibold capitalize">{v.label}</th>
                      <td className={`py-2 text-right font-mono ${v.available === 0 ? "text-serial" : ""}`}>{v.available}</td>
                      <td className="py-2 text-right font-mono">{v.holding}</td>
                      <td className="py-2 text-right font-mono">{v.waiting}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="text-ink-muted">Nothing on screen. Pick an item below.</p>
          )}

          {next && (
            <button
              type="button"
              onClick={() => void setOnScreen(next)}
              disabled={busy}
              className="mt-6 flex h-11 w-full items-center justify-between bg-rail px-4 font-display font-extrabold text-rail-ink disabled:opacity-60"
            >
              <span>Next item: {next}</span>
              <kbd className="border border-rail-muted px-1.5 font-mono text-[0.75rem] font-bold">N</kbd>
            </button>
          )}
          {error && (
            <p className="mt-2 text-[0.8125rem] text-serial" role="alert">
              {error}
            </p>
          )}

          <h3 className="label mt-7 text-ink-muted">Catalog</h3>
          <ul className="mt-2 divide-y divide-rule border-y border-rule">
            {snap.items.map((i) => (
              <li key={i.code}>
                <button
                  type="button"
                  disabled={busy || i.code === snap.onScreen}
                  aria-current={i.code === snap.onScreen ? "true" : undefined}
                  onClick={() => void setOnScreen(i.code)}
                  className="flex w-full items-baseline gap-3 py-2 text-left text-[0.875rem] hover:bg-paid disabled:cursor-default aria-[current=true]:font-bold"
                >
                  <span className="w-7 font-mono font-bold">{i.code}</span>
                  <span className="flex-1">{i.name}</span>
                  <span className="font-mono num">{i.variants.reduce((n, v) => n + v.available, 0)} left</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="pad" className="min-h-0 overflow-y-auto px-6 py-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="pad" className="font-display text-xl font-extrabold">
              Holds
            </h2>
            <p className="text-[0.8125rem] text-ink-muted">Holding by time left, then the line</p>
          </div>
          {active.length === 0 ? (
            <EmptyPad stall={snap.stall.id} />
          ) : (
            <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
              {active.map((h) => (
                <Copy key={h.id} hold={h} now={now} windowSeconds={snap.stall.windowSeconds} variant="desk" />
              ))}
            </div>
          )}
          {ended.length > 0 && (
            <>
              <h3 className="mt-8 font-display text-base font-extrabold">Ended</h3>
              <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
                {ended.slice(0, 12).map((h) => (
                  <Copy key={h.id} hold={h} now={now} windowSeconds={snap.stall.windowSeconds} variant="desk" />
                ))}
              </div>
            </>
          )}
        </section>

        <section aria-labelledby="chat" className="min-h-0 overflow-y-auto border-l border-rule px-5 py-5">
          <h2 id="chat" className="font-display text-xl font-extrabold">
            Chat
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-ink-muted">As written, and what Hawker read</p>
          {snap.comments.length === 0 ? (
            <p className="mt-4 text-ink-muted">Comments appear here as buyers type on the stall.</p>
          ) : (
            <ol className="mt-3 divide-y divide-rule">
              {snap.comments.map((c) => (
                <li key={c.seq} className="py-2.5">
                  <p className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
                    <span className="font-semibold">@{c.handle}</span>
                    <span className="font-mono text-[0.75rem] text-ink-muted num">#{c.seq}</span>
                  </p>
                  <p className="[overflow-wrap:anywhere]">{c.text}</p>
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[0.75rem] text-ink-muted">
                    {c.intent ? (
                      <>
                        <span className="label text-ink">{READING[c.intent] ?? c.intent}</span>
                        {c.source && (
                          <span>
                            {SOURCE[c.source] ?? c.source}
                            {c.ms ? ` · ${(c.ms / 1000).toFixed(1)}s` : ""}
                          </span>
                        )}
                      </>
                    ) : (
                      <span>{c.source === "unavailable" ? "AI unavailable" : "Reading…"}</span>
                    )}
                  </p>
                  {c.outcome && <p className="mt-0.5 text-[0.8125rem]">{c.outcome}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>

      <Tape ended={ended.slice(0, 6)} />
      <Announcer ended={ended} />
    </div>
  );
}

function Rail({ snap, link }: { snap: Snapshot; link: string }) {
  const chips: [string, number, string][] = [
    ["Holding", snap.counters.Holding, "bg-holding text-ink"],
    ["Waiting", snap.counters.Waiting, "bg-waiting text-ink"],
    ["Paid", snap.counters.Paid, "bg-paid text-stamp-paid"],
    ["Passed", snap.counters.Passed, "bg-passed text-passed-ink"],
  ];
  const reader = snap.reader.degraded ? "Fast path only (AI unavailable)" : snap.reader.lastSource ? `Fast path + ${SOURCE[snap.reader.lastSource] ?? snap.reader.lastSource}` : "Fast path + Groq / Gemini";
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-rail px-5 py-3 text-rail-ink">
      <p className="font-display text-lg font-black tracking-[0.14em] uppercase">Hawker</p>
      <p className="text-[0.9375rem] font-semibold">
        {snap.stall.name} · {snap.show.title}
        {snap.stall.isDemo && <span className="ml-2 font-mono text-[0.75rem] font-normal text-rail-muted">demo store · public desk</span>}
      </p>
      <p className="flex items-center gap-2 text-[0.8125rem] text-rail-muted">
        <span className={`inline-block size-2 rounded-full ${link === "live" ? "bg-[#7ee2a1]" : "bg-[#ffb4b4]"}`} aria-hidden="true" />
        {link === "live" ? "Live" : link === "reconnecting" ? "Reconnecting…" : "Connecting…"}
        <span aria-hidden="true">·</span>
        <span>Reader: {reader}</span>
      </p>
      <ul className="ml-auto flex gap-2" aria-label="Holds by state">
        {chips.map(([label, n, cls]) => (
          <li key={label} className={`flex items-baseline gap-2 px-2.5 py-1 ${cls}`}>
            <span className="label">{label}</span>
            <span className="font-mono text-[0.9375rem] font-bold num">{n}</span>
          </li>
        ))}
      </ul>
    </header>
  );
}

function EmptyPad({ stall }: { stall: string }) {
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  return (
    <div className="mt-4 border border-dashed border-rule px-6 py-10">
      <p className="font-display text-lg font-extrabold">No holds yet.</p>
      <p className="mt-1 max-w-prose text-ink-muted">
        Open the stall on a phone and type a claim the way a buyer would, for example “mine gold”. The copy appears here the moment Hawker reads it.
      </p>
      <p className="mt-3 font-mono text-[0.9375rem] font-bold">{origin ? `${origin}/s/${stall}` : `/s/${stall}`}</p>
    </div>
  );
}

function Tape({ ended }: { ended: SnapshotHold[] }) {
  return (
    <footer className="border-t border-rule bg-paid px-5 py-2.5">
      <h2 className="sr-only">Latest endings</h2>
      {ended.length === 0 ? (
        <p className="text-[0.8125rem] text-ink-muted">Endings land here: PAID with its PayPal transaction, or PASSED to the next buyer.</p>
      ) : (
        <ol className="flex gap-6 overflow-x-auto text-[0.8125rem] whitespace-nowrap">
          {ended.map((h) => (
            <li key={h.id} className="flex items-baseline gap-2">
              <span className={`font-display font-black tracking-[0.08em] uppercase ${h.state === "Paid" ? "text-stamp-paid" : "text-stamp-passed"}`}>{h.state}</span>
              <span className="font-mono font-bold text-serial num">{copyNo(h.serial)}</span>
              <span>@{h.handle}</span>
              <span className="font-mono text-ink-muted">
                {h.state === "Paid" ? `txn ${h.transactionId ?? "—"}` : h.passedTo ? `→ @${h.passedTo}` : h.endReason}
              </span>
            </li>
          ))}
        </ol>
      )}
    </footer>
  );
}

/** One polite live region: announce endings once, as they happen. */
function Announcer({ ended }: { ended: SnapshotHold[] }) {
  const latest = ended[0];
  const text = latest
    ? latest.state === "Paid"
      ? `Copy ${latest.serial} for @${latest.handle} is paid.`
      : `Copy ${latest.serial} for @${latest.handle} passed${latest.passedTo ? ` to @${latest.passedTo}` : ""}.`
    : "";
  return (
    <div className="sr-only" role="status" aria-live="polite">
      {text}
    </div>
  );
}
