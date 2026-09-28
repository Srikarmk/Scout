import { listSaved, saveIdea } from "@/lib/scout/saved";
import type { Idea } from "@/lib/scout/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ saved: await listSaved() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    runId?: string;
    topic?: string;
    idea?: Idea;
    note?: string;
  } | null;

  if (!body?.idea?.title || !body.runId) {
    return Response.json({ error: "need a runId and an idea" }, { status: 400 });
  }

  const entry = await saveIdea({
    runId: body.runId,
    topic: body.topic ?? "",
    idea: body.idea,
    note: body.note,
  });
  return Response.json({ saved: entry });
}
