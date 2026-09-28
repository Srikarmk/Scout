import { randomUUID } from "node:crypto";
import { query, type Options, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { DEPTH_PROFILES, WORKER_MODEL, modelId } from "./config";
import {
  DEEP_DIVE_AGENT_PROMPT,
  critiquePrompt,
  framingPrompt,
  gapsPrompt,
  ideationPrompt,
  priorArtPrompt,
  reportPrompt,
} from "./prompts";
import type { PhaseMeta, ScoutConfig, ScoutEvent, ScoutReport } from "./types";

/** Tools a research agent is allowed to touch. No filesystem, no shell. */
const RESEARCH_TOOLS = ["WebSearch", "WebFetch", "Task"];
const SYNTH_TOOLS = ["WebSearch", "WebFetch"];
const WRITE_TOOLS: string[] = [];

/** A bounded async queue so parallel agents can emit into one ordered stream. */
class EventStream implements AsyncIterable<ScoutEvent> {
  private buffer: ScoutEvent[] = [];
  private waiters: Array<(r: IteratorResult<ScoutEvent>) => void> = [];
  private closed = false;

  push(event: ScoutEvent) {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter({ value: event, done: false });
    else this.buffer.push(event);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    for (const waiter of this.waiters) waiter({ value: undefined, done: true });
    this.waiters = [];
  }

  [Symbol.asyncIterator](): AsyncIterator<ScoutEvent> {
    return {
      next: (): Promise<IteratorResult<ScoutEvent>> => {
        const queued = this.buffer.shift();
        if (queued) return Promise.resolve({ value: queued, done: false });
        if (this.closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve) => this.waiters.push(resolve));
      },
    };
  }
}

interface AgentRunSpec {
  id: string;
  label: string;
  phase: string;
  system: string;
  user: string;
  model: string;
  maxTurns: number;
  effort: "low" | "medium" | "high" | "xhigh";
  tools: string[];
  withDeepDive: boolean;
  budgetUsd: number;
}

interface AgentRunResult {
  text: string;
  costUsd: number;
  turns: number;
  ok: boolean;
  error?: string;
}

/** Errors where retrying the next phase is pointless: the whole run is doomed. */
const FATAL_ERRORS = new Set([
  "authentication_failed",
  "oauth_org_not_allowed",
  "account_on_hold",
  "verification_required",
  "billing_error",
  "cloud_credential_error",
  "model_not_found",
]);

/** The SDK reports the same conditions as a thrown Error on some paths. */
const FATAL_PATTERNS = /authenticat|oauth|not logged in|please run \/login|credential|invalid api key|account is on hold/i;

export class FatalRunError extends Error {}

export function isFatalError(error: string | undefined): boolean {
  if (!error) return false;
  return FATAL_ERRORS.has(error) || FATAL_PATTERNS.test(error);
}

function fatalMessage(code: string): string {
  if (code === "authentication_failed" || FATAL_PATTERNS.test(code)) {
    return "The Claude Code CLI that Scout spawns could not authenticate. Run `claude` in a terminal and sign in (or export ANTHROPIC_API_KEY), then start the run again.";
  }
  if (code === "billing_error" || code === "account_on_hold") {
    return `The Claude account backing this run is not usable right now (${code}).`;
  }
  if (code === "model_not_found") {
    return "The selected model is not available on this account. Try the other model in the config panel.";
  }
  return `The run cannot continue: ${code}.`;
}

function toolDetail(name: string, input: Record<string, unknown>): string {
  const pick = (key: string) => {
    const value = input[key];
    return typeof value === "string" ? value : undefined;
  };
  switch (name) {
    case "WebSearch":
      return pick("query") ?? "";
    case "WebFetch":
      return pick("url") ?? "";
    case "Task":
      return pick("description") ?? pick("subagent_type") ?? "delegating";
    case "TodoWrite": {
      const todos = input.todos;
      return Array.isArray(todos) ? `${todos.length} steps` : "";
    }
    default: {
      const first = Object.values(input).find((v) => typeof v === "string");
      return typeof first === "string" ? first.slice(0, 160) : "";
    }
  }
}

