// Live sandbox check of the app's own PayPal client: create + send a shareable invoice, read it,
// cancel it (the Passed path), read it again, then try to cancel it twice (must be refused).
// Usage: npm run sandbox:invoice
import { cancelInvoice, createShareableInvoice, getInvoice } from "../src/lib/paypal/client";

try {
  process.loadEnvFile(".env");
} catch {
  /* env may come from the shell */
}

async function main() {
  const key = `hawker-check-${Date.now()}`;
  const created = await createShareableInvoice({
    lines: [{ name: "A3 Beaded clutch — gold", qty: 1, unitCents: 2200 }],
    note: "Hawker sandbox check: copy No. 0000 for @check",
    reference: "hawker:check:0000",
    idempotencyKey: key,
  });
  console.log("created+sent", created);
  const before = await getInvoice(created.id);
  console.log("read", before);
  const cancel = await cancelInvoice(created.id, "Payment window passed; offered to the next buyer.", key);
  console.log("cancel", cancel);
  const after = await getInvoice(created.id);
  console.log("read after cancel", { id: after.id, status: after.status });
  const again = await cancelInvoice(created.id, "second cancel", `${key}-2`);
  console.log("second cancel (must be refused)", { cancelled: again.cancelled, name: again.error?.name, issue: again.error?.issue, debugId: again.error?.debugId });
  if (before.status !== "UNPAID" && before.status !== "SENT") throw new Error(`unexpected status after send: ${before.status}`);
  if (after.status !== "CANCELLED") throw new Error(`expected CANCELLED, got ${after.status}`);
  if (again.cancelled) throw new Error("a second cancel was accepted");
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
