import { connection } from "next/server";
import { allow, clientKey } from "@/lib/service/limit";
import { owedNow } from "@/lib/service/ledger";

/** Who still owes right now, each invoice re-read live from PayPal. The ledger agent's tool. */
export async function GET(req: Request, { params }: { params: Promise<{ stall: string }> }) {
  await connection();
  const { stall } = await params;
  if (!allow(`owes:${clientKey(req)}`, 10, 60_000)) return Response.json({ error: "Too many PayPal reads; try again in a minute." }, { status: 429 });
  try {
    return Response.json({ owed: await owedNow(stall), at: new Date().toISOString() });
  } catch (e) {
    console.error(JSON.stringify({ scope: "owes", stall, error: (e as Error).message.slice(0, 200) }));
    return Response.json({ error: "Couldn't read PayPal right now." }, { status: 503 });
  }
}
