// One read model for the desk and the stall. Every value comes from the database, which mirrors
// PayPal's last read status (rule 1: no mocks). Serialised to the client as JSON.
import { db } from "../db";
import type { HoldState } from "../domain/types";
import { loadStall } from "./catalog";

export interface SnapshotHold {
  id: number;
  serial: number;
  handle: string;
  code: string;
  itemName: string;
  variant: string;
  singleVariant: boolean;
  qty: number;
  priceCents: number;
  state: HoldState;
  said: string;
  deadlineAt: string | null;
  endedAt: string | null;
  endReason: "paid" | "expired" | "cancelled" | null;
  invoiceId: string | null;
  payerLink: string | null;
  invoiceStatus: string | null;
  transactionId: string | null;
  passedTo: string | null;
  buyerId: string;
}

export interface SnapshotComment {
  seq: number;
  handle: string;
  text: string;
  intent: string | null;
  outcome: string | null;
  source: string | null;
  ms: number | null;
  at: string;
  mine: boolean;
}

export interface Snapshot {
  now: string;
  stall: { id: string; name: string; isDemo: boolean; windowSeconds: number };
  show: { id: number; title: string };
  onScreen: string | null;
  items: { code: string; name: string; priceCents: number; variants: { label: string; stock: number; available: number; holding: number; waiting: number }[] }[];
  counters: Record<HoldState, number>;
  holds: SnapshotHold[];
  comments: SnapshotComment[];
  reader: { lastSource: string | null; degraded: boolean };
  me: { buyerId: string; handle: string } | null;
}

export async function getSnapshot(stallId: string, buyerId: string | null = null): Promise<Snapshot | null> {
  const ctx = await loadStall(stallId);
  if (!ctx) return null;
  const sql = db();
  const [usage, holds, comments, counts, me] = await Promise.all([
    sql<{ variant_id: number; used: number; holding: number; waiting: number }[]>`
      select variant_id,
        coalesce(sum(qty) filter (where state in ('Holding', 'Paid')), 0)::int used,
        coalesce(sum(qty) filter (where state = 'Holding'), 0)::int holding,
        count(*) filter (where state = 'Waiting')::int waiting
      from holds where stall_id = ${stallId} group by variant_id`,
    sql<{
      id: string; serial: number; handle: string; buyer_id: string; code: string; item_name: string; label: string; variants: number;
      qty: number; price_cents: number; state: HoldState; said: string; deadline_at: Date | null; ended_at: Date | null;
      end_reason: SnapshotHold["endReason"]; invoice_id: string | null; payer_link: string | null; inv_status: string | null;
      transaction_id: string | null; passed_to: string | null;
    }[]>`
      select h.id, h.serial, b.handle, h.buyer_id, i.code, i.name item_name, v.label,
        (select count(*) from variants v2 where v2.item_id = i.id)::int variants,
        h.qty, i.price_cents, h.state, c.text said, h.deadline_at, h.ended_at, h.end_reason,
        h.invoice_id, inv.payer_link, inv.status inv_status, inv.transaction_id, nb.handle passed_to
      from holds h
      join buyers b on b.id = h.buyer_id
      join variants v on v.id = h.variant_id
      join items i on i.id = v.item_id
      join comments c on c.seq = h.comment_seq
      left join invoices inv on inv.id = h.invoice_id
      left join holds nh on nh.id = h.passed_to_hold_id
      left join buyers nb on nb.id = nh.buyer_id
      where h.stall_id = ${stallId}
        and (h.state in ('Waiting', 'Holding') or h.ended_at > now() - interval '6 hours' or h.buyer_id = ${buyerId})
      order by coalesce(h.ended_at, h.deadline_at, h.waiting_since) desc
      limit 120`,
    sql<{ seq: string; handle: string; buyer_id: string; text: string; intent: string | null; outcome: string | null; parse_source: string | null; parse_ms: number | null; received_at: Date }[]>`
      select c.seq, b.handle, c.buyer_id, c.text, c.intent, c.outcome, c.parse_source, c.parse_ms, c.received_at
      from comments c join buyers b on b.id = c.buyer_id
      where c.show_id = ${ctx.show.id} order by c.seq desc limit 50`,
    sql<{ state: HoldState; n: number }[]>`select state, count(*)::int n from holds where stall_id = ${stallId} group by state`,
    buyerId ? sql<{ id: string; handle: string }[]>`select id, handle from buyers where id = ${buyerId}` : Promise.resolve([]),
  ]);
  const use = new Map(usage.map((u) => [u.variant_id, u]));
  const counters: Record<HoldState, number> = { Waiting: 0, Holding: 0, Paid: 0, Passed: 0 };
  for (const c of counts) counters[c.state] = c.n;
  const lastParsed = comments.find((c) => c.parse_source && c.parse_source !== "fast");
  return {
    now: new Date().toISOString(),
    stall: ctx.stall,
    show: ctx.show,
    onScreen: ctx.onScreenCode,
    items: ctx.catalog.map((i) => ({
      code: i.code,
      name: i.name,
      priceCents: i.priceCents,
      variants: i.variants.map((v) => {
        const u = use.get(v.id);
        return { label: v.label, stock: v.stock, available: v.stock - (u?.used ?? 0), holding: u?.holding ?? 0, waiting: u?.waiting ?? 0 };
      }),
    })),
    counters,
    holds: holds.map((h) => ({
      id: Number(h.id),
      serial: h.serial,
      handle: h.handle,
      buyerId: h.buyer_id,
      code: h.code,
      itemName: h.item_name,
      variant: h.label,
      singleVariant: h.variants === 1,
      qty: h.qty,
      priceCents: h.price_cents,
      state: h.state,
      said: h.said,
      deadlineAt: h.deadline_at?.toISOString() ?? null,
      endedAt: h.ended_at?.toISOString() ?? null,
      endReason: h.end_reason,
      invoiceId: h.invoice_id,
      payerLink: h.payer_link,
      invoiceStatus: h.inv_status,
      transactionId: h.transaction_id,
      passedTo: h.passed_to,
    })),
    comments: comments.map((c) => ({
      seq: Number(c.seq),
      handle: c.handle,
      text: c.text,
      intent: c.intent,
      outcome: c.outcome,
      source: c.parse_source,
      ms: c.parse_ms,
      at: c.received_at.toISOString(),
      mine: c.buyer_id === buyerId,
    })),
    reader: { lastSource: lastParsed?.parse_source ?? null, degraded: lastParsed?.parse_source === "unavailable" },
    me: me[0] ? { buyerId: me[0].id, handle: me[0].handle } : null,
  };
}
