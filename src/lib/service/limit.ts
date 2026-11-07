// A small in-memory rate limiter (one process per database, T-22). Sliding window per key.
type Hits = number[];
const g = globalThis as unknown as { __hawkerLimits?: Map<string, Hits> };
const buckets = (g.__hawkerLimits ??= new Map<string, Hits>());

/** Records a hit and returns whether it is within `max` hits per `windowMs` for this key. */
export function allow(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

/** The caller's address as Render's proxy reports it (first hop of x-forwarded-for). */
export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
