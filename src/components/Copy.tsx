"use client";
// The signature element (D-012): a numbered carbon copy of a printed sales-invoice form. The print
// (letterhead, field labels) is carbon blue; what's filled in is ink. Its tint is its state, its
// countdown edge is the exact time left, and its ending is a stamp: PAID (read from PayPal) or
// PASSED → the next buyer. Under a Holding copy sit the blue copies of the buyers waiting behind it.
import type { SnapshotHold } from "@/lib/service/snapshot";
import { Countdown } from "./Countdown";
import { copyNo, money } from "./live";

export const shortId = (id: string) => (id.length > 14 ? `${id.slice(0, 9)}…${id.slice(-4)}` : id);

export type CopySize = "desk" | "stall" | "hero";

const S = {
  desk: { pad: "p-3.5 pt-4", text: "text-[0.875rem]", serial: "text-[0.95rem]", stampPaid: "text-lg", stampPassed: "text-base", handle: "text-[0.9375rem]" },
  stall: { pad: "p-5 pt-6", text: "text-base", serial: "text-lg", stampPaid: "text-3xl", stampPassed: "text-2xl", handle: "text-lg" },
  hero: { pad: "p-6 pt-7 sm:p-8 sm:pt-9", text: "text-[1.0625rem]", serial: "text-xl", stampPaid: "text-4xl", stampPassed: "text-3xl", handle: "text-xl" },
} as const;

