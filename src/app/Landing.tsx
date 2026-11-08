"use client";
// The landing page (Persuade). Everything on it that looks like data is data: the pad, the chat line,
// the trace and the endings all come from the demo stall's live stream, the same one the desk reads.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SOURCE } from "@/components/ChatLine";
import { ArrowOut, Copy, lineInfo, shortId } from "@/components/Copy";
import { copyNo, money, useLiveSnapshot, useServerNow } from "@/components/live";
import type { Snapshot, SnapshotHold } from "@/lib/service/snapshot";
import { Refusals } from "./Refusals";

const DEMO = "ada";

/** Active invoices on the public page are shown, never linked: a stranger shouldn't pay someone's hold. */
const publicCopy = (h: SnapshotHold): SnapshotHold => (h.state === "Holding" || h.state === "Waiting" ? { ...h, payerLink: null } : h);

export function Landing({ initial = null }: { initial?: Snapshot | null }) {
  const { snap, offset, link } = useLiveSnapshot(DEMO, "desk", 0, initial);
  const now = useServerNow(offset);

  const top = useMemo(() => pickTop(snap), [snap]);
  // A stamp lands on the pad only when the top copy's state changes while the page is open.
  const [prevTop, setPrevTop] = useState(top);
  const [freshId, setFreshId] = useState<number | null>(null);
  if (prevTop !== top) {
    if (top && prevTop && top.id === prevTop.id && top.state !== prevTop.state) setFreshId(top.id);
    setPrevTop(top);
  }

  const paid = snap?.holds.filter((h) => h.state === "Paid") ?? [];
  const passed = snap?.holds.filter((h) => h.state === "Passed") ?? [];

  return (
    <div className="min-h-dvh overflow-x-clip">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-paid focus:px-4 focus:py-3 focus:font-semibold">
        Skip to the page
      </a>
      <Nav />

      <main id="main">
        <section aria-labelledby="claim" className="mx-auto grid max-w-[78rem] grid-cols-[minmax(0,1fr)] items-center gap-x-12 gap-y-10 px-5 pt-10 pb-4 sm:px-8 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-14 xl:grid-cols-[minmax(0,1fr)_32rem] xl:gap-20">
          <div>
            <h1 id="claim" className="font-display text-[2.15rem] leading-[0.98] font-black tracking-[-0.035em] min-[360px]:text-[2.6rem] sm:text-[3.5rem] xl:text-[4.25rem]">
              Every hold ends one of two ways: <span className="text-stamp-paid">paid through PayPal</span>, or <span className="text-stamp-passed">passed to the next buyer</span>.
            </h1>
            <p className="mt-6 max-w-[36rem] text-[1.0625rem] leading-relaxed text-ink-muted sm:text-[1.1875rem]">
              Hawker reads a live-sale chat in English, Pidgin or Taglish, turns each “mine” into a timed hold with its own PayPal invoice, and passes an unpaid hold to the
              next buyer in line.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={`/s/${DEMO}`} className="flex min-h-13 items-center justify-center gap-2.5 bg-rail px-6 py-2 text-center font-display text-[1.0625rem] font-extrabold text-rail-ink hover:bg-rail-deep sm:whitespace-nowrap">
                Claim on the demo stall
                <ArrowRight />
              </Link>
              {/* The desk needs a laptop screen, so a phone gets the stall as its one action. */}
              <Link href="/desk" className="hidden min-h-13 items-center justify-center border border-ink px-6 py-2 text-center font-display text-[1.0625rem] font-extrabold hover:bg-paid sm:flex sm:whitespace-nowrap">
                Watch the desk
              </Link>
            </div>
            <p className="mt-4 text-[0.8125rem] text-ink-muted">PayPal sandbox: no real money moves. Ada&rsquo;s Closet is a demo store with the builder&rsquo;s own catalog.</p>
          </div>

          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <Instrument snap={snap} now={now} top={top} freshId={freshId} paid={paid} passed={passed} link={link} />
          </div>

          <div className="lg:col-start-1 lg:row-start-2 lg:self-start">
            <dl className="grid max-w-[38rem] gap-4 border-t border-rule pt-5 sm:grid-cols-3 sm:gap-6">
              <div>
                <dt className="print">The seller</dt>
                <dd className="mt-1 text-[0.9375rem] leading-snug">Goes live anywhere and pins the stall link.</dd>
              </div>
              <div>
                <dt className="print">Buyers</dt>
                <dd className="mt-1 text-[0.9375rem] leading-snug">Claim on the stall, then pay on PayPal.</dd>
              </div>
              <div>
                <dt className="print">A helper</dt>
                <dd className="mt-1 text-[0.9375rem] leading-snug">Watches every hold on the desk.</dd>
              </div>
            </dl>
          </div>
        </section>

        <Trace snap={snap} />

        <Endings snap={snap} now={now} paid={paid[0] ?? null} passed={passed[0] ?? null} />

        <Refusals stall={DEMO} />

        <Proof snap={snap} paid={paid} />
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[78rem] flex-col gap-3 px-5 py-8 text-[0.875rem] text-ink-muted sm:flex-row sm:items-baseline sm:justify-between sm:px-8">
          <p>
            <span className="font-display font-black tracking-[0.16em] text-ink uppercase">Hawker</span> · Every hold ends one of two ways: paid through PayPal, or passed to the
            next buyer.
          </p>
          <p>Built for the PayPal AI Hackathon, 2026.</p>
        </div>
      </footer>
    </div>
  );
}

