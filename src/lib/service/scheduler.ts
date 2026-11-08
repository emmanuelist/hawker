// Background loop, started once per server (instrumentation.ts). Neon is touched only on start and
// while holds are open (D-014): deadlines live in memory, PayPal is polled only for open holds, and
// the keep-warm request hits /api/health, which never queries the database (D-011).
import { db } from "../db";
import { keepDemoStocked } from "./demo";
import { endHolding, pollPayments } from "./holds";
import { rt, serial } from "./runtime";

const inFlight = new Set<number>();

async function loadOpenHolds() {
  if (!process.env.DATABASE_URL) return;
  const rows = await db()<{ id: string; stall_id: string; deadline_at: Date }[]>`
    select id, stall_id, deadline_at from holds where state = 'Holding'`;
  for (const r of rows) rt.deadlines.set(Number(r.id), { stallId: r.stall_id, at: r.deadline_at.getTime() });
  console.info(JSON.stringify({ scope: "scheduler", loadedOpenHolds: rows.length }));
}

function tick() {
  const now = Date.now();
  for (const [holdId, d] of rt.deadlines) {
    if (d.at > now || inFlight.has(holdId)) continue;
    inFlight.add(holdId);
    serial(d.stallId, () => endHolding(d.stallId, holdId, "expired"))
      .catch((e) => console.error(JSON.stringify({ scope: "expire", holdId, error: (e as Error).message.slice(0, 200) })))
      .finally(() => inFlight.delete(holdId));
  }
}

function poll() {
  const stalls = new Set([...rt.deadlines.values()].map((d) => d.stallId));
  for (const stallId of stalls) {
    pollPayments(stallId).catch((e) =>
      console.error(JSON.stringify({ scope: "poll", stallId, error: (e as Error).message.slice(0, 200) })),
    );
  }
}

function keepWarm() {
  const base = process.env.RENDER_EXTERNAL_URL;
  if (!base) return;
  fetch(`${base}/api/health`, { signal: AbortSignal.timeout(20000) }).catch(() => undefined);
}

export async function startScheduler() {
  if (rt.started) return;
  rt.started = true;
  try {
    await loadOpenHolds();
  } catch (e) {
    console.error(JSON.stringify({ scope: "scheduler", error: (e as Error).message.slice(0, 200) }));
  }
  // A demo store left sold out (or restarted mid-judging) gets an item with stock back on screen (D-026).
  if (process.env.DATABASE_URL) {
    try {
      const demos = await db()<{ id: string }[]>`select id from stalls where is_demo`;
      for (const d of demos) await keepDemoStocked(d.id);
    } catch (e) {
      console.error(JSON.stringify({ scope: "scheduler", error: (e as Error).message.slice(0, 200) }));
    }
  }
  setInterval(tick, 1000).unref();
  setInterval(poll, 8000).unref();
  setInterval(keepWarm, 9 * 60 * 1000).unref();
}
