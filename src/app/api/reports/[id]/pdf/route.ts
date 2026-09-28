import { renderReportPdf } from "@/lib/scout/pdf";
import { loadReport } from "@/lib/scout/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function filename(topic: string, runId: string): string {
  const slug =
    topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "report";
  return `scout-${slug}-${runId.slice(0, 8)}.pdf`;
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // ?inline=1 renders in the browser instead of downloading.
  const inline = new URL(request.url).searchParams.get("inline") === "1";
  const report = await loadReport(id);
  if (!report) return Response.json({ error: "no such report" }, { status: 404 });

  const buffer = await renderReportPdf(report);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename(report.topic, report.runId)}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
