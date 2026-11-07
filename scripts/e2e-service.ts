// End-to-end check of the service layer against the real database and PayPal sandbox, on a separate
// test stall ("e2e") so the demo store stays clean. Exercises: hold, wait, expiry → pass → promote,
// cancel, and the model path. Usage: npm run e2e:service
import { db } from "../src/lib/db";
import { endHolding, submitComment } from "../src/lib/service/holds";
import { getInvoice } from "../src/lib/paypal/client";

try {
  process.loadEnvFile(".env");
} catch {
  /* env may come from the shell */
}

const STALL = "e2e";

async function setup() {
  const sql = db();
  await sql.begin(async (tx) => {
    await tx`insert into stalls (id, name, payment_window_seconds, is_demo) values (${STALL}, 'E2E test stall', 60, true)
             on conflict (id) do nothing`;
    const [item] = await tx<{ id: number }[]>`
      insert into items (stall_id, code, name, price_cents, position) values (${STALL}, 'T1', 'Test tote', 1500, 0)
      on conflict (stall_id, code) do update set name = excluded.name returning id`;
    await tx`insert into variants (item_id, label, stock) values (${item.id}, 'one size', 1)
             on conflict (item_id, label) do update set stock = 1`;
    await tx`update shows set status = 'ended' where stall_id = ${STALL} and status = 'live'`;
    await tx`insert into shows (stall_id, title, on_screen_item_id) values (${STALL}, ${`E2E ${new Date().toISOString()}`}, ${item.id})`;
  });
  const buyer = async (handle: string) => {
    const [b] = await sql<{ id: string }[]>`
      insert into buyers (stall_id, handle, device_hash) values (${STALL}, ${handle}, 'e2e')
      on conflict (stall_id, handle) do update set handle = excluded.handle returning id`;
    return b.id;
  };
  return { alpha: await buyer("e2e_alpha"), beta: await buyer("e2e_beta") };
}

const holdOf = async (seq: number) =>
  (await db()<{ id: string; state: string; invoice_id: string | null; passed_to_hold_id: string | null; serial: number }[]>`
    select id, state, invoice_id, passed_to_hold_id, serial from holds where comment_seq = ${seq}`)[0];

const holdById = async (id: string | number) =>
  (await db()<{ id: string; state: string; invoice_id: string | null; end_reason: string | null }[]>`
    select id, state, invoice_id, end_reason from holds where id = ${id}`)[0];

function check(label: string, ok: boolean, detail: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`, JSON.stringify(detail));
  if (!ok) process.exitCode = 1;
}

async function main() {
  const { alpha, beta } = await setup();

  const c1 = await submitComment(STALL, alpha, "mine");
  const h1 = await holdOf(c1.seq);
  check("alpha 'mine' → Holding with a PayPal invoice (fast path)", h1?.state === "Holding" && !!h1.invoice_id && c1.source === "fast", { c1, h1 });

  const c2 = await submitComment(STALL, beta, "I go take am abeg 🙏🏾");
  const h2 = await holdOf(c2.seq);
  check("beta Pidgin claim (model path) → Waiting behind alpha", h2?.state === "Waiting" && c2.source !== "fast", { c2, h2 });

  const r = await endHolding(STALL, Number(h1.id), "expired");
  const h1b = await holdById(h1.id);
  const h2b = await holdById(h2.id);
  const passedTo = (await holdOf(c1.seq)).passed_to_hold_id;
  check("alpha's hold expires → Passed (expired), re-read from PayPal first", r === "passed" && h1b.state === "Passed" && h1b.end_reason === "expired", { r, h1b });
  check("beta promoted → Holding with a new invoice; alpha passed_to = beta", h2b.state === "Holding" && !!h2b.invoice_id && passedTo === h2.id, { h2b, passedTo });

  const inv1 = await getInvoice(h1.invoice_id!);
  check("alpha's invoice is CANCELLED at PayPal", inv1.status === "CANCELLED", { id: inv1.id, status: inv1.status });

  const c3 = await submitComment(STALL, beta, "cancel");
  const h2c = await holdById(h2.id);
  check("beta 'cancel' → Passed (cancelled)", h2c.state === "Passed" && h2c.end_reason === "cancelled", { c3, h2c });
  const inv2 = await getInvoice(h2b.invoice_id!);
  check("beta's invoice is CANCELLED at PayPal", inv2.status === "CANCELLED", { id: inv2.id, status: inv2.status });

  const c4 = await submitComment(STALL, alpha, "red");
  check("a bare word holds nothing (unclear)", c4.intent === "unclear", c4);

  const ended = await db()<{ state: string; n: number }[]>`
    select state, count(*)::int n from holds where stall_id = ${STALL} and show_id = (select max(id) from shows where stall_id = ${STALL}) group by state`;
  check("this run ended with no third state", ended.every((e) => ["Paid", "Passed"].includes(e.state)), ended);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db().end());
