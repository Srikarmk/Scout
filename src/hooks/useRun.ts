"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { emptyRun, reduceRun, type RunState } from "@/components/RunStream";
import type { ScoutConfig, ScoutEvent, ScoutReport } from "@/lib/scout/types";

const ACTIVE_KEY = "scout.activeRun.v1";

export interface RunSummary {
  runId: string;
  topic: string;
  status: "running" | "done" | "stopped" | "error";
  startedAt: number;
  endedAt?: number;
  eventCount: number;
  hasReport: boolean;
}

export interface UseRun {
  run: RunState;
  report: ScoutReport | null;
  runId: string | null;
  attached: boolean;
  live: boolean;
  error: string | null;
  start: (config: ScoutConfig) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
  showReport: (report: ScoutReport) => void;
}

/**
 * Owns one run's lifecycle. The run itself lives on the server, so this hook
 * only ever attaches to an event stream — closing the tab does not stop it.
 */
export function useRun(onFinished?: () => void): UseRun {
  const [run, setRun] = useState<RunState>(emptyRun);
  const [report, setReport] = useState<ScoutReport | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [attached, setAttached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cursorRef = useRef(0);
  const liveRef = useRef(false);
  /** Event indices already folded into state: replays and a double-mounted
   *  effect must not apply the same event twice. */
  const seenRef = useRef<Set<number>>(new Set());
  /** The run this hook currently has a stream open for, so StrictMode's
   *  double invoke cannot start a second consumer for the same run. */
  const consumingRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  const consume = useCallback(async (id: string) => {
    let attempt = 0;

    while (!stoppedRef.current) {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(`/api/research/${id}/stream?cursor=${cursorRef.current}`, {
          signal: controller.signal,
        });
        if (response.status === 404) {
          setError("That run is no longer on the server — it expired or the server restarted.");
          liveRef.current = false;
          setLive(false);
          localStorage.removeItem(ACTIVE_KEY);
          return;
        }
        if (!response.ok || !response.body) throw new Error(`stream failed: ${response.status}`);

        attempt = 0;
        liveRef.current = true;
        setLive(true);
        setAttached(true);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let ended = false;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const line = frame.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            let payload: { index: number; event: ScoutEvent };
            try {
              payload = JSON.parse(line.slice(6));
            } catch {
              continue;
            }
            if (seenRef.current.has(payload.index)) continue;
            seenRef.current.add(payload.index);
            cursorRef.current = Math.max(cursorRef.current, payload.index + 1);
            const event = payload.event;
            if (event.type === "report") setReport(event.report);
            else setRun((state) => reduceRun(state, event));
            if (event.type === "run-end") ended = true;
          }
        }

        if (ended || stoppedRef.current) {
          liveRef.current = false;
          setLive(false);
          localStorage.removeItem(ACTIVE_KEY);
          finishedRef.current?.();
          return;
        }
      } catch (cause) {
        if (controller.signal.aborted || stoppedRef.current) {
          liveRef.current = false;
          setLive(false);
          return;
        }
        if (++attempt > 5) {
          setError(
            cause instanceof Error
              ? `Lost the event stream: ${cause.message}. The run may still be going — reload to reattach.`
              : "Lost the event stream.",
          );
          liveRef.current = false;
          setLive(false);
          return;
        }
      }

      // Stream dropped mid-run: back off, then resume from the cursor.
      await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** attempt, 8000)));
    }
  }, []);

  const attach = useCallback(
    (id: string, cursor = 0) => {
      if (consumingRef.current === id) return;
      abortRef.current?.abort();
      consumingRef.current = id;
      stoppedRef.current = false;
      cursorRef.current = cursor;
      seenRef.current = new Set();
      setRunId(id);
      setError(null);
      localStorage.setItem(ACTIVE_KEY, id);
      void consume(id).finally(() => {
        if (consumingRef.current === id) consumingRef.current = null;
      });
    },
    [consume],
  );

  // Reattach to whatever was running when the page was last open.
  useEffect(() => {
    void (async () => {
      const remembered = localStorage.getItem(ACTIVE_KEY);
      if (!remembered) return;
      try {
        const response = await fetch("/api/research");
        const data = (await response.json()) as { runs: RunSummary[] };
        const match = data.runs.find((r) => r.runId === remembered);
        if (!match) {
          localStorage.removeItem(ACTIVE_KEY);
          return;
        }
        setRun(emptyRun());
        setReport(null);
        attach(match.runId, 0);
      } catch {
        localStorage.removeItem(ACTIVE_KEY);
      }
    })();
  }, [attach]);

  const start = useCallback(
    async (config: ScoutConfig) => {
      abortRef.current?.abort();
      stoppedRef.current = false;
      setError(null);
      setReport(null);
      setRun(emptyRun());

      consumingRef.current = null;
      try {
        const response = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        const data = (await response.json()) as { runId?: string; error?: string };
        if (!response.ok || !data.runId) throw new Error(data.error ?? "could not start the run");
        attach(data.runId, 0);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [attach],
  );

  const stop = useCallback(async () => {
    if (!runId) return;
    stoppedRef.current = true;
    try {
      await fetch(`/api/research/${runId}/stop`, { method: "POST" });
    } catch {
      // the abort below still detaches the UI
    }
    abortRef.current?.abort();
    liveRef.current = false;
    setLive(false);
    localStorage.removeItem(ACTIVE_KEY);
  }, [runId]);

  /**
   * Clears what is on screen. If a run is still live this only hides its
   * report: detaching the stream would orphan a run that is still burning
   * usage on the server, and would drop the key that lets a refresh reattach.
   */
  const clear = useCallback(() => {
    setReport(null);
    setError(null);
    if (liveRef.current) return;
    stoppedRef.current = true;
    abortRef.current?.abort();
    consumingRef.current = null;
    localStorage.removeItem(ACTIVE_KEY);
    setRun(emptyRun());
    setRunId(null);
    setAttached(false);
  }, []);

  /** Display a stored report without touching a run that may still be live. */
  const showReport = useCallback((next: ScoutReport) => {
    setReport(next);
    setError(null);
  }, []);

  return { run, report, runId, attached, live, error, start, stop, clear, showReport };
}