function pickTop(snap: Snapshot | null): SnapshotHold | null {
  if (!snap) return null;
  const holding = snap.holds.filter((h) => h.state === "Holding").sort((a, b) => (a.deadlineAt ?? "").localeCompare(b.deadlineAt ?? ""));
  if (holding[0]) return holding[0];
  // Nothing live: replay the latest copy a model read (the AI at work), else the latest ending.
  if (snap.showcase) return snap.showcase;
  const ended = snap.holds.filter((h) => h.state === "Paid" || h.state === "Passed").sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""));
  return ended.find((h) => h.state === "Passed" && h.passedTo) ?? ended.find((h) => h.state === "Paid") ?? ended[0] ?? null;
}

/** "just now", "12 min ago", "3 h ago", "2 days ago": how long ago the replayed copy ended. */
function ago(mins: number): string {
  if (mins === 0) return "just now";
  if (mins < 90) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 36 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

/** What Hawker understood from the comment, in the catalog's words: "A3 · black" or "A2 · M × 2". */
function understood(h: SnapshotHold): string {
  return `${h.code}${h.singleVariant ? "" : ` · ${h.variant}`}${h.qty > 1 ? ` × ${h.qty}` : ""}`;
}

/** The reader in plain words: the regex fast path, or the model that read it. */
function readerName(source: string): string {
  if (source === "groq") return "read by the model (Groq Qwen)";
  if (source === "gemini") return "read by the model (Gemini)";
  if (source === "fast") return "fast path, no model needed";
  return SOURCE[source] ?? source;
}

const REPLAY_MS = 2800;
const BASE = 1_000_000_000_000; // any fixed instant: the replay's clock only needs to move forward

/** When nothing is live, play the top copy's real ending once, sped up and labelled as a replay
 *  (PRODUCT.md principle 5), so the stamp lands within seconds. Skipped for reduced motion. */
function useReplay(top: SnapshotHold | null) {
  const endedId = top && (top.state === "Paid" || top.state === "Passed") ? top.id : null;
  const [phase, setPhase] = useState<{ id: number | null; progress: number | null }>({ id: null, progress: null });
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (endedId === null) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let iv: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(
      () => {
        if (reduced) {
          setPhase({ id: endedId, progress: 1 });
          return;
        }
        const t0 = performance.now();
        setPhase({ id: endedId, progress: 0 });
        iv = setInterval(() => {
          const p = Math.min(1, (performance.now() - t0) / REPLAY_MS);
          setPhase({ id: endedId, progress: p });
          if (p >= 1 && iv) clearInterval(iv);
        }, 80);
      },
      reduced ? 0 : 500,
    );
    return () => {
      clearTimeout(start);
      if (iv) clearInterval(iv);
    };
  }, [endedId, round]);
  const progress = endedId !== null ? (phase.id === endedId ? phase.progress : 0) : null;
  return { progress, landed: progress === 1, again: () => setRound((r) => r + 1) };
}

