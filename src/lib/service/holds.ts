// The hold lifecycle. Parsing runs concurrently; every state change runs inside the stall's serial
// queue (runtime.serial), so holds are granted in chat-arrival order. PayPal is the authority for
// payment (B1): an ending always re-reads the invoice, and PAID wins every race.
import { db } from "../db";
import { decideClaim, decideEnding, nextInLine, resolveRef } from "../domain/engine";
import type { ClarifyReason, ParsedComment } from "../domain/types";
import { ModelUnavailableError } from "../ai/client";
import { fastParse } from "../parse/fast";
import { modelParse } from "../parse/model";
import { cancelInvoice, createShareableInvoice, getInvoice, PayPalError, type InvoiceRead } from "../paypal/client";
import { loadStall, type StallContext } from "./catalog";
import { publish, rt, serial } from "./runtime";

type Source = "fast" | "groq" | "gemini" | "unavailable";
interface Parsed { parsed: ParsedComment | null; source: Source; ms: number }

export interface CommentResult {
  seq: number;
  intent: string | null;
  outcome: string | null;
  source: Source;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const copyNo = (n: number) => `No. ${String(n).padStart(4, "0")}`;

async function event(stallId: string, kind: string, holdId: number | null, payload: Record<string, unknown>) {
  await db()`insert into events (stall_id, kind, hold_id, payload) values (${stallId}, ${kind}, ${holdId}, ${db().json(payload as never)})`;
}

function clarifyText(r: ClarifyReason): string {
  switch (r.kind) {
    case "unknown_item":
      return `There's no ${r.code} in this stall.`;
    case "which_variant":
      return `Which one for ${r.code}? ${r.options.join(", ")}.`;
    case "variant_unavailable":
      return `${r.code} doesn't come in ${r.asked} — ${r.options.join(", ")}?`;
  }
}

async function parseOne(ctx: StallContext, seq: number, text: string): Promise<Parsed> {
  const onScreen = ctx.catalog.find((i) => i.code === ctx.onScreenCode) ?? null;
  const fast = fastParse(text, onScreen, ctx.catalog);
  if (fast) return { parsed: fast, source: "fast", ms: 0 };
  try {
    const r = await modelParse(ctx.catalog, [{ i: 0, onScreen: ctx.onScreenCode, comment: text }], `c${seq}`);
    return { parsed: r.parsed.get(0) ?? null, source: r.provider, ms: r.ms };
  } catch (e) {
    if (e instanceof ModelUnavailableError) return { parsed: null, source: "unavailable", ms: 0 };
    throw e;
  }
}

/** A buyer's comment: persisted at once (arrival order = seq), parsed, then applied in order. */
export async function submitComment(stallId: string, buyerId: string, text: string, via: "typed" | "tap" = "typed"): Promise<CommentResult> {
  const ctx = await loadStall(stallId);
  if (!ctx) throw new Error(`no live show for stall ${stallId}`);
  const [c] = await db()<{ seq: string }[]>`
    insert into comments (show_id, buyer_id, text, on_screen_code, via)
    values (${ctx.show.id}, ${buyerId}, ${text}, ${ctx.onScreenCode}, ${via}) returning seq`;
  const seq = Number(c.seq);
  publish(stallId);
  const parsing = parseOne(ctx, seq, text);
  return serial(stallId, async () => apply(stallId, buyerId, seq, await parsing));
}

async function apply(stallId: string, buyerId: string, seq: number, p: Parsed): Promise<CommentResult> {
  const ctx = (await loadStall(stallId))!;
  const outcomes: string[] = [];
  const intent = p.parsed?.intent ?? null;
  if (!p.parsed) {
    outcomes.push("Hawker couldn't read that right now. Try “mine gold”.");
  } else if (intent === "claim") {
    for (const ref of p.parsed.items.slice(0, 3)) {
      const r = resolveRef(ctx.catalog, ref);
      if (!r.ok) outcomes.push(clarifyText(r.reason));
      else outcomes.push(await claimOne(ctx, buyerId, seq, r.variantId, r.qty));
    }
    if (p.parsed.items.length === 0) outcomes.push("Which item? Try “mine gold”.");
  } else if (intent === "cancel") {
    outcomes.push(await cancelFor(ctx, buyerId, p.parsed));
  } else if (intent === "unclear") {
    outcomes.push("Did you mean to claim it? Say “mine” with the size or colour.");
  } else if (intent === "question") {
    outcomes.push("Question for the seller.");
  }
  const outcome = outcomes.length ? outcomes.join(" ") : null;
  await db()`update comments set intent = ${intent}, parsed = ${p.parsed ? db().json(p.parsed as never) : null},
             parse_source = ${p.source}, parse_ms = ${p.ms}, outcome = ${outcome} where seq = ${seq}`;
  publish(stallId);
  return { seq, intent, outcome, source: p.source };
}

async function nextSerial(stallId: string): Promise<number> {
  const [r] = await db()<{ n: number }[]>`select coalesce(max(serial), 0)::int + 1 as n from holds where stall_id = ${stallId}`;
  return r.n;
}

async function variantState(variantId: number, buyerId: string | null) {
  const [r] = await db()<{ stock: number; used: number; waiting: number; mine: boolean | null }[]>`
    select v.stock,
      coalesce(sum(h.qty) filter (where h.state in ('Holding', 'Paid')), 0)::int as used,
      count(h.id) filter (where h.state = 'Waiting')::int as waiting,
      bool_or(h.buyer_id = ${buyerId} and h.state in ('Waiting', 'Holding')) as mine
    from variants v left join holds h on h.variant_id = v.id
    where v.id = ${variantId} group by v.stock`;
  return { available: r.stock - r.used, waiting: r.waiting, mine: !!r.mine };
}

function lineFor(ctx: StallContext, variantId: number) {
  for (const item of ctx.catalog) {
    const v = item.variants.find((x) => x.id === variantId);
    if (v) return { item, label: v.label, name: item.variants.length === 1 ? `${item.code} ${item.name}` : `${item.code} ${item.name} — ${v.label}` };
  }
  throw new Error(`variant ${variantId} not in catalog`);
}

async function openInvoice(ctx: StallContext, serialNo: number, handle: string, variantId: number, qty: number, attempt: string) {
  const { item, name } = lineFor(ctx, variantId);
  return createShareableInvoice({
    lines: [{ name, qty, unitCents: item.priceCents }],
    note: `Hawker copy ${copyNo(serialNo)} for @${handle} · ${ctx.stall.name}${ctx.stall.isDemo ? " (demo store)" : ""}`,
    reference: `hawker:${ctx.stall.id}:${serialNo}`,
    idempotencyKey: `hawker-${ctx.stall.id}-${serialNo}-${attempt}`,
  }).then((inv) => ({ ...inv, totalCents: item.priceCents * qty }));
}

async function handleOf(buyerId: string): Promise<string> {
  const [b] = await db()<{ handle: string }[]>`select handle from buyers where id = ${buyerId}`;
  return b.handle;
}

async function claimOne(ctx: StallContext, buyerId: string, seq: number, variantId: number, qty: number): Promise<string> {
  const { name } = lineFor(ctx, variantId);
  const s = await variantState(variantId, buyerId);
  const decision = decideClaim({ available: s.available, qty, buyerAlreadyActiveOnVariant: s.mine, waitingAhead: s.waiting });
  if (decision === "duplicate") return `You already have ${name}.`;
  const serialNo = await nextSerial(ctx.stall.id);
  if (decision === "wait") {
    const [h] = await db()<{ id: string }[]>`
      insert into holds (serial, stall_id, show_id, buyer_id, variant_id, qty, comment_seq, state)
      values (${serialNo}, ${ctx.stall.id}, ${ctx.show.id}, ${buyerId}, ${variantId}, ${qty}, ${seq}, 'Waiting') returning id`;
    await event(ctx.stall.id, "hold.waiting", Number(h.id), { serial: serialNo, position: s.waiting + 1 });
    return `In line for ${name} (#${s.waiting + 1}). If a hold passes, it's yours.`;
  }
  let inv: Awaited<ReturnType<typeof openInvoice>>;
  try {
    inv = await openInvoice(ctx, serialNo, await handleOf(buyerId), variantId, qty, "open");
  } catch (e) {
    const msg = e instanceof PayPalError ? `${e.name}${e.issue ? `/${e.issue}` : ""}` : (e as Error).message;
    await event(ctx.stall.id, "invoice.failed", null, { serial: serialNo, error: msg.slice(0, 200) });
    return `PayPal didn't open an invoice just now (${msg.slice(0, 60)}). Nothing was held — try again.`;
  }
  const holdId = await db().begin(async (tx) => {
    await tx`insert into invoices (id, payer_link, status, total_cents) values (${inv.id}, ${inv.payerLink}, 'UNPAID', ${inv.totalCents})`;
    const [h] = await tx<{ id: string }[]>`
      insert into holds (serial, stall_id, show_id, buyer_id, variant_id, qty, comment_seq, state, invoice_id, holding_since, deadline_at)
      values (${serialNo}, ${ctx.stall.id}, ${ctx.show.id}, ${buyerId}, ${variantId}, ${qty}, ${seq}, 'Holding', ${inv.id}, now(),
              now() + make_interval(secs => ${ctx.stall.windowSeconds}))
      returning id`;
    return Number(h.id);
  });
  rt.deadlines.set(holdId, { stallId: ctx.stall.id, at: Date.now() + ctx.stall.windowSeconds * 1000 });
  await event(ctx.stall.id, "hold.holding", holdId, { serial: serialNo, invoice: inv.id, debugId: inv.debugId });
  return `Held: ${name}. Copy ${copyNo(serialNo)}. Pay within ${mmss(ctx.stall.windowSeconds)}.`;
}

interface HoldRow { id: string; serial: number; stall_id: string; variant_id: number; buyer_id: string; state: string; invoice_id: string | null }

async function markPaid(stallId: string, h: HoldRow, inv: InvoiceRead) {
  await db().begin(async (tx) => {
    await tx`update invoices set status = ${inv.status}, transaction_id = ${inv.transactionId}, last_read_at = now() where id = ${inv.id}`;
    await tx`update holds set state = 'Paid', end_reason = 'paid', ended_at = now() where id = ${h.id} and state = 'Holding'`;
  });
  rt.deadlines.delete(Number(h.id));
  await event(stallId, "hold.paid", Number(h.id), { serial: h.serial, invoice: inv.id, transaction: inv.transactionId });
}

/** Promote the head of the line for a variant, if its whole quantity now fits. Returns the new holder's hold id. */
async function promote(ctx: StallContext, variantId: number): Promise<number | null> {
  const waiting = await db()<{ id: string; qty: number; comment_seq: string; serial: number; buyer_id: string }[]>`
    select id, qty, comment_seq, serial, buyer_id from holds where variant_id = ${variantId} and state = 'Waiting'`;
  const s = await variantState(variantId, null);
  const head = nextInLine(waiting.map((w) => ({ ...w, seq: Number(w.comment_seq) })), s.available);
  if (!head) return null;
  let inv: Awaited<ReturnType<typeof openInvoice>>;
  try {
    inv = await openInvoice(ctx, head.serial, await handleOf(head.buyer_id), variantId, head.qty, `promote-${Date.now()}`);
  } catch (e) {
    await event(ctx.stall.id, "invoice.failed", Number(head.id), { serial: head.serial, error: (e as Error).message.slice(0, 200) });
    return null;
  }
  await db().begin(async (tx) => {
    await tx`insert into invoices (id, payer_link, status, total_cents) values (${inv.id}, ${inv.payerLink}, 'UNPAID', ${inv.totalCents})`;
    await tx`update holds set state = 'Holding', invoice_id = ${inv.id}, holding_since = now(),
             deadline_at = now() + make_interval(secs => ${ctx.stall.windowSeconds}) where id = ${head.id} and state = 'Waiting'`;
  });
  rt.deadlines.set(Number(head.id), { stallId: ctx.stall.id, at: Date.now() + ctx.stall.windowSeconds * 1000 });
  await event(ctx.stall.id, "hold.holding", Number(head.id), { serial: head.serial, invoice: inv.id, promoted: true });
  return Number(head.id);
}

/**
 * End a Holding hold that expired or was cancelled. B1: re-read PayPal first; PAID is never passed,
 * and if PayPal refuses the cancel because it was just paid, the hold ends Paid.
 */
export async function endHolding(stallId: string, holdId: number, reason: "expired" | "cancelled"): Promise<"paid" | "passed" | "skipped"> {
  const [h] = await db()<HoldRow[]>`select id, serial, stall_id, variant_id, buyer_id, state, invoice_id from holds where id = ${holdId}`;
  if (!h || h.state !== "Holding" || !h.invoice_id) {
    rt.deadlines.delete(holdId);
    return "skipped";
  }
  const inv = await getInvoice(h.invoice_id);
  if (decideEnding(inv.status) === "paid") {
    await markPaid(stallId, h, inv);
    publish(stallId);
    return "paid";
  }
  const note = reason === "expired" ? "Payment window passed; offered to the next buyer." : "Cancelled by the buyer; offered to the next buyer.";
  const c = await cancelInvoice(h.invoice_id, note, `hawker-${stallId}-${h.serial}-end`);
  if (!c.cancelled) {
    const again = await getInvoice(h.invoice_id);
    if (decideEnding(again.status) === "paid") {
      await markPaid(stallId, h, again);
      await event(stallId, "refused.pass_paid", holdId, { serial: h.serial, paypal: c.error?.issue ?? c.error?.name ?? null });
      publish(stallId);
      return "paid";
    }
    if (again.status !== "CANCELLED") {
      // Neither paid nor cancellable: keep Holding and retry shortly rather than invent an ending.
      rt.deadlines.set(holdId, { stallId, at: Date.now() + 15000 });
      await event(stallId, "end.retry", holdId, { serial: h.serial, status: again.status, paypal: c.error?.issue ?? null });
      return "skipped";
    }
  }
  const ctx = (await loadStall(stallId))!;
  await db().begin(async (tx) => {
    await tx`update invoices set status = 'CANCELLED', last_read_at = now() where id = ${h.invoice_id}`;
    await tx`update holds set state = 'Passed', end_reason = ${reason}, ended_at = now() where id = ${h.id} and state = 'Holding'`;
  });
  rt.deadlines.delete(holdId);
  const next = await promote(ctx, h.variant_id);
  if (next) await db()`update holds set passed_to_hold_id = ${next} where id = ${h.id}`;
  await event(stallId, "hold.passed", holdId, { serial: h.serial, reason, invoice: h.invoice_id, passedTo: next });
  publish(stallId);
  return "passed";
}

async function cancelFor(ctx: StallContext, buyerId: string, parsed: ParsedComment): Promise<string> {
  let variantIds: number[] | null = null;
  if (parsed.items.length) {
    variantIds = [];
    for (const ref of parsed.items) {
      const item = ctx.catalog.find((i) => i.code.toLowerCase() === ref.code.toLowerCase());
      if (!item) continue;
      const r = resolveRef(ctx.catalog, ref);
      variantIds.push(...(r.ok ? [r.variantId] : item.variants.map((v) => v.id)));
    }
  }
  const active = await db()<HoldRow[]>`
    select id, serial, stall_id, variant_id, buyer_id, state, invoice_id from holds
    where stall_id = ${ctx.stall.id} and buyer_id = ${buyerId} and state in ('Waiting', 'Holding')
    order by comment_seq desc`;
  const target = active.find((h) => !variantIds || variantIds.includes(h.variant_id));
  if (!target) return "Nothing of yours to cancel.";
  const { name } = lineFor(ctx, target.variant_id);
  if (target.state === "Waiting") {
    await db()`update holds set state = 'Passed', end_reason = 'cancelled', ended_at = now() where id = ${target.id} and state = 'Waiting'`;
    await event(ctx.stall.id, "hold.passed", Number(target.id), { serial: target.serial, reason: "cancelled", fromLine: true });
    return `You left the line for ${name}.`;
  }
  const r = await endHolding(ctx.stall.id, Number(target.id), "cancelled");
  if (r === "paid") return `${name} is already paid, so it's yours.`;
  if (r === "passed") return `Cancelled: ${name} passed to the next buyer.`;
  return `Still checking PayPal for ${name}.`;
}

/**
 * Called by the scheduler while holds are open. PayPal reads happen outside the stall queue so they
 * never delay a buyer's claim; only a PAID result enters the queue to end its hold (still B1-safe:
 * markPaid only moves a hold that is still Holding).
 */
export async function pollPayments(stallId: string): Promise<void> {
  const open = await db()<HoldRow[]>`
    select id, serial, stall_id, variant_id, buyer_id, state, invoice_id from holds where stall_id = ${stallId} and state = 'Holding'`;
  for (const h of open) {
    if (!h.invoice_id) continue;
    try {
      const inv = await getInvoice(h.invoice_id);
      if (decideEnding(inv.status) === "paid") {
        await serial(stallId, async () => {
          const [still] = await db()<HoldRow[]>`select id, serial, stall_id, variant_id, buyer_id, state, invoice_id from holds where id = ${h.id}`;
          if (still?.state !== "Holding") return;
          await markPaid(stallId, still, inv);
          publish(stallId);
        });
      } else if (inv.status !== "UNPAID") {
        await db()`update invoices set status = ${inv.status}, last_read_at = now() where id = ${inv.id}`;
      }
    } catch (e) {
      console.error(JSON.stringify({ scope: "poll", hold: h.id, error: (e as Error).message.slice(0, 200) }));
    }
  }
}
