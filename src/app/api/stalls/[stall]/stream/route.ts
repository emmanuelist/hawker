// Server-Sent Events: a fresh snapshot on connect and after every change on the stall.
import { cookies } from "next/headers";
import { buyerFromToken, cookieName } from "@/lib/service/buyers";
import { subscribe } from "@/lib/service/runtime";
import { forBuyer, getSnapshot } from "@/lib/service/snapshot";

export async function GET(req: Request, { params }: { params: Promise<{ stall: string }> }) {
  const { stall } = await params;
  const view = new URL(req.url).searchParams.get("view") === "desk" ? "desk" : "stall";
  const jar = await cookies();
  const me = view === "stall" ? await buyerFromToken(stall, jar.get(cookieName(stall))?.value) : null;
  const enc = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;
  let closed = false;
  const RETRY_MS = 5000;

  const stop = () => {
    closed = true;
    unsubscribe?.();
    if (timer) clearTimeout(timer);
    if (ping) clearInterval(ping);
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (chunk: string) => {
        if (!closed) controller.enqueue(enc.encode(chunk));
      };
      const send = async () => {
        try {
          const snap = await getSnapshot(stall, me?.id ?? null);
          if (!snap) {
            push(`event: gone\ndata: {}\n\n`);
            return;
          }
          const body = view === "desk" ? snap : forBuyer(snap, me?.id ?? null);
          push(`data: ${JSON.stringify(body)}\n\n`);
        } catch (e) {
          // The reason stays in the server log; the client is told only that a retry is coming,
          // and the retry is scheduled here so a failed read never leaves the page waiting forever.
          console.error(JSON.stringify({ scope: "stream", stall, view, error: (e as Error).message.slice(0, 200) }));
          push(`event: oops\ndata: ${JSON.stringify({ retryInMs: RETRY_MS })}\n\n`);
          if (!closed) {
            if (timer) clearTimeout(timer);
            timer = setTimeout(send, RETRY_MS);
          }
        }
      };
      await send();
      unsubscribe = subscribe(stall, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(send, 150);
      });
      ping = setInterval(() => push(`: ping\n\n`), 20000);
      req.signal.addEventListener("abort", () => {
        stop();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      stop();
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
