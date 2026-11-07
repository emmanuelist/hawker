import { cookies } from "next/headers";
import { z } from "zod";
import { buyerFromToken, cookieName } from "@/lib/service/buyers";
import { submitComment } from "@/lib/service/holds";

const Body = z.object({ text: z.string().trim().min(1).max(280) });

/** A buyer's comment. Responds with the persisted comment's outcome once it has been applied in order. */
export async function POST(req: Request, { params }: { params: Promise<{ stall: string }> }) {
  const { stall } = await params;
  const jar = await cookies();
  const me = await buyerFromToken(stall, jar.get(cookieName(stall))?.value);
  if (!me) return Response.json({ error: "Join the stall with a name first." }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Write 1–280 characters." }, { status: 400 });
  try {
    const result = await submitComment(stall, me.id, parsed.data.text);
    return Response.json(result, { status: 201 });
  } catch (e) {
    console.error(JSON.stringify({ scope: "comment", stall, error: (e as Error).message.slice(0, 200) }));
    return Response.json({ error: "Hawker couldn't take that comment. Try again in a moment." }, { status: 503 });
  }
}
