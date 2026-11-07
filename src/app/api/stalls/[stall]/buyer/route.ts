import { cookies } from "next/headers";
import { z } from "zod";
import { buyerFromToken, cookieName, HANDLE, joinStall } from "@/lib/service/buyers";
import { loadStall } from "@/lib/service/catalog";

const Body = z.object({ handle: z.string().trim().toLowerCase().regex(HANDLE) });

/** Who am I on this stall (from the device cookie). */
export async function GET(_req: Request, { params }: { params: Promise<{ stall: string }> }) {
  const { stall } = await params;
  const jar = await cookies();
  const me = await buyerFromToken(stall, jar.get(cookieName(stall))?.value);
  return Response.json({ me });
}

/** Join the stall with a handle. The device keeps it via an httpOnly cookie. */
export async function POST(req: Request, { params }: { params: Promise<{ stall: string }> }) {
  const { stall } = await params;
  if (!(await loadStall(stall))) return Response.json({ error: "This stall isn't live." }, { status: 404 });
  const jar = await cookies();
  const existing = await buyerFromToken(stall, jar.get(cookieName(stall))?.value);
  if (existing) return Response.json({ me: existing });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Use 2–25 letters, numbers, dots or underscores." }, { status: 400 });
  }
  const joined = await joinStall(stall, parsed.data.handle);
  if (!joined) return Response.json({ error: `@${parsed.data.handle} is taken on this stall. Pick another.` }, { status: 409 });
  jar.set(cookieName(stall), joined.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return Response.json({ me: { id: joined.id, handle: joined.handle } }, { status: 201 });
}
