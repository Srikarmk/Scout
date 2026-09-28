import { getRun } from "@/lib/scout/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  const run = getRun(runId);
  if (!run) return Response.json({ error: "no such run" }, { status: 404 });
  run.abort();
  return Response.json({ ok: true, status: run.status });
}
