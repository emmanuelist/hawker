// "Every way out, refused": each forbidden ending, attempted for real against a real copy on the
// stall, with the refusal in the refuser's own words. PayPal attempts are real API calls on real
// sandbox invoices (refusal codes verified in T-15, E-011, E-012); database attempts run in a
// transaction that is always rolled back (guards in db/migrations/001 and 003). A probe counts as
// refused only when the refusal is the expected one: any other error is reported as an error.
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { db } from "../db";
import { cancelInvoice, getInvoice } from "../paypal/client";

export const PROBE_IDS = ["cancel-paid", "cancel-twice", "pay-passed-late", "pass-paid", "pay-passed", "end-twice", "erase", "third-state", "no-invoice"] as const;
export type ProbeId = (typeof PROBE_IDS)[number];
export const isProbeId = (s: string): s is ProbeId => (PROBE_IDS as readonly string[]).includes(s);

export interface ProbeResult {
  probe: ProbeId;
  by: "PayPal" | "Database";
  /** refused: the expected refusal came back. accepted: the system allowed it (a database attempt is still rolled back). error: something else went wrong. */
  outcome: "refused" | "accepted" | "error";
  /** The refuser's code: PayPal's status and issue, or the database guard's name. */
  code: string;
  /** The refuser's message, verbatim. */
  message: string;
  copy: string | null;
  invoiceId: string | null;
  /** PayPal's status read before and after the attempt. */
  before?: string;
  after?: string;
  paidUsd?: string;
  payerLink?: string | null;
  debugId?: string | null;
  at: string;
  ms: number;
}

interface Target {
  id: string;
  serial: number;
  invoice_id: string | null;
}

const copyNo = (n: number) => `No. ${String(n).padStart(4, "0")}`;

async function latest(stallId: string, state: "Paid" | "Passed"): Promise<Target | null> {
  const [t] = await db()<Target[]>`
    select id, serial, invoice_id from holds
    where stall_id = ${stallId} and state = ${state} and invoice_id is not null
    order by serial desc limit 1`;
  return t ?? null;
}

class Accepted extends Error {}

/** Run one write in a transaction that never commits. */
async function rolledBack(write: (tx: postgres.TransactionSql) => Promise<unknown>) {
  try {
    await db().begin(async (tx) => {
      await write(tx);
      throw new Accepted();
    });
  } catch (e) {
    if (e instanceof Accepted) return { kind: "accepted" as const };
    if (e instanceof postgres.PostgresError) return { kind: "refused" as const, error: e };
    throw e;
  }
  return { kind: "accepted" as const };
}

/** The guard's name: a trigger's message prefix ("hold_ended: …") or the check constraint's name. */
export function guardName(e: { message: string; constraint_name?: string }): string {
  if (e.constraint_name) return e.constraint_name;
  const m = /^([a-z_]+):/.exec(e.message);
  return m ? m[1] : e.message;
}

async function databaseProbe(stallId: string, probe: ProbeId): Promise<Omit<ProbeResult, "at" | "ms">> {
  const base = { probe, by: "Database" as const };
  const plan: Record<string, { on: "Paid" | "Passed"; expect: string; write: (tx: postgres.TransactionSql, t: Target) => Promise<unknown> }> = {
    "pass-paid": { on: "Paid", expect: "hold_ended", write: (tx, t) => tx`update holds set state = 'Passed', end_reason = 'expired' where id = ${t.id}` },
    "pay-passed": { on: "Passed", expect: "hold_ended", write: (tx, t) => tx`update holds set state = 'Paid', end_reason = 'paid' where id = ${t.id}` },
    "end-twice": { on: "Passed", expect: "hold_ended", write: (tx, t) => tx`update holds set ended_at = now(), end_reason = 'cancelled' where id = ${t.id}` },
    erase: { on: "Paid", expect: "hold_ended", write: (tx, t) => tx`delete from holds where id = ${t.id}` },
    "third-state": {
      on: "Paid",
      expect: "holds_state_check",
      write: (tx, t) => tx`
        insert into holds (serial, stall_id, show_id, buyer_id, variant_id, qty, comment_seq, state)
        select (select max(serial) + 1 from holds where stall_id = ${stallId}), stall_id, show_id, buyer_id, variant_id, 1, comment_seq, 'Returned'
        from holds where id = ${t.id}`,
    },
    "no-invoice": {
      on: "Paid",
      expect: "holds_check",
      write: (tx, t) => tx`
        insert into holds (serial, stall_id, show_id, buyer_id, variant_id, qty, comment_seq, state, holding_since, deadline_at)
        select (select max(serial) + 1 from holds where stall_id = ${stallId}), stall_id, show_id, buyer_id, variant_id, 1, comment_seq, 'Holding', now(), now() + interval '3 minutes'
        from holds where id = ${t.id}`,
    },
  };
  const p = plan[probe];
  const t = await latest(stallId, p.on);
  if (!t) return { ...base, outcome: "error", code: "no_target", message: "The stall has no copy with that ending yet.", copy: null, invoiceId: null };
  const r = await rolledBack((tx) => p.write(tx, t));
  const where = { copy: copyNo(t.serial), invoiceId: t.invoice_id };
  if (r.kind === "accepted") return { ...base, ...where, outcome: "accepted", code: "accepted", message: "The database accepted the write. It was rolled back." };
  const code = guardName(r.error);
  return { ...base, ...where, outcome: code === p.expect ? "refused" : "error", code, message: r.error.message };
}

