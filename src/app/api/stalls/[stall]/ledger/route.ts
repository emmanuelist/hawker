import { connection } from "next/server";
import { getLedger } from "@/lib/service/ledger";

/** Every hold on the stall with how it ended: the data the AG Studio ledger reads. */
export async function GET(_req: Request, { params }: { params: Promise<{ stall: string }> }) {
  await connection();
  const { stall } = await params;
  try {
    return Response.json({ rows: await getLedger(stall), at: new Date().toISOString() });
  } catch (e) {
    console.error(JSON.stringify({ scope: "ledger", stall, error: (e as Error).message.slice(0, 200) }));
    return Response.json({ error: "Couldn't read the ledger. Try again in a moment." }, { status: 503 });
  }
}
