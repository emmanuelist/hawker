import type { Metadata } from "next";
import { Suspense } from "react";
import { StallClient } from "./StallClient";

export const metadata: Metadata = { title: "Stall · Hawker" };

async function Stall({ params }: { params: Promise<{ stall: string }> }) {
  const { stall } = await params;
  return <StallClient stall={stall} />;
}

export default function Page({ params }: PageProps<"/s/[stall]">) {
  return (
    <Suspense fallback={<main className="p-6 text-ink-muted">Opening the stall…</main>}>
      <Stall params={params} />
    </Suspense>
  );
}
