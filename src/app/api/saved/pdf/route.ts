import { renderShortlistPdf } from "@/lib/scout/pdf";
import { listSaved } from "@/lib/scout/saved";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const inline = new URL(request.url).searchParams.get("inline") === "1";
  const items = await listSaved();
  if (items.length === 0) {
    return Response.json({ error: "nothing saved yet" }, { status: 404 });
  }

  const buffer = await renderShortlistPdf(items);
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="scout-shortlist-${stamp}.pdf"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