function Nav() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex h-16 max-w-[78rem] items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="flex min-h-11 items-center font-display text-lg font-black tracking-[0.18em] uppercase">
          Hawker
        </Link>
        <nav aria-label="Page" className="flex items-center gap-6 text-[0.9375rem]">
          <a href="#how" className="hidden min-h-11 items-center hover:underline md:inline-flex">
            How a hold ends
          </a>
          <a href="#refusals" className="hidden min-h-11 items-center hover:underline md:inline-flex">
            Try to break it
          </a>
          <a href="#proof" className="hidden min-h-11 items-center hover:underline lg:inline-flex">
            Check it yourself
          </a>
          <Link href="/desk" className="hidden min-h-11 items-center hover:underline sm:inline-flex">
            Desk
          </Link>
          <Link href="/ledger" className="hidden min-h-11 items-center hover:underline sm:inline-flex">
            Ledger
          </Link>
          <Link href={`/s/${DEMO}`} className="flex h-11 items-center bg-ink px-4 font-display font-extrabold text-white hover:bg-black">
            Demo stall
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Instrument({
  snap,
  now,
  top,
  freshId,
  paid,
  passed,
  link,
}: {
  snap: Snapshot | null;
  now: number;
  top: SnapshotHold | null;
  freshId: number | null;
  paid: SnapshotHold[];
  passed: SnapshotHold[];
  link: string;
}) {
  const lines = snap ? lineInfo(snap.holds) : null;
  const replay = useReplay(top);
  const replaying = replay.progress !== null && !replay.landed && snap && top;
  const shown: SnapshotHold | null =
    snap && top && replaying ? { ...top, state: "Holding", deadlineAt: new Date(BASE + snap.stall.windowSeconds * 1000).toISOString(), payerLink: null } : top;
  const shownNow = snap && replaying ? BASE + (replay.progress ?? 0) * snap.stall.windowSeconds * 1000 : now;
  const minsAgo = top?.endedAt && now ? Math.max(0, Math.round((now - new Date(top.endedAt).getTime()) / 60000)) : null;
  return (
    <figure aria-label="The demo stall, live" className="m-0">
      <div className="flex items-start gap-4">
        <span className="print shrink-0 pt-1">Chat in</span>
        {/* Always the comment that made the copy below, so the chain from chat to copy is one copy. */}
        {top ? (
          <p className="min-w-0 text-[0.9375rem] leading-snug">
            <span className="font-semibold">@{top.handle}</span>{" "}
            <span className="text-[1.0625rem] font-medium [overflow-wrap:anywhere]">“{top.said}”</span>
            {top.saidVia === "tap" && <span className="print ml-1.5 text-ink-muted">tapped</span>}
            <span className="mt-0.5 block text-[0.8125rem] text-ink-muted">
              <span className="print">Read</span> {understood(top)}
              {top.readBy && (
                <>
                  {" · "}
                  {readerName(top.readBy)}
                  {top.readMs ? `, ${(top.readMs / 1000).toFixed(1)} s` : ""}
                </>
              )}
            </span>
          </p>
        ) : (
          <p className="text-[0.9375rem] text-ink-muted">—</p>
        )}
      </div>

      <Leader />

      <div className="binding flex items-baseline justify-between gap-3 px-4 py-2">
        <span className="min-w-0 truncate font-display text-[0.875rem] font-extrabold tracking-[0.04em]">{snap?.stall.name ?? "Ada's Closet"} · invoice pad</span>
        <span className="flex shrink-0 items-center gap-1.5 text-[0.75rem] text-rail-muted">
          {replay.progress !== null ? (
            "replay · sped up"
          ) : (
            <>
              <span className={`inline-block size-1.5 rounded-full ${link === "live" ? "bg-[#7ee2a1]" : "bg-[#ffb4b4]"}`} aria-hidden="true" />
              {link === "live" ? "live" : "connecting"}
            </>
          )}
        </span>
      </div>
      <div className="pad-stack mb-3.5">
        {snap && shown ? (
          <Copy
            key={shown.id}
            hold={publicCopy(shown)}
            now={shownNow}
            windowSeconds={snap.stall.windowSeconds}
            size="hero"
            store={snap.stall.name}
            nextInLine={replaying ? (top?.passedTo ?? null) : shown.state === "Holding" && lines ? lines.next(shown).handle : null}
            lineDepth={replaying ? (top?.passedTo ? 1 : 0) : shown.state === "Holding" && lines ? lines.next(shown).depth : 0}
            fresh={freshId === shown.id || replay.landed}
            showInvoice
          />
        ) : (
          <div className="copy p-8" data-state="Paid" style={{ animation: "none" }}>
            <p className="print">{snap ? "Waiting for the first claim" : "Sales invoice"}</p>
            <p className="mt-3 text-ink-muted">{snap ? "Claim something on the demo stall and the copy lands here." : "—"}</p>
          </div>
        )}
      </div>
      {replay.progress !== null && top && (
        <p className="mt-3 mb-1 flex items-baseline justify-between gap-3 text-[0.8125rem] text-ink-muted">
          <span>
            Replay of copy {copyNo(top.serial)}
            {minsAgo !== null ? `, which ended ${ago(minsAgo)}` : ""}. Live copies show here as they happen.
          </span>
          {replay.landed && (
            <button type="button" onClick={replay.again} className="-my-3 min-h-11 shrink-0 px-1 font-semibold text-print underline">
              Replay
            </button>
          )}
        </p>
      )}

      <Leader />

      <figcaption className="grid grid-cols-2 gap-6">
        <div>
          <p className="flex items-baseline justify-between gap-3">
            <span className="stamp text-[0.8125rem]" data-kind="paid" style={{ rotate: "-3deg" }}>
              Paid
            </span>
            <span className="font-mono text-2xl font-bold num">{snap ? snap.counters.Paid : "–"}</span>
          </p>
          <p className="mt-1.5 text-[0.8125rem] leading-snug text-ink-muted">
            {paid[0] ? (
              <>
                Last: {copyNo(paid[0].serial)}, txn <span className="font-mono text-ink">{shortId(paid[0].transactionId ?? "—")}</span>
              </>
            ) : (
              "Read from PayPal."
            )}
          </p>
        </div>
        <div>
          <p className="flex items-baseline justify-between gap-3">
            <span className="stamp text-[0.8125rem]" data-kind="passed" style={{ rotate: "-3deg" }}>
              Passed
            </span>
            <span className="font-mono text-2xl font-bold num">{snap ? snap.counters.Passed : "–"}</span>
          </p>
          <p className="mt-1.5 text-[0.8125rem] leading-snug text-ink-muted">
            {passed[0] ? `Last: ${copyNo(passed[0].serial)}, ${passed[0].passedTo ? `to @${passed[0].passedTo}` : "open to the next buyer"}` : "To the next buyer in line."}
          </p>
        </div>
      </figcaption>
    </figure>
  );
}

