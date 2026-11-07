// Read one invoice's status straight from PayPal (the payment authority, rule 12).
// Usage: npx tsx scripts/read-invoice.ts INV2-XXXX-XXXX-XXXX-XXXX
import { getInvoice } from "../src/lib/paypal/client";

try {
  process.loadEnvFile(".env");
} catch {
  /* env may come from the shell */
}

const id = process.argv[2];
if (!id) {
  console.error("usage: tsx scripts/read-invoice.ts <invoice id>");
  process.exit(2);
}
console.log(JSON.stringify(await getInvoice(id), null, 2));
