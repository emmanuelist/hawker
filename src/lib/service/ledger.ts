// The hold ledger: every hold on a stall, all-time, with how it ended. Read from the database, which
// mirrors PayPal's last read (rule 1). Amounts are integer cents in the app; `amountUsd` is the
// display boundary for AG Studio, which formats and sums it (all catalog prices are whole dollars).
import { db } from "../db";
import type { HoldState } from "../domain/types";
import { getInvoice } from "../paypal/client";

export interface LedgerRow {
  copy: string;
  serial: number;
  state: HoldState;
  ending: string;
  buyer: string;
  item: string;
  code: string;
  variant: string;
  qty: number;
  amountUsd: number;
  /** The amount if the copy ended Paid / Passed, else 0: lets a chart stack amounts by ending. */
  paidUsd: number;
  passedUsd: number;
  paid: number;
  passed: number;
  open: number;
  passedTo: string | null;
  endReason: string | null;
  invoiceId: string | null;
  invoiceStatus: string | null;
  paypalTxn: string | null;
  said: string;
  via: string;
  readBy: string | null;
  claimedAt: string;
  endedAt: string | null;
  /** When a Holding copy's time runs out; null once it has ended or while it waits. */
  deadlineAt: string | null;
}

const copyNo = (n: number) => `No. ${String(n).padStart(4, "0")}`;

export async function getLedger(stallId: string): Promise<LedgerRow[]> {
  const rows = await db()<{
    serial: number; state: HoldState; handle: string; code: string; item_name: string; label: string; variants: number; qty: number;
    price_cents: number; passed_to: string | null; end_reason: string | null; invoice_id: string | null; inv_status: string | null;
    transaction_id: string | null; said: string; via: string; parse_source: string | null; claimed_at: Date; ended_at: Date | null;
    deadline_at: Date | null;
  }[]>`
    select h.serial, h.state, b.handle, i.code, i.name item_name, v.label,
      (select count(*) from variants v2 where v2.item_id = i.id)::int variants,
      h.qty, i.price_cents, nb.handle passed_to, h.end_reason, h.invoice_id, inv.status inv_status, inv.transaction_id,
      c.text said, c.via, c.parse_source, c.received_at claimed_at, h.ended_at, h.deadline_at
    from holds h
    join buyers b on b.id = h.buyer_id
    join variants v on v.id = h.variant_id
    join items i on i.id = v.item_id
    join comments c on c.seq = h.comment_seq
    left join invoices inv on inv.id = h.invoice_id
    left join holds nh on nh.id = h.passed_to_hold_id
    left join buyers nb on nb.id = nh.buyer_id
    where h.stall_id = ${stallId}
    order by h.serial desc`;
  return rows.map((r) => {
    const cents = r.price_cents * r.qty;
    const ending =
      r.state === "Paid" ? "Paid on PayPal" : r.state === "Passed" ? (r.end_reason === "sold" ? "Passed · sold to a buyer who paid" : r.passed_to ? `Passed → @${r.passed_to}` : "Passed → next buyer") : r.state;
    return {
      copy: copyNo(r.serial),
      serial: r.serial,
      state: r.state,
      ending,
      buyer: `@${r.handle}`,
      item: r.variants === 1 ? `${r.code} ${r.item_name}` : `${r.code} ${r.item_name}, ${r.label}`,
      code: r.code,
      variant: r.label,
      qty: r.qty,
      amountUsd: cents / 100,
      paidUsd: r.state === "Paid" ? cents / 100 : 0,
      passedUsd: r.state === "Passed" ? cents / 100 : 0,
      paid: r.state === "Paid" ? 1 : 0,
      passed: r.state === "Passed" ? 1 : 0,
      open: r.state === "Holding" || r.state === "Waiting" ? 1 : 0,
      passedTo: r.passed_to ? `@${r.passed_to}` : null,
      endReason: r.end_reason,
      invoiceId: r.invoice_id,
      invoiceStatus: r.inv_status,
      paypalTxn: r.transaction_id,
      said: r.said,
      via: r.via,
      readBy: r.parse_source,
      claimedAt: r.claimed_at.toISOString(),
      endedAt: r.ended_at?.toISOString() ?? null,
      deadlineAt: r.state === "Holding" ? (r.deadline_at?.toISOString() ?? null) : null,
    };
  });
}

export interface OwedNow {
  copy: string;
  buyer: string;
  item: string;
  amountUsd: number;
  secondsLeft: number;
  invoiceId: string;
  /** Read from PayPal at request time, not from the database. */
  paypalStatus: string;
  readAt: string;
}

/** Who still owes right now: every Holding hold, each invoice re-read live from PayPal. */
export async function owedNow(stallId: string): Promise<OwedNow[]> {
  const rows = await db()<{ serial: number; handle: string; code: string; item_name: string; label: string; variants: number; qty: number; price_cents: number; invoice_id: string; deadline_at: Date }[]>`
    select h.serial, b.handle, i.code, i.name item_name, v.label, (select count(*) from variants v2 where v2.item_id = i.id)::int variants,
      h.qty, i.price_cents, h.invoice_id, h.deadline_at
    from holds h join buyers b on b.id = h.buyer_id join variants v on v.id = h.variant_id join items i on i.id = v.item_id
    where h.stall_id = ${stallId} and h.state = 'Holding' and h.invoice_id is not null
    order by h.deadline_at`;
  return Promise.all(
    rows.map(async (r) => {
      const inv = await getInvoice(r.invoice_id);
      return {
        copy: copyNo(r.serial),
        buyer: `@${r.handle}`,
        item: r.variants === 1 ? `${r.code} ${r.item_name}` : `${r.code} ${r.item_name}, ${r.label}`,
        amountUsd: (r.price_cents * r.qty) / 100,
        secondsLeft: Math.max(0, Math.round((r.deadline_at.getTime() - Date.now()) / 1000)),
        invoiceId: r.invoice_id,
        paypalStatus: inv.status,
        readAt: new Date().toISOString(),
      };
    }),
  );
}
