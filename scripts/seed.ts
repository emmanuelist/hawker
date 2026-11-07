// Seed the demo store (labelled as a demo everywhere it renders; PRODUCT.md "Evidence on Hand").
// Idempotent: re-running restores stock and opens a fresh live show only if none is live.
// Usage: npm run db:seed
import postgres from "postgres";

try {
  process.loadEnvFile(".env");
} catch {
  /* env may come from the shell */
}

const STALL = { id: "ada", name: "Ada's Closet", windowSeconds: 180 };
const ITEMS: { code: string; name: string; priceCents: number; variants: [string, number][] }[] = [
  { code: "A1", name: "Ankara wrap dress", priceCents: 3500, variants: [["S", 3], ["M", 2], ["L", 2]] },
  { code: "A2", name: "Adire two-piece set", priceCents: 4800, variants: [["M", 2], ["L", 2], ["XL", 1]] },
  { code: "A3", name: "Beaded clutch", priceCents: 2200, variants: [["red", 2], ["gold", 1], ["black", 3]] },
  { code: "A4", name: "Headwrap", priceCents: 1200, variants: [["blue", 4], ["wine", 3]] },
  { code: "A5", name: "Aso-oke stole", priceCents: 4000, variants: [["one size", 2]] },
  { code: "A6", name: "Ankara bucket hat", priceCents: 1800, variants: [["one size", 5]] },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = postgres(url, { max: 1, prepare: false, onnotice: false });
  try {
    await sql.begin(async (tx) => {
      await tx`insert into stalls (id, name, payment_window_seconds, is_demo)
               values (${STALL.id}, ${STALL.name}, ${STALL.windowSeconds}, true)
               on conflict (id) do update set name = excluded.name, payment_window_seconds = excluded.payment_window_seconds`;
      for (const [position, item] of ITEMS.entries()) {
        const [row] = await tx<{ id: number }[]>`
          insert into items (stall_id, code, name, price_cents, position)
          values (${STALL.id}, ${item.code}, ${item.name}, ${item.priceCents}, ${position})
          on conflict (stall_id, code) do update set name = excluded.name, price_cents = excluded.price_cents, position = excluded.position
          returning id`;
        for (const [label, stock] of item.variants) {
          await tx`insert into variants (item_id, label, stock) values (${row.id}, ${label}, ${stock})
                   on conflict (item_id, label) do update set stock = excluded.stock`;
        }
      }
      const live = await tx`select id from shows where stall_id = ${STALL.id} and status = 'live'`;
      if (live.length === 0) {
        const [a3] = await tx<{ id: number }[]>`select id from items where stall_id = ${STALL.id} and code = 'A3'`;
        await tx`insert into shows (stall_id, title, on_screen_item_id) values (${STALL.id}, 'Friday Live', ${a3.id})`;
      }
    });
    const counts = await sql`select (select count(*) from items) items, (select count(*) from variants) variants, (select count(*) from shows where status='live') live_shows`;
    console.log("seeded", counts[0]);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
