import { NextRequest } from "next/server";
import { createRun, listRuns } from "@/lib/scout/registry";
import { workDir } from "@/lib/scout/store";
import { coerceConfig } from "@/lib/scout/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 3600;

/**
 * Starts a run and returns immediately. The run lives in the server-side
 * registry, so the client can close the tab and reattach to the event stream
 * later without killing the research.
 */
export async function POST(request: NextRequest) {
  const parsed = coerceConfig(await request.json().catch(() => null));
  if ("error" in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const run = createRun(parsed, await workDir());
  return Response.json({ runId: run.runId, startedAt: run.startedAt });
}

/** Active and recently finished runs, so a reloaded client knows what to reattach to. */
export function GET() {
  return Response.json({ runs: listRuns() });
}
