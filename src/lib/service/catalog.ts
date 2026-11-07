// The stall's live catalog: items, variants, stock and what's on screen.
import { db } from "../db";
import type { CatalogItem, CatalogVariant } from "../domain/types";

/** A catalog item with stock; structurally a CatalogItem, so the engine and parsers accept it. */
export interface StallItem extends Omit<CatalogItem, "variants"> {
  variants: (CatalogVariant & { stock: number })[];
}

export interface StallContext {
  stall: { id: string; name: string; windowSeconds: number; isDemo: boolean };
  show: { id: number; title: string };
  onScreenCode: string | null;
  catalog: StallItem[];
}

export async function loadStall(stallId: string): Promise<StallContext | null> {
  const sql = db();
  const [stall] = await sql<{ id: string; name: string; payment_window_seconds: number; is_demo: boolean }[]>`
    select id, name, payment_window_seconds, is_demo from stalls where id = ${stallId}`;
  if (!stall) return null;
  const [show] = await sql<{ id: number; title: string; code: string | null }[]>`
    select s.id, s.title, i.code from shows s left join items i on i.id = s.on_screen_item_id
    where s.stall_id = ${stallId} and s.status = 'live' order by s.started_at desc limit 1`;
  if (!show) return null;
  const rows = await sql<{ item_id: number; code: string; name: string; price_cents: number; variant_id: number; label: string; stock: number }[]>`
    select i.id item_id, i.code, i.name, i.price_cents, v.id variant_id, v.label, v.stock
    from items i join variants v on v.item_id = i.id
    where i.stall_id = ${stallId} order by i.position, v.id`;
  const byItem = new Map<number, StallContext["catalog"][number]>();
  for (const r of rows) {
    if (!byItem.has(r.item_id)) byItem.set(r.item_id, { id: r.item_id, code: r.code, name: r.name, priceCents: r.price_cents, variants: [] });
    byItem.get(r.item_id)!.variants.push({ id: r.variant_id, label: r.label, stock: r.stock });
  }
  return {
    stall: { id: stall.id, name: stall.name, windowSeconds: stall.payment_window_seconds, isDemo: stall.is_demo },
    show: { id: show.id, title: show.title },
    onScreenCode: show.code,
    catalog: [...byItem.values()],
  };
}
