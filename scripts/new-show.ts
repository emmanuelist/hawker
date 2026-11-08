// The seller goes live again: end the stall's live show and open a new one with an item on screen.
// Holds, payments and the ledger are untouched (they belong to the stall); the stall's chat and the
// desk's stubs start fresh for the new show. The running app picks it up within 30 s (catalog cache).
// Usage: npm run show:new -- "<title>" <item code> [stall id, default ada]
import postgres from "postgres";

try {
  process.loadEnvFile(".env");
} catch {
  /* env may come from the shell */
}

async function main() {
  const [title, code, stallId = "ada"] = process.argv.slice(2);
  if (!title || !code) throw new Error('Usage: npm run show:new -- "<title>" <item code> [stall]');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = postgres(url, { max: 1, prepare: false, onnotice: false });
  try {
    const open = await sql`select count(*)::int n from holds where stall_id = ${stallId} and state in ('Waiting', 'Holding')`;
    if (open[0].n > 0) throw new Error(`${open[0].n} copies are still Waiting or Holding on ${stallId}; let them end first.`);
    const show = await sql.begin(async (tx) => {
      const [item] = await tx<{ id: number }[]>`select id from items where stall_id = ${stallId} and upper(code) = upper(${code})`;
      if (!item) throw new Error(`No item ${code} on ${stallId}.`);
      const ended = await tx`update shows set status = 'ended' where stall_id = ${stallId} and status = 'live' returning id`;
      const [s] = await tx<{ id: number; started_at: Date }[]>`
        insert into shows (stall_id, title, on_screen_item_id) values (${stallId}, ${title}, ${item.id}) returning id, started_at`;
      await tx`insert into events (stall_id, kind, payload) values (${stallId}, 'show.on_screen', ${tx.json({ code: code.toUpperCase() })})`;
      return { ...s, ended: ended.map((r) => r.id) };
    });
    console.log(`ended show(s) ${show.ended.join(", ") || "none"}; live now: show ${show.id} "${title}" on ${stallId}, ${code.toUpperCase()} on screen, from ${show.started_at.toISOString()}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
