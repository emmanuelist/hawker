import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getSnapshot, type Snapshot } from "@/lib/service/snapshot";
import { Landing } from "./Landing";

export const metadata: Metadata = {
  title: "Hawker · paid through PayPal, or passed to the next buyer",
  description: "Every hold ends one of two ways: paid through PayPal, or passed to the next buyer.",
};

/** The demo stall's state at request time, so the first view already shows real copies. The static
 *  shell (the same page with no data yet) is prerendered as the fallback and streams in first. */
async function LiveLanding() {
  await connection();
  let initial: Snapshot | null = null;
  try {
    initial = await getSnapshot("ada", null);
  } catch (e) {
    console.error(JSON.stringify({ scope: "landing-ssr", error: (e as Error).message.slice(0, 200) }));
  }
  return <Landing initial={initial} />;
}

export default function Home() {
  return (
    <Suspense fallback={<Landing initial={null} />}>
      <LiveLanding />
    </Suspense>
  );
}
