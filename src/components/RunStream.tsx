"use client";

import { useEffect, useRef } from "react";
import type { PhaseMeta, ScoutEvent } from "@/lib/scout/types";
import { Panel } from "./ui";

export interface AgentState {
  id: string;
  label: string;
  phase: string;
  model: string;
  status: "running" | "done" | "failed";
  tools: Array<{ tool: string; detail: string; nested: boolean }>;
  text: string;
  costUsd: number;
  turns: number;
  error?: string;
}

export interface RunState {
  runId: string;
  phases: PhaseMeta[];
  phaseStatus: Record<string, "pending" | "running" | "done" | "failed">;
  agents: AgentState[];
  logs: Array<{ level: string; message: string }>;
  costUsd: number;
  durationMs: number;
  finished: boolean;
  error?: string;
}

export function emptyRun(): RunState {
  return {
    runId: "",
    phases: [],
    phaseStatus: {},
    agents: [],
    logs: [],
    costUsd: 0,
    durationMs: 0,
    finished: false,
  };
}

export function reduceRun(state: RunState, event: ScoutEvent): RunState {
  switch (event.type) {
    case "run-start":
      return {
        ...emptyRun(),
        runId: event.runId,
        phases: event.phases,
        phaseStatus: Object.fromEntries(event.phases.map((p) => [p.id, "pending" as const])),
      };
    case "phase-start":
      return { ...state, phaseStatus: { ...state.phaseStatus, [event.phase]: "running" } };
    case "phase-end":
      return {
        ...state,
        phaseStatus: { ...state.phaseStatus, [event.phase]: event.ok ? "done" : "failed" },
      };
    case "agent-start": {
      const fresh: AgentState = {
        id: event.agent,
        label: event.label,
        phase: event.phase,
        model: event.model,
        status: "running",
        tools: [],
        text: "",
        costUsd: 0,
        turns: 0,
      };
      const existing = state.agents.findIndex((a) => a.id === event.agent);
      if (existing >= 0) {
        const agents = [...state.agents];
        agents[existing] = fresh;
        return { ...state, agents };
      }
      return { ...state, agents: [...state.agents, fresh] };
    }
    case "agent-tool":
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.id === event.agent
            ? { ...a, tools: [...a.tools, { tool: event.tool, detail: event.detail, nested: event.nested }] }
            : a,
        ),
      };
    case "agent-text":
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.id === event.agent ? { ...a, text: `${a.text}${a.text ? "\n\n" : ""}${event.text}` } : a,
        ),
      };
    case "agent-end":
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.id === event.agent
            ? {
                ...a,
                status: event.ok ? "done" : "failed",
                costUsd: event.costUsd,
                turns: event.turns,
                error: event.error,
              }
            : a,
        ),
        costUsd: state.costUsd + event.costUsd,
      };
    case "log":
      return { ...state, logs: [...state.logs, { level: event.level, message: event.message }] };
    case "run-end":
      return { ...state, finished: true, costUsd: event.costUsd, durationMs: event.durationMs, error: event.error };
    default:
      return state;
  }
}

function toolIcon(tool: string): string {
  if (tool === "WebSearch") return "search";
  if (tool === "WebFetch") return "read";
  if (tool === "Task") return "spawn";
  return tool.toLowerCase();
}