async function runAgent(
  spec: AgentRunSpec,
  emit: (event: ScoutEvent) => void,
  abort: AbortController,
  cwd: string,
): Promise<AgentRunResult> {
  emit({
    type: "agent-start",
    agent: spec.id,
    label: spec.label,
    phase: spec.phase,
    model: spec.model,
  });

  const options: Options = {
    model: spec.model,
    systemPrompt: { type: "custom", prompt: spec.system },
    tools: spec.tools,
    allowedTools: spec.tools,
    permissionMode: "dontAsk",
    settingSources: [],
    maxTurns: spec.maxTurns,
    effort: spec.effort,
    maxBudgetUsd: spec.budgetUsd,
    cwd,
    abortController: abort,
    forwardSubagentText: true,
    env: { ...process.env },
    ...(spec.withDeepDive
      ? {
          agents: {
            "deep-dive": {
              description:
                "Reads one specific source end to end and reports what a search snippet would have missed. Give it a URL or one narrow question.",
              prompt: DEEP_DIVE_AGENT_PROMPT,
              tools: ["WebSearch", "WebFetch"],
              model: WORKER_MODEL,
              effort: "medium" as const,
              maxTurns: 14,
            },
          },
        }
      : {}),
  };

  let finalText = "";
  let costUsd = 0;
  let turns = 0;
  let ok = false;
  let error: string | undefined;
  let assistantError: string | undefined;

  try {
    for await (const message of query({ prompt: spec.user, options }) as AsyncIterable<SDKMessage>) {
      if (message.type === "system" && message.subtype === "init") {
        emit({ type: "agent-tools-available", agent: spec.id, tools: message.tools });
        continue;
      }

      if (message.type === "assistant") {
        const nested = message.parent_tool_use_id !== null;
        for (const block of message.message.content) {
          if (block.type === "text" && block.text.trim()) {
            emit({ type: "agent-text", agent: spec.id, text: block.text, nested });
          } else if (block.type === "tool_use") {
            emit({
              type: "agent-tool",
              agent: spec.id,
              tool: block.name,
              detail: toolDetail(block.name, (block.input ?? {}) as Record<string, unknown>),
              nested,
            });
          }
        }
        if (message.error) assistantError = message.error;
        continue;
      }

      if (message.type === "result") {
        costUsd = message.total_cost_usd ?? 0;
        turns = message.num_turns ?? 0;
        if (message.subtype === "success" && !assistantError) {
          finalText = message.result ?? "";
          ok = finalText.trim().length > 0;
          if (!ok) error = "agent returned an empty result";
        } else {
          // A model-level error (auth, rate limit, overload) still arrives with
          // subtype "success" and the error text in `result`. Do not treat that as research.
          error = assistantError ?? message.subtype;
          finalText = "";
          ok = false;
        }
      }
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
    ok = false;
  }

  emit({ type: "agent-end", agent: spec.id, ok, costUsd, turns, error });
  return { text: finalText, costUsd, turns, ok, error };
}

/** Pull the outermost JSON object out of a model response that may be fenced or prefaced. */
export function extractJson(raw: string): unknown {
  const text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fence?.[1], text].filter((c): c is string => typeof c === "string");

  for (const candidate of candidates) {
    const start = candidate.indexOf("{");
    if (start === -1) continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < candidate.length; i++) {
      const ch = candidate[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        if (inString) escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(candidate.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function asSources(value: unknown): Array<{ title: string; url: string; why?: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return { title: entry, url: entry };
      if (entry && typeof entry === "object") {
        const rec = entry as Record<string, unknown>;
        const url = asString(rec.url);
        if (!url) return null;
        return { title: asString(rec.title, url), url, why: asString(rec.why) || undefined };
      }
      return null;
    })
    .filter((s): s is { title: string; url: string; why?: string } => s !== null);
}

function slug(text: string, index: number): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `idea-${index + 1}`;
}

function buildReport(
  parsed: unknown,
  cfg: ScoutConfig,
  runId: string,
  phases: Record<string, string>,
  costUsd: number,
  durationMs: number,
): ScoutReport {
  const root = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  const rawIdeas = Array.isArray(root.ideas) ? root.ideas : [];
  const rawGaps = Array.isArray(root.gaps) ? root.gaps : [];

  return {
    runId,
    topic: cfg.topic,
    createdAt: new Date().toISOString(),
    config: cfg,
    summary: asString(root.summary, "The compiler returned no summary for this run."),
    landscape: asString(root.landscape),
    gaps: rawGaps.map((g) => {
      const rec = (g ?? {}) as Record<string, unknown>;
      return {
        title: asString(rec.title, "Untitled gap"),
        detail: asString(rec.detail),
        evidence: asString(rec.evidence),
        sources: asSources(rec.sources),
      };
    }),
    ideas: rawIdeas.map((raw, index) => {
      const rec = (raw ?? {}) as Record<string, unknown>;
      const title = asString(rec.title, `Idea ${index + 1}`);
      return {
        id: asString(rec.id) || slug(title, index),
        title,
        oneLiner: asString(rec.oneLiner),
        whyNow: asString(rec.whyNow),
        novelty: asScore(rec.novelty),
        feasibility: asScore(rec.feasibility),
        impact: asScore(rec.impact),
        noveltyRationale: asString(rec.noveltyRationale),
        closestPriorArt: asString(rec.closestPriorArt),
        differentiator: asString(rec.differentiator),
        firstMilestone: asString(rec.firstMilestone),
        stack: asStringArray(rec.stack),
        risks: asStringArray(rec.risks),
        killCriteria: asStringArray(rec.killCriteria),
        effort: asString(rec.effort),
        sources: asSources(rec.sources),
        verdict: asString(rec.verdict, "PROMISING WITH CHANGES"),
      };
    }),
    openQuestions: asStringArray(root.openQuestions),
    readingList: asSources(root.readingList),
    phases,
    costUsd,
    durationMs,
  };
}

export function phasePlan(cfg: ScoutConfig): PhaseMeta[] {
  const phases: PhaseMeta[] = [
    { id: "frame", label: "Framing", blurb: "Sharpen the question and build the search vocabulary" },
  ];
  const scoutLenses: string[] = [];
  if (cfg.lenses.includes("prior-art")) scoutLenses.push("prior art");
  if (cfg.lenses.includes("gaps")) scoutLenses.push("gap analysis");
  if (scoutLenses.length) {
    phases.push({
      id: "scout",
      label: "Field scouts",
      blurb: `${scoutLenses.join(" and ")} running in parallel, each fanning out to deep dives`,
    });
  }
  if (cfg.lenses.includes("ideation")) {
    phases.push({ id: "ideate", label: "Ideation", blurb: "Cross the gaps against adjacent fields" });
  }
  if (cfg.lenses.includes("critique") && cfg.lenses.includes("ideation")) {
    phases.push({ id: "critique", label: "Critique", blurb: "Red-team, check for prior art, and score" });
  }
  phases.push({ id: "report", label: "Report", blurb: "Compile the ranked findings" });
  return phases;
}

export interface RunHandle {
  runId: string;
  events: AsyncIterable<ScoutEvent>;
  abort: () => void;
}

export function startRun(
  cfg: ScoutConfig,
  cwd: string,
  onReport?: (report: ScoutReport) => Promise<void> | void,
): RunHandle {
  const runId = randomUUID();
  const stream = new EventStream();
  const abort = new AbortController();
  const profile = DEPTH_PROFILES[cfg.depth];
  const mainModel = modelId(cfg.model);
  const started = Date.now();
  const emit = (event: ScoutEvent) => stream.push(event);

  void (async () => {
    let totalCost = 0;
    let fatal: string | undefined;
    const phases: Record<string, string> = {};

    const phase = async <T>(id: string, work: () => Promise<T>): Promise<T> => {
      emit({ type: "phase-start", phase: id });
      const t0 = Date.now();
      const costBefore = totalCost;
      let ok = true;
      try {
        return await work();
      } catch (cause) {
        ok = false;
        throw cause;
      } finally {
        emit({
          type: "phase-end",
          phase: id,
          ok,
          costUsd: totalCost - costBefore,
          durationMs: Date.now() - t0,
        });
      }
    };

    const run = async (spec: AgentRunSpec): Promise<string> => {
      const result = await runAgent(spec, emit, abort, cwd);
      totalCost += result.costUsd;
      if (isFatalError(result.error)) {
        throw new FatalRunError(fatalMessage(result.error as string));
      }
      if (!result.ok) {
        emit({
          type: "log",
          level: "warn",
          message: `${spec.label} finished without a usable result${result.error ? `: ${result.error}` : ""}`,
        });
      }
      return result.text;
    };

    try {
      emit({ type: "run-start", runId, phases: phasePlan(cfg), config: cfg });

      const framing = await phase("frame", async () => {
        const p = framingPrompt(cfg);
        return run({
          id: "frame",
          label: "Framing agent",
          phase: "frame",
          system: p.system,
          user: p.user,
          model: mainModel,
          maxTurns: 10,
          effort: "medium",
          tools: SYNTH_TOOLS,
          withDeepDive: false,
          budgetUsd: Math.max(1, profile.budgetUsd * 0.15),
        });
      });
      if (!framing.trim()) {
        throw new FatalRunError(
          "The framing agent came back empty, so there is nothing for the scouts to work from. Check the run notes above, then try again.",
        );
      }
      phases.frame = framing;

      let priorArt = "";
      let gaps = "";
      const wantsPriorArt = cfg.lenses.includes("prior-art");
      const wantsGaps = cfg.lenses.includes("gaps");

      if (wantsPriorArt || wantsGaps) {
        await phase("scout", async () => {
          const jobs: Array<Promise<void>> = [];
          if (wantsPriorArt) {
            const p = priorArtPrompt(cfg, framing);
            jobs.push(
              run({
                id: "prior-art",
                label: "Prior-art scout",
                phase: "scout",
                system: p.system,
                user: p.user,
                model: mainModel,
                maxTurns: profile.scoutMaxTurns,
                effort: profile.effort,
                tools: RESEARCH_TOOLS,
                withDeepDive: profile.deepDives > 0,
                budgetUsd: profile.budgetUsd,
              }).then((text) => {
                priorArt = text;
                phases["prior-art"] = text;
              }),
            );
          }
          if (wantsGaps) {
            const p = gapsPrompt(cfg, framing);
            jobs.push(
              run({
                id: "gaps",
                label: "Gap analyst",
                phase: "scout",
                system: p.system,
                user: p.user,
                model: mainModel,
                maxTurns: profile.scoutMaxTurns,
                effort: profile.effort,
                tools: RESEARCH_TOOLS,
                withDeepDive: profile.deepDives > 0,
                budgetUsd: profile.budgetUsd,
              }).then((text) => {
                gaps = text;
                phases.gaps = text;
              }),
            );
          }
          await Promise.all(jobs);
        });
      }

      let ideas = "";
      if (cfg.lenses.includes("ideation")) {
        ideas = await phase("ideate", async () => {
          const p = ideationPrompt(cfg, framing, priorArt, gaps);
          return run({
            id: "ideation",
            label: "Idea generator",
            phase: "ideate",
            system: p.system,
            user: p.user,
            model: mainModel,
            maxTurns: profile.synthMaxTurns,
            effort: profile.effort,
            tools: SYNTH_TOOLS,
            withDeepDive: false,
            budgetUsd: profile.budgetUsd * 0.6,
          });
        });
        phases.ideation = ideas;
      }

      let critique = "";
      if (cfg.lenses.includes("critique") && ideas) {
        critique = await phase("critique", async () => {
          const p = critiquePrompt(cfg, ideas, priorArt);
          return run({
            id: "critique",
            label: "Critic",
            phase: "critique",
            system: p.system,
            user: p.user,
            model: mainModel,
            maxTurns: profile.scoutMaxTurns,
            effort: profile.effort,
            tools: SYNTH_TOOLS,
            withDeepDive: false,
            budgetUsd: profile.budgetUsd,
          });
        });
        phases.critique = critique;
      }

      const report = await phase("report", async () => {
        const p = reportPrompt(cfg, { framing, priorArt, gaps, ideas, critique });
        const raw = await run({
          id: "report",
          label: "Report compiler",
          phase: "report",
          system: p.system,
          user: p.user,
          model: mainModel,
          maxTurns: 4,
          effort: "medium",
          tools: WRITE_TOOLS,
          withDeepDive: false,
          budgetUsd: profile.budgetUsd * 0.5,
        });
        const parsed = extractJson(raw);
        if (!parsed) {
          emit({
            type: "log",
            level: "error",
            message:
              "The compiler did not return parseable JSON. The raw agent transcripts are still available below.",
          });
        }
        return buildReport(parsed, cfg, runId, phases, totalCost, Date.now() - started);
      });

      const hasSubstance =
        report.ideas.length > 0 || report.gaps.length > 0 || report.landscape.trim().length > 0;

      emit({ type: "report", report });
      if (!hasSubstance) {
        emit({
          type: "log",
          level: "error",
          message:
            "Every research phase came back empty, so there is no report to save. The agent transcripts above show where it stopped.",
        });
      }
      if (onReport && hasSubstance) {
        try {
          await onReport(report);
        } catch (cause) {
          emit({
            type: "log",
            level: "warn",
            message: `Could not save the report: ${cause instanceof Error ? cause.message : String(cause)}`,
          });
        }
      }
    } catch (cause) {
      fatal = cause instanceof Error ? cause.message : String(cause);
      emit({ type: "log", level: "error", message: fatal });
    } finally {
      emit({
        type: "run-end",
        runId,
        costUsd: totalCost,
        durationMs: Date.now() - started,
        error: fatal,
      });
      stream.close();
    }
  })();

  return { runId, events: stream, abort: () => abort.abort() };
}