export function Copy({
  hold,
  now,
  windowSeconds,
  size,
  store,
  payable = false,
  nextInLine = null,
  lineDepth = 0,
  linePosition = null,
  fresh = false,
  leaving = false,
  celebrate = false,
  showInvoice = size !== "stall",
  onRelease,
  releasing = false,
}: {
  hold: SnapshotHold;
  now: number;
  windowSeconds: number;
  size: CopySize;
  store: string;
  payable?: boolean;
  /** Handle of the next buyer waiting for the same item and variant, if any. */
  nextInLine?: string | null;
  /** How many buyers wait behind this copy (drawn as sheets under it, at most 3). */
  lineDepth?: number;
  /** A Waiting copy's place in its line, 1-based. */
  linePosition?: number | null;
  /** The state changed while this page watched: the stamp lands. */
  fresh?: boolean;
  /** The copy is leaving the pad: stamp, then tear-off (Passed) or file-away (Paid). */
  leaving?: boolean;
  celebrate?: boolean;
  showInvoice?: boolean;
  /** The buyer's own copy: release a hold or leave the line (posts a named cancel through the chat). */
  onRelease?: () => void;
  releasing?: boolean;
}) {
  const s = S[size];
  const left = hold.deadlineAt ? (now ? new Date(hold.deadlineAt).getTime() - now : windowSeconds * 1000) : 0;
  const frac = Math.max(0, Math.min(1, left / (windowSeconds * 1000)));
  const expiring = hold.state === "Holding" && now > 0 && left < 30_000;
  const what = hold.singleVariant ? `${hold.code} ${hold.itemName}` : `${hold.code} ${hold.itemName} — ${hold.variant}`;
  const amount = money(hold.priceCents * hold.qty);

  return (
    <article
      className={`copy ${s.pad} ${s.text} text-ink`}
      data-state={hold.state}
      data-line={hold.state === "Holding" && lineDepth > 0 ? Math.min(3, lineDepth) : undefined}
      data-fresh={fresh || undefined}
      data-leaving={leaving ? hold.state : undefined}
      data-celebrate={celebrate || undefined}
      aria-label={`Copy ${copyNo(hold.serial)}, ${hold.state}, ${what}, ${amount}, for @${hold.handle}`}
    >
      <header className="flex items-baseline justify-between gap-3">
        <span className="print min-w-0 truncate">
          {store}
          {size !== "desk" && " · Invoice"}
        </span>
        <span className={`shrink-0 font-mono font-bold text-serial num ${s.serial}`}>{copyNo(hold.serial)}</span>
      </header>
      <div className="form-rule mt-2" aria-hidden="true" />

      <dl className="fields mt-2.5">
        <dt className="print">Sold to</dt>
        <dd className={`font-semibold leading-tight ${s.handle}`}>@{hold.handle}</dd>
        <dt className="print">Said</dt>
        <dd className="leading-snug">
          “{hold.said}”
          {hold.saidVia === "tap" && <span className="print ml-2 align-[0.1em] text-ink-muted">tapped</span>}
        </dd>
        <dt className="print">Item</dt>
        <dd className="font-medium leading-snug">
          {what}
          {hold.qty > 1 && <span className="num"> ×{hold.qty}</span>}
        </dd>
        <dt className="print">Amount</dt>
        <dd className="font-mono font-bold num">{amount}</dd>
      </dl>

      {hold.state === "Holding" && (
        <div className="mt-3.5">
          <div className="edge" data-expiring={expiring} role="presentation">
            <i style={{ transform: `scaleX(${frac})` }} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="flex items-center gap-2">
              <span className="label text-ink">Holding</span>
              <Countdown ms={left} tone={expiring ? "expiring" : "ink"} size={size === "desk" ? "sm" : "md"} />
              <span className={expiring ? "font-semibold text-serial" : "text-ink-muted"}>to pay</span>
            </p>
            {showInvoice && hold.invoiceId && (
              <span className="shrink-0 font-mono text-[0.75rem] text-ink-muted">
                {hold.payerLink ? (
                  <a className="underline" href={hold.payerLink} target="_blank" rel="noreferrer" aria-label={`PayPal invoice ${hold.invoiceId}`}>
                    {shortId(hold.invoiceId)}
                  </a>
                ) : (
                  shortId(hold.invoiceId)
                )}
              </span>
            )}
          </div>
          {(nextInLine || expiring) && (
            <p className={`mt-1 ${expiring ? "font-semibold text-serial" : "text-ink-muted"} text-[0.8125rem]`}>
              {nextInLine ? (
                <>
                  Next in line: <span className="font-semibold text-ink">@{nextInLine}</span>
                </>
              ) : (
                "No one waiting yet: it opens to the next buyer"
              )}
            </p>
          )}
          {payable && hold.payerLink && (
            <a
              href={hold.payerLink}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex h-13 items-center justify-between gap-3 bg-rail px-5 text-rail-ink hover:bg-rail-deep active:translate-y-px"
            >
              <span className="font-display text-base font-extrabold tracking-wide">Pay {amount} with PayPal</span>
              <ArrowOut />
            </a>
          )}
        </div>
      )}

      {hold.state === "Waiting" && (
        <p className="mt-3.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="label text-ink">Waiting</span>
          <span className="text-ink-muted">
            {linePosition ? `No. ${linePosition} in line. ` : "In line. "}If the hold before you passes, this copy opens.
          </span>
        </p>
      )}

      {onRelease && (hold.state === "Holding" || hold.state === "Waiting") && (
        <p className="mt-3 text-right">
          <button type="button" onClick={onRelease} disabled={releasing} className="text-[0.875rem] text-ink-muted underline hover:text-ink disabled:no-underline">
            {releasing ? "Releasing…" : hold.state === "Holding" ? "Release this copy" : "Leave the line"}
          </button>
        </p>
      )}

      {hold.state === "Paid" && (
        <div className="mt-4 flex items-end justify-between gap-3">
          <span className={`stamp ${celebrate ? "" : s.stampPaid}`} data-kind="paid">
            Paid
          </span>
          {hold.transactionId && (
            <span className="text-right font-mono text-[0.75rem] leading-tight text-ink-muted">
              PayPal txn
              <br />
              <span className="text-ink">{size === "desk" ? shortId(hold.transactionId) : hold.transactionId}</span>
            </span>
          )}
        </div>
      )}

      {hold.state === "Passed" && (
        <div className="mt-4 flex items-end justify-between gap-3">
          <span className={`stamp ${s.stampPassed}`} data-kind="passed">
            Passed
            <span className="stamp-to">{hold.passedTo ? `→ @${hold.passedTo}` : "→ next buyer"}</span>
          </span>
          <span className="text-right text-[0.75rem]">{hold.endReason === "cancelled" ? "Cancelled by the buyer" : "Time ran out"}</span>
        </div>
      )}
    </article>
  );
}

export function ArrowOut({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M5 11 11 5M6 5h5v5" strokeLinecap="square" />
    </svg>
  );
}

/** For each Holding copy: who waits next on the same item and variant, and how many wait. For each
 *  Waiting copy: its place in line. Strict FIFO by serial, the same order the engine promotes in. */
export function lineInfo(holds: SnapshotHold[]) {
  const lines = new Map<string, SnapshotHold[]>();
  for (const h of holds) {
    if (h.state !== "Waiting") continue;
    const k = `${h.code}|${h.variant}`;
    if (!lines.has(k)) lines.set(k, []);
    lines.get(k)!.push(h);
  }
  for (const l of lines.values()) l.sort((a, b) => a.serial - b.serial);
  return {
    next(h: SnapshotHold) {
      const l = lines.get(`${h.code}|${h.variant}`) ?? [];
      return { handle: l[0]?.handle ?? null, depth: l.length };
    },
    position(h: SnapshotHold) {
      const l = lines.get(`${h.code}|${h.variant}`) ?? [];
      const i = l.findIndex((x) => x.id === h.id);
      return i >= 0 ? i + 1 : null;
    },
  };
}