function Leader() {
  return (
    <div className="flex h-7 flex-col items-center" aria-hidden="true">
      <span className="w-0 flex-1 border-l border-dashed border-print/60" />
      <svg className="-mt-0.5 size-2.5 text-print" viewBox="0 0 10 10" fill="currentColor">
        <path d="M0 0h10L5 10z" />
      </svg>
    </div>
  );
}

function ArrowRight() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M2.5 8h10M8.5 4l4 4-4 4" strokeLinecap="square" />
    </svg>
  );
}

function Trace({ snap }: { snap: Snapshot | null }) {
  // The latest copy a model read, traced from the comment to its ending; else the latest ending.
  const latest = snap?.holds.filter((x) => x.state === "Paid" || x.state === "Passed").sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""))[0] ?? null;
  const h = snap?.showcase ?? latest;
  const what = h ? (h.singleVariant ? `${h.code} ${h.itemName}` : `${h.code} ${h.itemName} — ${h.variant}`) : "";
  return (
    <section id="how" aria-labelledby="how-title" className="mt-20 border-y border-rule bg-board-deep/60 sm:mt-28">
      <div className="mx-auto max-w-[78rem] px-5 py-14 sm:px-8 sm:py-20">
        <h2 id="how-title" className="max-w-[40rem] font-display text-[2rem] leading-[1.02] font-black tracking-[-0.025em] sm:text-[2.75rem]">
          How a hold ends
        </h2>
        <p className="mt-3 max-w-[40rem] text-[1.0625rem] leading-relaxed text-ink-muted">
          {h ? (
            <>
              Traced from the demo stall: copy <span className="font-mono font-bold text-serial">{copyNo(h.serial)}</span>,{" "}
              {snap?.showcase && h.id === snap.showcase.id ? "the latest copy a model read." : "the most recent copy to end."}
            </>
          ) : (
            "Traced live from the demo stall once a copy has ended."
          )}
        </p>
        <ol className="mt-10 grid gap-y-10 lg:grid-cols-4 lg:gap-x-0">
          <Beat title="A buyer types it the way they would on the live" n={1}>
            {h ? (
              <>
                <p className="text-[0.875rem] font-semibold">@{h.handle}</p>
                <p className="mt-1 text-xl leading-snug font-medium [overflow-wrap:anywhere]">“{h.said}”</p>
                {h.saidVia === "tap" && <p className="print mt-1 text-ink-muted">tapped on the stall</p>}
              </>
            ) : (
              <Pending />
            )}
          </Beat>
          <Beat title="A model reads what they meant. Code decides who holds it" n={2}>
            {h ? (
              <>
                <p className="print">Understood</p>
                <p className="mt-1 font-mono text-lg font-bold">{understood(h)}</p>
                <p className="mt-1 text-[0.9375rem]">
                  {h.readBy ? `${readerName(h.readBy)}${h.readMs ? `, ${(h.readMs / 1000).toFixed(1)} s` : ""}` : "Read on arrival"}
                </p>
                <p className="mt-2 text-[0.9375rem] leading-snug text-ink-muted">Checked against the catalog, then granted in the order comments arrived.</p>
              </>
            ) : (
              <Pending />
            )}
          </Beat>
          <Beat title="One PayPal invoice, one timer" n={3}>
            {h && snap ? (
              <>
                <p className="font-medium">{what}</p>
                <p className="mt-1 font-mono text-[0.9375rem]">
                  {money(h.priceCents * h.qty)} · {h.invoiceId ? shortId(h.invoiceId) : "invoice"}
                </p>
                <p className="mt-2 text-[0.9375rem] leading-snug text-ink-muted">
                  {Math.round(snap.stall.windowSeconds / 60)}:00 to pay{snap.stall.isDemo ? " (demo window)" : ""}, no partial payments.
                </p>
              </>
            ) : (
              <Pending />
            )}
          </Beat>
          <Beat title="It ends one of two ways" n={4} last>
            {h ? (
              h.state === "Paid" ? (
                <>
                  <span className="stamp text-xl" data-kind="paid">
                    Paid
                  </span>
                  <p className="mt-3 text-[0.9375rem] leading-snug text-ink-muted">
                    Read from PayPal: txn <span className="font-mono text-ink">{shortId(h.transactionId ?? "—")}</span>
                  </p>
                </>
              ) : (
                <>
                  <span className="stamp text-lg" data-kind="passed">
                    Passed
                    {h.passedTo && <span className="stamp-to">→ @{h.passedTo}</span>}
                  </span>
                  <p className="mt-3 text-[0.9375rem] leading-snug text-ink-muted">
                    {h.passedTo ? `@${h.passedTo} now holds it, with a new invoice.` : h.endReason === "cancelled" ? "The buyer released it; it's open to the next buyer who claims." : "Time ran out with no one in line; it's open to the next buyer who claims."}
                  </p>
                </>
              )
            ) : (
              <Pending />
            )}
          </Beat>
        </ol>
      </div>
    </section>
  );
}

