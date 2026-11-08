import { z } from "zod";
import { db } from "@/lib/db";
import { invalidateStall } from "@/lib/service/catalog";
import { publish, serial } from "@/lib/service/runtime";

const Body = z.object({ code: z.string().trim().min(1).max(8) });

/** The desk sets which item is on screen. Runs in the stall queue so claims before it keep the old item. */
export async function POST(req: Request, { params }: { params: Promise<{ stall: string }> }) {
  const { stall } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Which item code?" }, { status: 400 });
  const updated = await serial(stall, async () => {
    // Paid units never come back (D-024): an item that can sell nothing would put a dead stall on screen.
    const [left] = await db()<{ sellable: number | null }[]>`
      select sum(greatest(v.stock - coalesce((select sum(h.qty) from holds h where h.variant_id = v.id and h.state = 'Paid'), 0), 0))::int sellable
      from items i join variants v on v.item_id = i.id
      where i.stall_id = ${stall} and upper(i.code) = upper(${parsed.data.code})`;
    if (left?.sellable === 0) return "sold" as const;
    const rows = await db()<{ id: number }[]>`
      update shows s set on_screen_item_id = i.id
      from items i
      where s.stall_id = ${stall} and s.status = 'live' and i.stall_id = ${stall} and upper(i.code) = upper(${parsed.data.code})
      returning s.id`;
    if (rows.length) {
      invalidateStall(stall);
      await db()`insert into events (stall_id, kind, payload) values (${stall}, 'show.on_screen', ${db().json({ code: parsed.data.code.toUpperCase() })})`;
      publish(stall);
    }
    return rows.length > 0;
  });
  if (updated === "sold") return Response.json({ error: `${parsed.data.code.toUpperCase()} is sold: every unit was paid for.` }, { status: 409 });
  if (!updated) return Response.json({ error: `No item ${parsed.data.code} on this stall.` }, { status: 404 });
  return Response.json({ onScreen: parsed.data.code.toUpperCase() });
}
