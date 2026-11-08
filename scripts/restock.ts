// The seller restocks: add units of one variant, as a seller who has more on the rail would. Paid units
// never come back (D-024), so a demo store that judges pay for shrinks; this is how it grows again.
// Holds, payments and the ledger are untouched. The running app picks the new stock up within 30 s
// (catalog cache). Usage: npm run restock -- <item code> <variant> <units to add> [stall id, default ada]
import postgres from "postgres";

try {
  process.loadEnvFile(".env");
} catch {
  /* env may come from the shell */
}

async function main() {
  const [code, variant, addArg, stallId = "ada"] = process.argv.slice(2);
  const add = Number(addArg);
  if (!code || !variant || !Number.isInteger(add) || add < 1 || add > 50) {
    throw new Error("Usage: npm run restock -- <item code> <variant> <units to add, 1-50> [stall]");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = postgres(url, { max: 1, prepare: false, onnotice: false });
  try {
    const r = await sql.begin(async (tx) => {
      const [v] = await tx<{ id: number; stock: number; label: string; code: string }[]>`
        update variants v set stock = v.stock + ${add}
        from items i
        where v.item_id = i.id and i.stall_id = ${stallId} and upper(i.code) = upper(${code}) and lower(v.label) = lower(${variant})
        returning v.id, v.stock, v.label, i.code`;
      if (!v) throw new Error(`No variant "${variant}" of ${code} on ${stallId}.`);
      const [u] = await tx<{ paid: number; used: number }[]>`
        select coalesce(sum(qty) filter (where state = 'Paid'), 0)::int paid,
               coalesce(sum(qty) filter (where state in ('Holding', 'Paid')), 0)::int used
        from holds where variant_id = ${v.id}`;
      await tx`insert into events (stall_id, kind, payload)
               values (${stallId}, 'catalog.restock', ${tx.json({ code: v.code, variant: v.label, added: add, stock: v.stock })})`;
      return { ...v, sellable: v.stock - u.paid, available: v.stock - u.used };
    });
    console.log(`${r.code} ${r.label}: +${add} → stock ${r.stock} (still sellable ${r.sellable}, free now ${r.available}) on ${stallId}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
