import { deleteReport, loadReport } from "@/lib/scout/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const report = await loadReport(id);
  if (!report) return Response.json({ error: "no such report" }, { status: 404 });
  return Response.json({ report });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ok = await deleteReport(id);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
