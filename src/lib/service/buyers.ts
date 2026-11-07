// Buyer identity on a stall: a chosen handle bound to a per-device token (D-013). The cookie holds the
// token; the database stores only its SHA-256.
import { createHash, randomBytes } from "node:crypto";
import { db } from "../db";

export const cookieName = (stallId: string) => `hk_${stallId}`;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export const HANDLE = /^[a-z0-9._]{2,25}$/;

export async function buyerFromToken(stallId: string, token: string | undefined): Promise<{ id: string; handle: string } | null> {
  if (!token) return null;
  const [b] = await db()<{ id: string; handle: string }[]>`
    select id, handle from buyers where stall_id = ${stallId} and device_hash = ${hash(token)}`;
  return b ?? null;
}

/** Create a buyer for this device, or return null if the handle belongs to another device. */
export async function joinStall(stallId: string, handle: string): Promise<{ id: string; handle: string; token: string } | null> {
  const token = randomBytes(24).toString("base64url");
  const rows = await db()<{ id: string; handle: string }[]>`
    insert into buyers (stall_id, handle, device_hash) values (${stallId}, ${handle}, ${hash(token)})
    on conflict (stall_id, handle) do nothing returning id, handle`;
  return rows[0] ? { ...rows[0], token } : null;
}
