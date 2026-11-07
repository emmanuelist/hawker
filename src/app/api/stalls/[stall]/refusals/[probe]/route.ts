import { connection } from "next/server";
import { allow, clientKey } from "@/lib/service/limit";
import { isProbeId, runProbe } from "@/lib/service/refusals";

/** Attempt one forbidden ending for real and return the refusal (refusals.ts). Each PayPal probe is
 *  three sandbox API calls, so attempts are limited per visitor and per day. */
export async function POST(req: Request, { params }: { params: Promise<{ stall: string; probe: string }> }) {
  await connection();
  const { stall, probe } = await params;
  if (!isProbeId(probe)) return Response.json({ error: "Unknown attempt." }, { status: 404 });
  if (!allow(`refuse:${clientKey(req)}`, 30, 60_000) || !allow("refuse:all", 1500, 86_400_000)) {
    return Response.json({ error: "Too many attempts; try again in a minute." }, { status: 429 });
  }
  try {
    return Response.json(await runProbe(stall, probe));
  } catch (e) {
    console.error(JSON.stringify({ scope: "refusals", stall, probe, error: (e as Error).message.slice(0, 200) }));
    return Response.json({ error: "Couldn't make the attempt right now. Try again in a moment." }, { status: 503 });
  }
}