function Beat({ title, n, last = false, children }: { title: string; n: number; last?: boolean; children: React.ReactNode }) {
  return (
    <li className={`relative lg:pr-8 ${last ? "" : "lg:border-r lg:border-rule"} ${n > 1 ? "lg:pl-8" : ""}`}>
      <h3 className="font-display text-[1.0625rem] leading-snug font-extrabold">{title}</h3>
      <div className="mt-4">{children}</div>
    </li>
  );
}

function Pending() {
  return <p className="text-ink-muted">—</p>;
}

function Endings({ snap, now, paid, passed }: { snap: Snapshot | null; now: number; paid: SnapshotHold | null; passed: SnapshotHold | null }) {
  return (
    <section aria-labelledby="endings" className="bg-rail text-rail-ink">
      <div className="mx-auto grid max-w-[78rem] gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
        <div>
          <h2 id="endings" className="font-display text-[2rem] leading-[1.02] font-black tracking-[-0.025em] sm:text-[2.75rem]">
            Two endings. No third.
          </h2>
          <dl className="mt-8 grid gap-6 text-[1.0625rem] leading-relaxed">
            <div>
              <dt className="font-display font-extrabold">Paid only when PayPal says so.</dt>
              <dd className="mt-1 text-rail-muted">Hawker reads each invoice&rsquo;s status from PayPal. There is no mark-as-paid button and no seller override.</dd>
            </div>
            <div>
              <dt className="font-display font-extrabold">Read again before anything passes.</dt>
              <dd className="mt-1 text-rail-muted">
                When the timer runs out, Hawker asks PayPal first. A paid invoice can&rsquo;t be cancelled: PayPal refuses with <span className="font-mono text-rail-ink">CANNOT_CANCEL_PAID_INVOICE</span>.
              </dd>
            </div>
            <div>
              <dt className="font-display font-extrabold">Nothing else to end in.</dt>
              <dd className="mt-1 text-rail-muted">The database accepts only Waiting, Holding, Paid and Passed, and refuses any change to a hold that has ended.</dd>
            </div>
          </dl>
        </div>
        <div className="grid content-start gap-8 sm:grid-cols-2 sm:gap-6" style={{ ["--perf-bg" as string]: "var(--rail)" }}>
          {snap && paid ? (
            <Copy hold={paid} now={now} windowSeconds={snap.stall.windowSeconds} size="stall" store={snap.stall.name} />
          ) : (
            <EmptyEnding kind="Paid" />
          )}
          {snap && passed ? (
            <Copy hold={passed} now={now} windowSeconds={snap.stall.windowSeconds} size="stall" store={snap.stall.name} />
          ) : (
            <EmptyEnding kind="Passed" />
          )}
        </div>
      </div>
    </section>
  );
}

