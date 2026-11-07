import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { buyerFromToken, cookieName } from "@/lib/service/buyers";
import { forBuyer, getSnapshot, type Snapshot } from "@/lib/service/snapshot";
import { StallClient } from "./StallClient";

export const metadata: Metadata = { title: "Stall · Hawker" };

/** The first view comes from the server; the live stream takes over once it connects. A failed read
 *  renders nothing early and the client retries as before. */
async function Stall({ params }: { params: Promise<{ stall: string }> }) {
  const { stall } = await params;
  let initial: Snapshot | null = null;
  try {
    const jar = await cookies();
    const me = await buyerFromToken(stall, jar.get(cookieName(stall))?.value);
    const snap = await getSnapshot(stall, me?.id ?? null);
    initial = snap ? forBuyer(snap, me?.id ?? null) : null;
  } catch (e) {
    console.error(JSON.stringify({ scope: "stall-ssr", stall, error: (e as Error).message.slice(0, 200) }));
  }
  return <StallClient stall={stall} initial={initial} />;
}

export default function Page({ params }: PageProps<"/s/[stall]">) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-[30rem] px-5 pt-4 font-display text-[0.9375rem] font-black tracking-[0.16em] uppercase">Hawker</main>}>
      <Stall params={params} />
    </Suspense>
  );
}
