import { query } from "@anthropic-ai/claude-agent-sdk";
import { workDir } from "@/lib/scout/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Cheapest possible round trip, so the UI can tell the user why a run would fail. */
export async function GET() {
  const cwd = await workDir();
  let error: string | undefined;
  let model = "";
  let apiKeySource = "";
  let costUsd = 0;

  try {
    for await (const message of query({
      prompt: "Reply with the single word: OK",
      options: {
        model: "claude-sonnet-5",
        systemPrompt: { type: "custom", prompt: "Answer in one word." },
        tools: [],
        permissionMode: "dontAsk",
        settingSources: [],
        maxTurns: 1,
        effort: "low",
        cwd,
        env: { ...process.env },
      },
    })) {
      if (message.type === "system" && message.subtype === "init") {
        model = message.model;
        apiKeySource = message.apiKeySource;
      }
      if (message.type === "result") costUsd = message.total_cost_usd ?? 0;
      if (message.type === "assistant" && message.error) error = message.error;
      if (message.type === "result" && message.subtype !== "success" && !error) error = message.subtype;
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }

  const authProblem = error ? /authenticat|oauth|login|credential|api key/i.test(error) : false;

  // "none" means a claude.ai OAuth login: usage draws on the subscription's
  // limits rather than being metered per token to Console credits.
  const billing =
    apiKeySource === "none"
      ? "subscription"
      : apiKeySource
        ? "api-credits"
        : "unknown";

  return Response.json({
    ok: !error,
    model,
    apiKeySource,
    billing,
    costUsd,
    error,
    hint: authProblem
      ? "The Claude Code CLI that Scout spawns is not signed in. Run `claude` in a terminal, sign in with /login, then reload this page. Setting ANTHROPIC_API_KEY before `npm run dev` also works."
      : undefined,
  });
}