async function paypalProbe(stallId: string, probe: "cancel-paid" | "cancel-twice" | "pay-passed-late"): Promise<Omit<ProbeResult, "at" | "ms">> {
  const want = probe === "cancel-paid" ? "PAID" : "CANCELLED";
  const t = await latest(stallId, probe === "cancel-paid" ? "Paid" : "Passed");
  const base = { probe, by: "PayPal" as const };
  if (!t?.invoice_id) return { ...base, outcome: "error", code: "no_target", message: "The stall has no copy with that ending yet.", copy: null, invoiceId: null };
  const where = { copy: copyNo(t.serial), invoiceId: t.invoice_id };
  const before = await getInvoice(t.invoice_id);
  const paidUsd = (before.paidCents / 100).toFixed(2);
  if (before.status !== want) {
    return { ...base, ...where, outcome: "error", code: before.status, message: `PayPal reads this invoice ${before.status}, not ${want}, so the attempt doesn't apply.`, before: before.status, paidUsd };
  }
  if (probe === "pay-passed-late") {
    // Paying happens in PayPal's own checkout, so this is a live read plus the invoice's pay page for anyone to try (T-17, E-017).
    const refused = before.paidCents === 0;
    return {
      ...base,
      ...where,
      outcome: refused ? "refused" : "error",
      code: before.status,
      message: refused ? `PayPal reads the invoice ${before.status} with $${paidUsd} paid. Its pay page refuses payment.` : `PayPal reads $${paidUsd} paid on a cancelled invoice.`,
      before: before.status,
      paidUsd,
      payerLink: before.payerLink,
    };
  }
  // A fresh PayPal-Request-Id each time, so PayPal answers a new attempt rather than replaying an old one.
  const attempt = await cancelInvoice(t.invoice_id, "Hawker refusal probe: PayPal is expected to refuse this cancel.", `probe-${randomUUID()}`);
  const after = await getInvoice(t.invoice_id);
  if (attempt.cancelled) {
    return { ...base, ...where, outcome: "accepted", code: "CANCELLED", message: "PayPal accepted the cancel.", before: before.status, after: after.status, paidUsd };
  }
  const e = attempt.error;
  const issue = e?.issue ?? e?.name ?? "REFUSED";
  const expected = probe === "cancel-paid" ? "CANNOT_CANCEL_PAID_INVOICE" : "INVOICE_CANCELED_ALREADY";
  return {
    ...base,
    ...where,
    outcome: issue === expected ? "refused" : "error",
    code: `${e?.status ?? ""} ${issue}`.trim(),
    message: e?.message ?? "PayPal refused.",
    before: before.status,
    after: after.status,
    paidUsd: (after.paidCents / 100).toFixed(2),
    debugId: e?.debugId ?? null,
  };
}

export async function runProbe(stallId: string, probe: ProbeId): Promise<ProbeResult> {
  const started = Date.now();
  const r = probe === "cancel-paid" || probe === "cancel-twice" || probe === "pay-passed-late" ? await paypalProbe(stallId, probe) : await databaseProbe(stallId, probe);
  return { ...r, at: new Date().toISOString(), ms: Date.now() - started };
}