function AgentCard({ agent }: { agent: AgentState }) {
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [agent.tools.length]);

  const searches = agent.tools.filter((t) => t.tool === "WebSearch").length;
  const fetches = agent.tools.filter((t) => t.tool === "WebFetch").length;
  const spawns = agent.tools.filter((t) => t.tool === "Task").length;

  return (
    <div className="rounded-lg border border-line bg-raise">
      <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={[
              "h-1.5 w-1.5 shrink-0 rounded-full",
              agent.status === "running"
                ? "live-dot bg-accent"
                : agent.status === "done"
                  ? "bg-good"
                  : "bg-bad",
            ].join(" ")}
          />
          <span className="truncate text-[13px] font-medium text-ink">{agent.label}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 font-mono text-[11.5px] tabular-nums text-ink-3">
          {searches > 0 ? <span>{searches} searches</span> : null}
          {fetches > 0 ? <span>{fetches} reads</span> : null}
          {spawns > 0 ? <span>{spawns} dives</span> : null}
          {agent.costUsd > 0 ? <span className="text-ink-2">${agent.costUsd.toFixed(2)}</span> : null}
        </div>
      </div>

      {agent.error ? (
        <p className="px-3 py-2 text-[12px] text-bad">{agent.error}</p>
      ) : null}

      <div ref={feedRef} className="scroll-thin max-h-40 overflow-y-auto px-3 py-2">
        {agent.tools.length === 0 ? (
          <p className="text-[12px] text-ink-3">
            {agent.status === "running" ? "thinking..." : "no tool calls"}
          </p>
        ) : (
          <ul className="space-y-1">
            {agent.tools.slice(-40).map((t, i) => (
              <li key={i} className="flex gap-2 text-[12px] leading-snug">
                <span
                  className={[
                    "shrink-0 font-mono",
                    t.nested ? "text-ink-3" : "text-accent",
                  ].join(" ")}
                >
                  {t.nested ? "  ->" : ""}
                  {toolIcon(t.tool)}
                </span>
                <span className="min-w-0 truncate text-ink-3">{t.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function RunStream({
  run,
  onStop,
  topic,
}: {
  run: RunState;
  onStop: () => void;
  topic?: string;
}) {
  const byPhase = new Map<string, AgentState[]>();
  for (const agent of run.agents) {
    byPhase.set(agent.phase, [...(byPhase.get(agent.phase) ?? []), agent]);
  }

  return (
    <div className="space-y-4">
      <Panel
        title={topic ? `Researching: ${topic}` : "Run"}
        right={
          <div className="flex items-center gap-3 font-mono text-[12px] tabular-nums text-ink-3">
            <span>${run.costUsd.toFixed(2)}</span>
            {run.finished ? (
              <span>{Math.round(run.durationMs / 1000)}s</span>
            ) : (
              <button type="button" onClick={onStop} className="text-bad hover:underline">
                stop
              </button>
            )}
          </div>
        }
      >
        <ol className="divide-y divide-line">
          {run.phases.map((phase) => {
            const status = run.phaseStatus[phase.id] ?? "pending";
            const agents = byPhase.get(phase.id) ?? [];
            return (
              <li key={phase.id} className="px-4 py-3">
                <div className="flex items-baseline gap-2">
                  <span
                    className={[
                      "text-[13px] font-medium",
                      status === "pending" ? "text-ink-3" : "text-ink",
                    ].join(" ")}
                  >
                    {phase.label}
                  </span>
                  <span className="text-[12px] text-ink-3">{phase.blurb}</span>
                  {status === "running" ? (
                    <span className="live-dot ml-auto text-[11.5px] text-accent">running</span>
                  ) : status === "done" ? (
                    <span className="ml-auto text-[11.5px] text-ink-3">done</span>
                  ) : status === "failed" ? (
                    <span className="ml-auto text-[11.5px] text-bad">failed</span>
                  ) : null}
                </div>
                {agents.length > 0 ? (
                  <div className="mt-2.5 grid gap-2 lg:grid-cols-2">
                    {agents.map((agent) => (
                      <AgentCard key={agent.id} agent={agent} />
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Panel>

      {run.logs.length > 0 ? (
        <Panel title="Notes">
          <ul className="space-y-1.5 p-4">
            {run.logs.map((log, i) => (
              <li
                key={i}
                className={[
                  "text-[12.5px] leading-relaxed",
                  log.level === "error" ? "text-bad" : log.level === "warn" ? "text-warn" : "text-ink-3",
                ].join(" ")}
              >
                {log.message}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
