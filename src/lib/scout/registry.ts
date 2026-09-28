import { startRun } from "./engine";
import { saveReport } from "./store";
import type { ScoutConfig, ScoutEvent, ScoutReport } from "./types";

export type RunStatus = "running" | "done" | "stopped" | "error";

export interface ActiveRun {
  runId: string;
  topic: string;
  config: ScoutConfig;
  startedAt: number;
  endedAt?: number;
  status: RunStatus;
  /** Every event so far, in order. A reconnecting client replays from a cursor. */
  events: ScoutEvent[];
  report?: ScoutReport;
  abort: () => void;
  subscribers: Set<(event: ScoutEvent, index: number) => void>;
}

/** Finished runs stay reattachable for this long, so a refresh right after a run still shows it. */
const RETAIN_MS = 60 * 60 * 1000;

interface Registry {
  runs: Map<string, ActiveRun>;
}

/**
 * Held on globalThis: Next's dev server re-evaluates modules on HMR, and a
 * module-local Map would drop every in-flight run whenever a file is saved.
 */
function registry(): Registry {
  const key = Symbol.for("scout.run.registry");
  const host = globalThis as unknown as Record<symbol, Registry | undefined>;
  if (!host[key]) host[key] = { runs: new Map() };
  return host[key];
}

function prune() {
  const { runs } = registry();
  const now = Date.now();
  for (const [id, run] of runs) {
    if (run.status !== "running" && run.endedAt && now - run.endedAt > RETAIN_MS) {
      runs.delete(id);
    }
  }
}

export function createRun(config: ScoutConfig, cwd: string): ActiveRun {
  prune();

  const handle = startRun(config, cwd, saveReport);
  const run: ActiveRun = {
    runId: handle.runId,
    topic: config.topic,
    config,
    startedAt: Date.now(),
    status: "running",
    events: [],
    abort: () => {
      if (run.status === "running") run.status = "stopped";
      handle.abort();
    },
    subscribers: new Set(),
  };

  registry().runs.set(run.runId, run);

  // Detached on purpose: the run outlives the HTTP request that started it, so
  // closing the tab or refreshing does not kill the research.
  void (async () => {
    try {
      for await (const event of handle.events) {
        const index = run.events.length;
        run.events.push(event);
        if (event.type === "report") run.report = event.report;
        if (event.type === "run-end") {
          if (run.status === "running") run.status = event.error ? "error" : "done";
          run.endedAt = Date.now();
        }
        for (const notify of run.subscribers) {
          try {
            notify(event, index);
          } catch {
            // a dead subscriber must not stop the run
          }
        }
      }
    } catch {
      run.status = "error";
    } finally {
      if (run.status === "running") run.status = "done";
      run.endedAt ??= Date.now();
      for (const notify of run.subscribers) {
        try {
          notify({ type: "run-end", runId: run.runId, costUsd: 0, durationMs: 0 }, run.events.length);
        } catch {
          // ignore
        }
      }
    }
  })();

  return run;
}

export function getRun(runId: string): ActiveRun | undefined {
  return registry().runs.get(runId);
}

export interface RunHandleSummary {
  runId: string;
  topic: string;
  status: RunStatus;
  startedAt: number;
  endedAt?: number;
  eventCount: number;
  hasReport: boolean;
}

export function listRuns(): RunHandleSummary[] {
  prune();
  return [...registry().runs.values()]
    .map((run) => ({
      runId: run.runId,
      topic: run.topic,
      status: run.status,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      eventCount: run.events.length,
      hasReport: Boolean(run.report),
    }))
    .sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * Replays everything after `cursor`, then streams live events until the caller
 * unsubscribes or the run ends.
 */
export function subscribe(
  run: ActiveRun,
  cursor: number,
  onEvent: (event: ScoutEvent, index: number) => void,
): () => void {
  for (let i = Math.max(0, cursor); i < run.events.length; i++) {
    onEvent(run.events[i], i);
  }
  if (run.status !== "running") return () => {};
  run.subscribers.add(onEvent);
  return () => run.subscribers.delete(onEvent);
}

export function isFinished(run: ActiveRun): boolean {
  return run.status !== "running";
}
