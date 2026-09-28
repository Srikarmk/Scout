import { listReports } from "@/lib/scout/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ reports: await listReports() });
}
