import { z } from "zod";
import { db } from "@/lib/db";
import { publish, serial } from "@/lib/service/runtime";

const Body = z.object({ code: z.string().trim().min(1).max(8) });

/** The desk sets which item is on screen. Runs in the stall queue so claims before it keep the old item. */
export async function POST(req: Request, { params }: { params: Promise<{ stall: string }> }) {
  const { stall } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Which item code?" }, { status: 400 });
  const updated = await serial(stall, async () => {
    const rows = await db()<{ id: number }[]>`
      update shows s set on_screen_item_id = i.id
      from items i
      where s.stall_id = ${stall} and s.status = 'live' and i.stall_id = ${stall} and upper(i.code) = upper(${parsed.data.code})
      returning s.id`;
    if (rows.length) {
      await db()`insert into events (stall_id, kind, payload) values (${stall}, 'show.on_screen', ${db().json({ code: parsed.data.code.toUpperCase() })})`;
      publish(stall);
    }
    return rows.length > 0;
  });
  if (!updated) return Response.json({ error: `No item ${parsed.data.code} on this stall.` }, { status: 404 });
  return Response.json({ onScreen: parsed.data.code.toUpperCase() });
}