function EmptyEnding({ kind }: { kind: "Paid" | "Passed" }) {
  return (
    <div className="border border-dashed border-rail-muted/60 p-6 text-rail-muted">
      <p className="font-display font-extrabold text-rail-ink">{kind}</p>
      <p className="mt-1 text-[0.9375rem]">The latest {kind.toLowerCase()} copy from the demo stall appears here.</p>
    </div>
  );
}

function Proof({ snap, paid }: { snap: Snapshot | null; paid: SnapshotHold[] }) {
  const lastPaid = paid.find((h) => h.payerLink) ?? null;
  return (
    <section id="proof" aria-labelledby="proof-title" className="mx-auto max-w-[78rem] px-5 py-16 sm:px-8 sm:py-24">
      <h2 id="proof-title" className="font-display text-[2rem] leading-[1.02] font-black tracking-[-0.025em] sm:text-[2.75rem]">
        Check it yourself
      </h2>
      <p className="mt-3 max-w-[40rem] text-[1.0625rem] leading-relaxed text-ink-muted">Nothing here is a mock-up. Each of these opens the real thing.</p>
      <ul className="mt-10 grid border-t border-rule md:grid-cols-3">
        <ProofItem
          title="A paid invoice, on PayPal"
          body={
            lastPaid
              ? `${copyNo(lastPaid.serial)} for @${lastPaid.handle}: PayPal's own invoice page, marked paid. Transaction ${lastPaid.transactionId ?? ""}.`
              : "The latest paid copy's invoice opens on PayPal's own page once one exists."
          }
          href={lastPaid?.payerLink ?? undefined}
          action="Open on PayPal (sandbox)"
          external
        />
        <ProofItem
          title="Claim, then watch it end"
          body={`Claim on the demo stall from your phone, then watch the desk: ${snap ? `${snap.counters.Paid} paid and ${snap.counters.Passed} passed so far` : "every copy"}, each with its stamp.`}
          href={`/s/${DEMO}`}
          action="Claim on the demo stall"
        />
        <ProofItem title="The running build" body="The service reports the exact commit it runs and how long it has been up." href="/api/health" action="Open /api/health" />
      </ul>
      <p className="mt-10 text-[0.875rem] text-ink-muted">
        PayPal Invoicing API (sandbox) · Groq <span className="font-mono">qwen/qwen3.8-27b</span>, failing over to Gemini <span className="font-mono">gemini-3.5-flash-lite</span> · Neon Postgres ·
        Render
      </p>
    </section>
  );
}

function ProofItem({ title, body, href, action, external = false }: { title: string; body: string; href?: string; action: string; external?: boolean }) {
  return (
    <li className="border-b border-rule py-6 md:border-r md:border-b-0 md:px-6 md:py-8 md:first:pl-0 md:last:border-r-0">
      <h3 className="font-display text-lg font-extrabold">{title}</h3>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted [overflow-wrap:anywhere]">{body}</p>
      {href ? (
        external ? (
          <a href={href} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1.5 font-semibold text-print underline">
            {action}
            <ArrowOut className="size-3.5" />
          </a>
        ) : (
          <Link href={href} className="mt-2 inline-flex min-h-11 items-center gap-1.5 font-semibold text-print underline">
            {action}
          </Link>
        )
      ) : null}
    </li>
  );
}
