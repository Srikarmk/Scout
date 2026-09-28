import { removeSaved, updateNote } from "@/lib/scout/saved";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ savedId: string }> }) {
  const { savedId } = await ctx.params;
  const body = (await request.json().catch(() => null)) as { note?: string } | null;
  const entry = await updateNote(savedId, body?.note ?? "");
  if (!entry) return Response.json({ error: "no such saved idea" }, { status: 404 });
  return Response.json({ saved: entry });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ savedId: string }> }) {
  const { savedId } = await ctx.params;
  const ok = await removeSaved(savedId);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
