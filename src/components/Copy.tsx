"use client";
// The signature element (D-012): a numbered carbon copy. Its tint is its state; its countdown edge is
// the exact time left; its ending is a stamp — PAID (read from PayPal) or PASSED → the next buyer.
import type { SnapshotHold } from "@/lib/service/snapshot";
import { copyNo, mmss, money } from "./live";

const shortId = (id: string) => (id.length > 14 ? `${id.slice(0, 9)}…${id.slice(-4)}` : id);

export function Copy({
  hold,
  now,
  windowSeconds,
  variant,
  payable = false,
}: {
  hold: SnapshotHold;
  now: number;
  windowSeconds: number;
  variant: "desk" | "stall";
  payable?: boolean;
}) {
  const left = hold.deadlineAt ? (now ? new Date(hold.deadlineAt).getTime() - now : windowSeconds * 1000) : 0;
  const frac = Math.max(0, Math.min(1, left / (windowSeconds * 1000)));
  const expiring = hold.state === "Holding" && left < 30_000;
  const what = hold.singleVariant ? `${hold.code} ${hold.itemName}` : `${hold.code} ${hold.itemName} — ${hold.variant}`;
  const big = variant === "stall";

  return (
    <article
      className={`copy ${big ? "p-5" : "p-3.5"} text-ink`}
      data-state={hold.state}
      aria-label={`Copy ${copyNo(hold.serial)}, ${hold.state}, ${what}, for @${hold.handle}`}
    >
      <header className="flex items-baseline justify-between gap-3">
        <span className={`font-mono font-bold text-serial num ${big ? "text-lg" : "text-[0.95rem]"}`}>{copyNo(hold.serial)}</span>
        <span className="label text-ink-muted" aria-hidden="true">
          {hold.state}
        </span>
      </header>

      <p className={`mt-2 font-semibold leading-tight ${big ? "text-xl" : "text-[0.95rem]"}`}>@{hold.handle}</p>
      <p className={`mt-0.5 text-ink-muted ${big ? "text-base" : "text-[0.8125rem]"} [overflow-wrap:anywhere]`}>“{hold.said}”</p>

      <div className={`mt-3 flex items-baseline justify-between gap-3 ${big ? "text-base" : "text-[0.875rem]"}`}>
        <span className="font-medium">
          {what}
          {hold.qty > 1 && <span className="num"> ×{hold.qty}</span>}
        </span>
        <span className="font-mono font-bold num">{money(hold.priceCents * hold.qty)}</span>
      </div>

      {hold.state === "Holding" && (
        <div className="mt-3">
          <div className="edge" data-expiring={expiring} role="presentation">
            <i style={{ transform: `scaleX(${frac})` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3 text-[0.8125rem]">
            <span className={`font-mono font-bold num ${expiring ? "text-serial" : ""}`} role="timer" aria-live="off">
              {mmss(left)} to pay
            </span>
            {hold.invoiceId && variant === "desk" && hold.payerLink && (
              <a className="font-mono text-ink-muted underline" href={hold.payerLink} target="_blank" rel="noreferrer">
                {shortId(hold.invoiceId)}
              </a>
            )}
          </div>
          {payable && hold.payerLink && (
            <a
              href={hold.payerLink}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex h-12 items-center justify-center bg-rail px-4 font-display text-base font-extrabold tracking-wide text-rail-ink hover:bg-[#22307a] active:translate-y-px"
            >
              Pay {money(hold.priceCents * hold.qty)} with PayPal
            </a>
          )}
        </div>
      )}

      {hold.state === "Waiting" && <p className="mt-3 text-[0.8125rem] font-medium text-ink-muted">In line. If a hold passes, this copy opens.</p>}

      {hold.state === "Paid" && (
        <div className="mt-3 flex items-end justify-between gap-3">
          <span className={`stamp ${big ? "text-2xl" : "text-lg"}`} data-kind="paid">
            Paid
          </span>
          {hold.transactionId && <span className="font-mono text-[0.75rem] text-ink-muted">txn {shortId(hold.transactionId)}</span>}
        </div>
      )}

      {hold.state === "Passed" && (
        <div className="mt-3 flex items-end justify-between gap-3">
          <span className={`stamp ${big ? "text-xl" : "text-base"}`} data-kind="passed">
            {hold.passedTo ? `Passed → @${hold.passedTo}` : "Passed"}
          </span>
          <span className="text-[0.75rem]">{hold.endReason === "cancelled" ? "cancelled" : "time ran out"}</span>
        </div>
      )}
    </article>
  );
}
