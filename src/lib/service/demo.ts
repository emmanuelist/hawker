// The demo store looks after itself while nobody is watching (D-026). Paid units never come back
// (D-024), so judges who pay shrink the store. After a payment, and when the server starts: if the item
// on screen can sell nothing, the item with the most left goes on screen, the way a seller moves to the
// next item; if no item can sell anything, every size is restocked so RESTOCK_TO can be sold. Holds,
// invoices and payments are never touched. Only stalls marked is_demo are managed.
import { db } from "../db";
import { keepStocked } from "../domain/engine";
import { invalidateStall, loadStall } from "./catalog";
import { publish } from "./runtime";

const RESTOCK_TO = 3;

export async function keepDemoStocked(stallId: string): Promise<"none" | "moved" | "restocked" | "skipped"> {
  try {
    const ctx = await loadStall(stallId);
    if (!ctx || !ctx.stall.isDemo) return "skipped";
    const rows = await db()<{ code: string; sellable: number }[]>`
      select i.code, coalesce(sum(greatest(v.stock - coalesce(p.paid, 0), 0)), 0)::int sellable
      from items i
      join variants v on v.item_id = i.id
      left join (select variant_id, sum(qty)::int paid from holds where stall_id = ${stallId} and state = 'Paid' group by variant_id) p
        on p.variant_id = v.id
      where i.stall_id = ${stallId}
      group by i.code order by i.code`;
    const plan = keepStocked(rows, ctx.onScreenCode);
    if (plan.kind === "none") return "none";
    if (plan.kind === "move") {
      await db()`update shows s set on_screen_item_id = i.id from items i
                 where s.stall_id = ${stallId} and s.status = 'live' and i.stall_id = ${stallId} and i.code = ${plan.code}`;
      await db()`insert into events (stall_id, kind, payload)
                 values (${stallId}, 'show.on_screen', ${db().json({ code: plan.code, auto: "the item on screen sold out" })})`;
    } else {
      // Each size can sell RESTOCK_TO again: stock rises to its Paid units plus RESTOCK_TO, never falls.
      await db()`update variants v set stock = greatest(v.stock,
                   coalesce((select sum(h.qty) from holds h where h.variant_id = v.id and h.state = 'Paid'), 0)::int + ${RESTOCK_TO})
                 from items i where v.item_id = i.id and i.stall_id = ${stallId}`;
      await db()`insert into events (stall_id, kind, payload)
                 values (${stallId}, 'catalog.restock', ${db().json({ auto: "every item sold out", sellableEach: RESTOCK_TO })})`;
    }
    invalidateStall(stallId);
    publish(stallId);
    console.info(JSON.stringify({ scope: "demo", stallId, plan }));
    return plan.kind === "move" ? "moved" : "restocked";
  } catch (e) {
    console.error(JSON.stringify({ scope: "demo", stallId, error: (e as Error).message.slice(0, 200) }));
    return "skipped";
  }
}
