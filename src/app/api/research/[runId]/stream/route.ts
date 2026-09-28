import { NextRequest } from "next/server";
import { getRun, isFinished, subscribe } from "@/lib/scout/registry";
import type { ScoutEvent } from "@/lib/scout/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 3600;

/**
 * SSE tail of one run. `cursor` is the number of events the client already has,
 * so a reconnect replays only what it missed (or everything, from 0).
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  const run = getRun(runId);
  if (!run) {
    return Response.json({ error: "no such run; it may have expired or the server restarted" }, { status: 404 });
  }

  const cursor = Number(request.nextUrl.searchParams.get("cursor") ?? 0);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      let unsubscribe = () => {};

      const send = (payload: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          open = false;
        }
      };

      const close = () => {
        if (!open) return;
        open = false;
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed by the client going away
        }
      };

      controller.enqueue(encoder.encode(": scout stream open\n\n"));

      // Proxies and browsers drop an idle stream; a phase can run minutes without an event.
      const heartbeat = setInterval(() => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          close();
        }
      }, 15000);

      const onEvent = (event: ScoutEvent, index: number) => {
        send({ index, event });
        if (event.type === "run-end") close();
      };

      unsubscribe = subscribe(run, Number.isFinite(cursor) ? cursor : 0, onEvent);

      // A run that finished before this request arrived has already been replayed in full.
      if (isFinished(run)) close();

      request.signal.addEventListener("abort", close);
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
