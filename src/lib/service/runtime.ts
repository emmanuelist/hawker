// Process-wide singletons (survive module re-evaluation in dev): the per-stall serial queue that
// enforces chat-arrival order, and the change bus that drives live updates.
import { EventEmitter } from "node:events";

interface Runtime {
  chains: Map<string, Promise<unknown>>;
  bus: EventEmitter;
  deadlines: Map<number, { stallId: string; at: number }>; // Holding hold id → deadline (ms)
  started: boolean;
}

const g = globalThis as unknown as { __hawker?: Runtime };
export const rt: Runtime =
  g.__hawker ??
  (g.__hawker = { chains: new Map(), bus: new EventEmitter().setMaxListeners(500), deadlines: new Map(), started: false });

/** Run `fn` after every earlier task for the same stall. Errors don't break the chain. */
export function serial<T>(stallId: string, fn: () => Promise<T>): Promise<T> {
  const prev = rt.chains.get(stallId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  rt.chains.set(stallId, next.catch(() => undefined));
  return next;
}

export function publish(stallId: string): void {
  rt.bus.emit(`change:${stallId}`);
}

export function subscribe(stallId: string, cb: () => void): () => void {
  rt.bus.on(`change:${stallId}`, cb);
  return () => rt.bus.off(`change:${stallId}`, cb);
}
