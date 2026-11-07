// Server-Sent Events: a fresh snapshot on connect and after every change on the stall.
import { cookies } from "next/headers";
import { buyerFromToken, cookieName } from "@/lib/service/buyers";
import { subscribe } from "@/lib/service/runtime";
import { getSnapshot, type Snapshot } from "@/lib/service/snapshot";

/** The stall view never exposes other buyers' invoice links or IDs. */
function forBuyer(s: Snapshot, buyerId: string | null): Snapshot {
  return {
    ...s,
    holds: s.holds.map((h) =>
      h.buyerId === buyerId ? h : { ...h, buyerId: "", payerLink: null, invoiceId: null, transactionId: null },
    ),
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ stall: string }> }) {
  const { stall } = await params;
  const view = new URL(req.url).searchParams.get("view") === "desk" ? "desk" : "stall";
  const jar = await cookies();
  const me = view === "stall" ? await buyerFromToken(stall, jar.get(cookieName(stall))?.value) : null;
  const enc = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = async () => {
        try {
          const snap = await getSnapshot(stall, me?.id ?? null);
          if (!snap) {
            controller.enqueue(enc.encode(`event: gone\ndata: {}\n\n`));
            return;
          }
          const body = view === "desk" ? snap : forBuyer(snap, me?.id ?? null);
          controller.enqueue(enc.encode(`data: ${JSON.stringify(body)}\n\n`));
        } catch (e) {
          controller.enqueue(enc.encode(`event: oops\ndata: ${JSON.stringify({ error: (e as Error).message.slice(0, 120) })}\n\n`));
        }
      };
      await send();
      unsubscribe = subscribe(stall, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(send, 150);
      });
      ping = setInterval(() => controller.enqueue(enc.encode(`: ping\n\n`)), 20000);
      req.signal.addEventListener("abort", () => {
        unsubscribe?.();
        if (timer) clearTimeout(timer);
        if (ping) clearInterval(ping);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      unsubscribe?.();
      if (timer) clearTimeout(timer);
      if (ping) clearInterval(ping);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
