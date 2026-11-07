"use client";
// The helper's board (direction contract: .impeccable/surfaces/src-app-desk-page-tsx.md). The centre is
// the pad: open copies by time left, each naming who is next in line. When a copy ends, its stamp lands
// where the helper was looking, then it tears off (Passed) or is filed (Paid) into the stubs below.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChatLine, SOURCE } from "@/components/ChatLine";
import { Copy, lineInfo, shortId } from "@/components/Copy";
import { copyNo, linkLabel, money, useLiveSnapshot, useServerNow, type LinkState } from "@/components/live";
import { useStampSound } from "@/components/sound";
import type { Snapshot, SnapshotHold } from "@/lib/service/snapshot";

type Leaving = { hold: SnapshotHold; index: number; gen: number };

export function DeskClient({ stall }: { stall: string }) {
  const { snap, offset, link } = useLiveSnapshot(stall, "desk");
  const now = useServerNow(offset);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sound = useStampSound();

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

  const active = useMemo(
    () =>
      (snap?.holds ?? [])
        .filter((h) => h.state === "Holding" || h.state === "Waiting")
        .sort((a, b) => (a.state === b.state ? (a.state === "Holding" ? (a.deadlineAt ?? "").localeCompare(b.deadlineAt ?? "") : a.serial - b.serial) : a.state === "Holding" ? -1 : 1)),
    [snap],
  );
  const ended = useMemo(
    () => (snap?.holds ?? []).filter((h) => h.state === "Paid" || h.state === "Passed").sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? "")),
    [snap],
  );

  // React's "information from previous renders" pattern: a copy that was open on the last render and
  // has ended on this one leaves the pad where it stood (stamp, then tear-off), and its stub arrives.
  const [prevActive, setPrevActive] = useState(active);
  const [leaving, setLeaving] = useState<Leaving[]>([]);
  const [arrived, setArrived] = useState<ReadonlySet<number>>(new Set());
  const [gen, setGen] = useState(0);
  if (prevActive !== active) {
    const endedById = new Map(ended.map((h) => [h.id, h]));
    const left: Leaving[] = [];
    prevActive.forEach((h, index) => {
      const now = endedById.get(h.id);
      if (now) left.push({ hold: now, index, gen: gen + 1 });
    });
    setPrevActive(active);
    if (left.length) {
      setGen(gen + 1);
      setLeaving((l) => [...l, ...left]);
      setArrived((a) => new Set([...a, ...left.map((x) => x.hold.id)]));
    }
  }

  useEffect(() => {
    if (!leaving.length) return;
    const top = Math.max(...leaving.map((x) => x.gen));
    const t = setTimeout(() => setLeaving((l) => l.filter((x) => x.gen > top)), 1400);
    return () => clearTimeout(t);
  }, [leaving]);

  // One stamp sound per copy that leaves the pad (when the helper has sound on).
  const { play } = sound;
  const playedRef = useRef(0);
  useEffect(() => {
    if (gen <= playedRef.current) return;
    for (const x of leaving) if (x.gen > playedRef.current) play(x.hold.state === "Paid" ? "Paid" : "Passed");
    playedRef.current = gen;
  }, [gen, leaving, play]);

  if (!snap) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-ink-muted" role="status">
          {link === "gone" ? "This stall isn't live." : link === "trouble" || link === "reconnecting" ? "Can't read the stall right now. Retrying every few seconds…" : "Opening the desk…"}
        </p>
      </main>
    );
  }

  const item = snap.items.find((i) => i.code === snap.onScreen) ?? null;
  const lines = lineInfo(snap.holds);
  const pad: { hold: SnapshotHold; leaving: boolean }[] = active.map((h) => ({ hold: h, leaving: false }));
  for (const x of [...leaving].sort((a, b) => a.index - b.index)) pad.splice(Math.min(x.index, pad.length), 0, { hold: x.hold, leaving: true });
  const serials = snap.holds.map((h) => h.serial);
  const first = serials.length ? Math.min(...serials) : null;

  return (
    <div className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto] overflow-hidden">
      <Rail snap={snap} link={link} sound={sound} />

      <main className="grid min-h-0 grid-cols-[19rem_minmax(0,1fr)_22rem] max-[1180px]:grid-cols-[17rem_minmax(0,1fr)_19rem]">
        <section aria-labelledby="onscreen" className="min-h-0 overflow-y-auto border-r border-rule px-5 py-5">
          {item ? (
            <>
              <p className="flex items-center gap-2 text-[0.8125rem] font-medium" aria-hidden="true">
                <span className="inline-block size-2 rounded-full bg-serial" />
                On the live now
              </p>
              <h2 id="onscreen" className="mt-2 font-display text-[7.5rem] leading-[0.8] font-black tracking-[-0.04em]">
                <span className="sr-only">On the live now: </span>
                {item.code}
              </h2>
              <p className="mt-3 text-lg leading-tight font-semibold">{item.name}</p>
              <p className="font-mono text-xl font-bold num">{money(item.priceCents)}</p>
              <table className="mt-5 w-full text-[0.875rem] num">
                <caption className="sr-only">Stock for {item.code}</caption>
                <thead>
                  <tr className="text-left">
                    <th scope="col" className="print pb-2">Variant</th>
                    <th scope="col" className="print pb-2 text-right">Left</th>
                    <th scope="col" className="print pb-2 text-right">Held</th>
                    <th scope="col" className="print pb-2 text-right">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {item.variants.map((v) => (
                    <tr key={v.label} className="border-t border-rule">
                      <th scope="row" className="py-2 text-left font-semibold capitalize">{v.label}</th>
                      <td className={`py-2 text-right font-mono font-bold ${v.available === 0 ? "text-serial" : ""}`}>{v.available === 0 ? "out" : v.available}</td>
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
              className="mt-6 flex h-11 w-full items-center justify-between bg-rail px-4 font-display font-extrabold text-rail-ink hover:bg-rail-deep disabled:opacity-60"
            >
              <span>{busy ? "Changing…" : `Next item: ${next}`}</span>
              <kbd className="border border-rail-muted px-1.5 font-mono text-[0.75rem] font-bold">N</kbd>
            </button>
          )}
          {error && (
            <p className="mt-2 text-[0.8125rem] text-serial" role="alert">
              {error}
            </p>
          )}

          <h3 className="print mt-7">Catalog</h3>
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

        <section aria-labelledby="pad" className="flex min-h-0 flex-col overflow-y-auto [overflow-anchor:none]">
          <div className="binding sticky top-0 z-[1] flex items-baseline justify-between gap-4 px-6 py-2.5">
            <h2 id="pad" className="min-w-0 truncate font-display text-[0.9375rem] font-extrabold tracking-[0.04em]">
              {snap.stall.name} · sales invoice pad
            </h2>
            <p className="shrink-0 font-mono text-[0.8125rem] text-rail-muted num">
              <span className="max-[1180px]:hidden">{first !== null ? `${copyNo(first)}–${String(snap.nextSerial - 1).padStart(4, "0")} · ` : ""}</span>next {copyNo(snap.nextSerial)}
            </p>
          </div>

          <div className="px-6 pt-5 pb-8">
            <p className="text-[0.8125rem] text-ink-muted">
              Open copies, soonest to pass first. A hold lasts {Math.round(snap.stall.windowSeconds / 60)}:00{snap.stall.isDemo ? " (demo window)" : ""}.
            </p>
            {pad.length === 0 ? (
              <BlankCopy store={snap.stall.name} serial={snap.nextSerial} stall={snap.stall.id} anyEnded={ended.length > 0} />
            ) : (
              <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-x-4 gap-y-6">
                {pad.map(({ hold: h, leaving: isLeaving }) => (
                  <Copy
                    key={`${isLeaving ? "x" : "o"}${h.id}`}
                    hold={h}
                    now={now}
                    windowSeconds={snap.stall.windowSeconds}
                    size="desk"
                    store={snap.stall.name}
                    nextInLine={h.state === "Holding" ? lines.next(h).handle : null}
                    lineDepth={h.state === "Holding" ? lines.next(h).depth : 0}
                    linePosition={h.state === "Waiting" ? lines.position(h) : null}
                    leaving={isLeaving}
                  />
                ))}
              </div>
            )}

            {ended.length > 0 && (
              <section aria-labelledby="stubs" className="mt-10">
                <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
                  <h3 id="stubs" className="font-display text-base font-extrabold">
                    Torn off
                  </h3>
                  <p className="text-[0.8125rem] text-ink-muted">The stubs left in the booklet, latest first</p>
                </div>
                <ol>
                  {ended.slice(0, 14).map((h) => (
                    <Stub key={h.id} h={h} arrived={arrived.has(h.id)} />
                  ))}
                </ol>
              </section>
            )}
          </div>
        </section>

        <section aria-labelledby="chat" className="min-h-0 overflow-y-auto border-l border-rule px-5 py-5 [overflow-anchor:none]">
          <h2 id="chat" className="font-display text-xl font-extrabold">
            Chat
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-ink-muted">As written, and what Hawker read</p>
          {snap.comments.length === 0 ? (
            <p className="mt-4 text-ink-muted">Comments appear here as buyers type on the stall.</p>
          ) : (
            <ol className="mt-2 divide-y divide-rule">
              {snap.comments.map((c) => (
                <ChatLine key={c.seq} c={c} showSeq compact />
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

function Rail({ snap, link, sound }: { snap: Snapshot; link: LinkState; sound: ReturnType<typeof useStampSound> }) {
  const chips: [string, number, string][] = [
    ["Holding", snap.counters.Holding, "bg-holding text-ink"],
    ["Waiting", snap.counters.Waiting, "bg-waiting text-ink"],
    ["Paid", snap.counters.Paid, "bg-paid text-stamp-paid"],
    ["Passed", snap.counters.Passed, "bg-passed text-passed-ink"],
  ];
  const reader = snap.reader.degraded ? "Fast path only (AI unavailable)" : snap.reader.lastSource ? `Fast path + ${SOURCE[snap.reader.lastSource] ?? snap.reader.lastSource}` : "Fast path + Groq / Gemini";
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-rail px-5 py-3 text-rail-ink">
      <p className="font-display text-lg font-black tracking-[0.16em] uppercase">Hawker</p>
      <p className="text-[0.9375rem] font-semibold">
        {snap.stall.name} · {snap.show.title}
        {snap.stall.isDemo && <span className="ml-2 text-[0.8125rem] font-normal text-rail-muted">demo store · public desk</span>}
      </p>
      <p className="flex items-center gap-2 text-[0.8125rem] text-rail-muted">
        <span className={`inline-block size-2 rounded-full ${link === "live" ? "bg-[#7ee2a1]" : "bg-[#ffb4b4]"}`} aria-hidden="true" />
        {linkLabel(link)}
        <span aria-hidden="true">·</span>
        <span>Reader: {reader}</span>
      </p>
      <div className="ml-auto flex items-center gap-3">
        <ul className="flex gap-2" aria-label="Holds by state">
          {chips.map(([label, n, cls]) => (
            <li
              key={label}
              className={`flex items-baseline gap-2 px-2.5 py-1 ${n === 0 ? "border border-rail-muted/50 text-rail-muted" : cls}`}
            >
              <span className="label">{label}</span>
              <span className="font-mono text-[0.9375rem] font-bold num">{n}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          aria-pressed={sound.enabled}
          onClick={sound.toggle}
          className="flex h-8 items-center gap-1.5 border border-rail-muted/60 px-2.5 text-[0.8125rem] text-rail-ink hover:bg-rail-deep aria-pressed:bg-rail-deep"
          title="A stamp sound when a copy is paid or passed"
        >
          <SpeakerIcon on={sound.enabled} />
          Sound {sound.enabled ? "on" : "off"}
        </button>
      </div>
    </header>
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

/** The empty pad: the next blank copy, already numbered, waiting for a claim. */
function BlankCopy({ store, serial, stall, anyEnded }: { store: string; serial: number; stall: string; anyEnded: boolean }) {
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  return (
    <div className="mt-4 grid max-w-[34rem] gap-4">
      <article className="copy p-5 pt-6" data-state="Paid" aria-label={`Blank copy ${copyNo(serial)}, waiting for a claim`}>
        <header className="flex items-baseline justify-between gap-3">
          <span className="print">{store} · Sales invoice</span>
          <span className="font-mono text-lg font-bold text-serial num">{copyNo(serial)}</span>
        </header>
        <div className="form-rule mt-2" aria-hidden="true" />
        <dl className="fields mt-3 text-ink-muted">
          <dt className="print">Sold to</dt>
          <dd>—</dd>
          <dt className="print">Said</dt>
          <dd>—</dd>
          <dt className="print">Item</dt>
          <dd>—</dd>
          <dt className="print">Amount</dt>
          <dd>—</dd>
        </dl>
      </article>
      <div>
        <p className="font-display text-lg font-extrabold">{anyEnded ? "Nothing open." : "No holds yet."}</p>
        <p className="mt-1 max-w-prose text-ink-muted">
          {anyEnded
            ? "Every copy so far has ended, paid or passed. The next claim from the stall fills this one the moment Hawker reads it."
            : "The first claim from the stall fills this copy the moment Hawker reads it. Open the stall on a phone and tap a variant, or type “mine gold”."}
        </p>
        <p className="mt-2 font-mono text-[0.9375rem] font-bold">{origin ? `${origin}/s/${stall}` : `/s/${stall}`}</p>
      </div>
    </div>
  );
}

function Stub({ h, arrived }: { h: SnapshotHold; arrived: boolean }) {
  const what = h.singleVariant ? `${h.code} ${h.itemName}` : `${h.code} ${h.itemName} — ${h.variant}`;
  return (
    <li className={`${arrived ? "stub " : ""}grid grid-cols-[8.5rem_4.75rem_minmax(0,1fr)_auto] items-center gap-x-4 border-b border-rule py-2.5 text-[0.875rem] max-[1180px]:grid-cols-[7.5rem_minmax(0,1fr)_auto]`}>
      <span className="stamp justify-self-start text-[0.75rem]" data-kind={h.state === "Paid" ? "paid" : "passed"} style={{ rotate: "-3deg" }}>
        {h.state}
        {h.state === "Passed" && h.passedTo && <span className="stamp-to">→ @{h.passedTo}</span>}
      </span>
      <span className="font-mono font-bold text-serial num max-[1180px]:hidden">{copyNo(h.serial)}</span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">@{h.handle}</span>
        <span className="block truncate text-[0.8125rem] text-ink-muted">
          <span className="min-[1181px]:hidden">{copyNo(h.serial)} · </span>
          {what}
          {h.qty > 1 ? ` ×${h.qty}` : ""} · {money(h.priceCents * h.qty)}
        </span>
      </span>
      <span className="text-right font-mono text-[0.75rem] leading-tight text-ink-muted">
        {h.state === "Paid" ? (
          <>
            PayPal txn
            <br />
            <span className="text-ink">{h.transactionId ? shortId(h.transactionId) : "—"}</span>
          </>
        ) : h.endReason === "cancelled" ? (
          "cancelled"
        ) : (
          "time ran out"
        )}
      </span>
    </li>
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
                {h.state === "Paid" ? `txn ${h.transactionId ?? "—"}` : h.passedTo ? `→ @${h.passedTo}` : h.endReason === "cancelled" ? "cancelled" : "expired"}
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
