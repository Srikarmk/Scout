"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_CONFIG } from "@/lib/scout/config";
import type { SavedIdea } from "@/lib/scout/saved";
import type { Idea, ReportSummary, ScoutConfig, ScoutReport } from "@/lib/scout/types";
import { useRun } from "@/hooks/useRun";
import ConfigPanel from "./ConfigPanel";
import Library from "./Library";
import ReportView from "./ReportView";
import RunStream from "./RunStream";
import Shortlist from "./Shortlist";
import { Panel } from "./ui";

const STORAGE_KEY = "scout.config.v1";

type View = "run" | "library" | "shortlist";

interface Health {
  ok: boolean;
  error?: string;
  hint?: string;
  billing?: string;
}

function ideaContext(idea: Idea): string {
  return [
    `IDEA: ${idea.title}`,
    idea.oneLiner && `IN ONE LINE: ${idea.oneLiner}`,
    idea.whyNow && `WHY NOW: ${idea.whyNow}`,
    idea.closestPriorArt && `CLOSEST PRIOR ART: ${idea.closestPriorArt}`,
    idea.differentiator && `THE DIFFERENCE: ${idea.differentiator}`,
    idea.firstMilestone && `PROPOSED FIRST MILESTONE: ${idea.firstMilestone}`,
    idea.risks.length ? `KNOWN RISKS: ${idea.risks.join("; ")}` : "",
    idea.sources.length ? `SOURCES ALREADY FOUND: ${idea.sources.map((s) => s.url).join(" ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function Scout() {
  const [view, setView] = useState<View>("run");
  const [config, setConfig] = useState<ScoutConfig>(DEFAULT_CONFIG);
  const [restored, setRestored] = useState(false);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [saved, setSaved] = useState<SavedIdea[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [seededFrom, setSeededFrom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshReports = useCallback(async () => {
    try {
      const data = (await (await fetch("/api/reports")).json()) as { reports: ReportSummary[] };
      setReports(data.reports ?? []);
    } catch {
      setReports([]);
    }
  }, []);

  const refreshSaved = useCallback(async () => {
    try {
      const data = (await (await fetch("/api/saved")).json()) as { saved: SavedIdea[] };
      setSaved(data.saved ?? []);
    } catch {
      setSaved([]);
    }
  }, []);

  const run = useRun(refreshReports);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(stored) });
    } catch {
      // a corrupt saved config is not worth blocking the app over
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // storage disabled; the app still works
    }
  }, [config, restored]);

  useEffect(() => {
    void (async () => {
      const probe = fetch("/api/health")
        .then((response) => response.json() as Promise<Health>)
        .catch((cause: unknown) => ({
          ok: false,
          error: cause instanceof Error ? cause.message : String(cause),
        }));
      await Promise.all([refreshReports(), refreshSaved()]);
      setHealth(await probe);
    })();
  }, [refreshReports, refreshSaved]);

  const savedKeys = useMemo(
    () => new Set(saved.map((entry) => `${entry.runId}:${entry.idea.id}`)),
    [saved],
  );

  const openReport = useCallback(
    async (runId: string) => {
      try {
        const data = (await (await fetch(`/api/reports/${runId}`)).json()) as {
          report?: ScoutReport;
        };
        if (!data.report) {
          setNotice("That report could not be opened.");
          return;
        }
        run.showReport(data.report);
        setView("run");
      } catch {
        setNotice("That report could not be opened.");
      }
    },
    [run],
  );

  const saveIdea = useCallback(
    async (idea: Idea, runId: string, topic: string) => {
      await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, topic, idea }),
      });
      await refreshSaved();
    },
    [refreshSaved],
  );

  const unsaveIdea = useCallback(
    async (idea: Idea, runId: string) => {
      const entry = saved.find((s) => s.runId === runId && s.idea.id === idea.id);
      if (!entry) return;
      await fetch(`/api/saved/${entry.savedId}`, { method: "DELETE" });
      await refreshSaved();
    },
    [saved, refreshSaved],
  );

  const digDeeper = useCallback((idea: Idea, topic: string) => {
    setConfig((current) => ({
      ...current,
      topic: `${idea.title}: ${idea.oneLiner || topic}`,
      existingProject: ideaContext(idea),
      avoid: current.avoid,
    }));
    setSeededFrom(idea.title);
    setView("run");
    run.clear();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (run.live) {
      setNotice("Config seeded. A run is still going — it will keep running; deploy when it finishes.");
    }
  }, [run]);

  const deleteReport = useCallback(
    async (runId: string) => {
      setBusy(true);
      try {
        await fetch(`/api/reports/${runId}`, { method: "DELETE" });
        await refreshReports();
      } finally {
        setBusy(false);
      }
    },
    [refreshReports],
  );

  const showRun = run.run.phases.length > 0 && !run.report;
  const activeTopic = run.report?.topic ?? config.topic;

  const NAV: Array<{ id: View; label: string; badge?: number }> = [
    { id: "run", label: "Run" },
    { id: "library", label: "Library", badge: reports.length },
    { id: "shortlist", label: "Shortlist", badge: saved.length },
  ];

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-5">
      <header className="mb-5 border-b border-line pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-5">
            <div>
              <h1 className="text-[18px] font-medium tracking-tight text-ink">Scout</h1>
              <p className="text-[12px] text-ink-3">research agents for project ideas</p>
            </div>
            <nav className="flex gap-1">
              {NAV.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setView(entry.id)}
                  className={[
                    "rounded-md border px-3 py-1.5 text-[12.5px] transition-colors",
                    view === entry.id
                      ? "border-accent bg-accent-soft text-ink"
                      : "border-transparent text-ink-2 hover:bg-raise hover:text-ink",
                  ].join(" ")}
                >
                  {entry.label}
                  {entry.badge ? <span className="ml-1.5 text-ink-3">{entry.badge}</span> : null}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {run.live ? (
              <button
                type="button"
                onClick={() => setView("run")}
                className="flex items-center gap-2 rounded-md border border-accent bg-accent-soft px-3 py-1.5 text-[12.5px] text-ink"
              >
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" />
                run in progress
              </button>
            ) : null}
            {health && !health.ok ? (
              <div className="rounded-md border border-bad/40 bg-bad/10 px-3 py-1.5 text-[12px] text-bad">
                <span className="font-medium">Agents cannot authenticate.</span>{" "}
                {health.hint ?? health.error}
              </div>
            ) : health?.billing === "subscription" ? (
              <span className="text-[11.5px] text-ink-3">on your Claude subscription</span>
            ) : health?.billing === "api-credits" ? (
              <span className="text-[11.5px] text-warn">billed to API credits</span>
            ) : null}
          </div>
        </div>
      </header>

      {run.error ? (
        <div className="mb-4 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-[13px] text-bad">
          {run.error}
        </div>
      ) : null}
      {notice ? (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-line bg-raise px-3 py-2 text-[13px] text-ink-2">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="text-ink-3 hover:text-ink">
            dismiss
          </button>
        </div>
      ) : null}

      {view === "run" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className="space-y-4">
            {seededFrom ? (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2.5">
                <p className="text-[12.5px] leading-relaxed text-ink-2">
                  Seeded from <span className="text-ink">{seededFrom}</span>. Adjust the depth and
                  lenses, then deploy.
                </p>
                <button
                  type="button"
                  onClick={() => setSeededFrom(null)}
                  className="shrink-0 text-[12px] text-ink-3 hover:text-ink"
                >
                  clear
                </button>
              </div>
            ) : null}

            <ConfigPanel
              config={config}
              onChange={setConfig}
              onRun={() => {
                setSeededFrom(null);
                void run.start(config);
              }}
              running={run.live}
            />
          </div>

          <div className="min-w-0">
            {run.report ? (
              <ReportView
                report={run.report}
                onReset={run.clear}
                savedIdeaKeys={savedKeys}
                onSaveIdea={(idea) => void saveIdea(idea, run.report!.runId, run.report!.topic)}
                onUnsaveIdea={(idea) => void unsaveIdea(idea, run.report!.runId)}
                onDigDeeper={(idea) => digDeeper(idea, run.report!.topic)}
              />
            ) : showRun ? (
              <RunStream run={run.run} onStop={() => void run.stop()} topic={activeTopic} />
            ) : (
              <Panel>
                <div className="space-y-3 px-5 py-10">
                  <p className="text-[14px] text-ink">Nothing running.</p>
                  <p className="max-w-lg text-[13px] leading-relaxed text-ink-2">
                    Describe a topic on the left and pick your lenses. A framing agent sharpens the
                    question, then a prior-art scout and a gap analyst work the web in parallel, each
                    fanning out to deep-dive subagents that read single sources properly. An idea
                    generator crosses the gaps against adjacent fields, and a critic tries to kill
                    every idea before you see it.
                  </p>
                  <p className="max-w-lg text-[13px] leading-relaxed text-ink-3">
                    Runs live on the server, so you can close this tab or refresh mid-run and pick
                    the stream back up where it was.
                  </p>
                </div>
              </Panel>
            )}
          </div>
        </div>
      ) : null}

      {view === "library" ? (
        <Library reports={reports} onOpen={openReport} onDelete={deleteReport} busy={busy} />
      ) : null}

      {view === "shortlist" ? (
        <Shortlist
          items={saved}
          onRemove={async (savedId) => {
            await fetch(`/api/saved/${savedId}`, { method: "DELETE" });
            await refreshSaved();
          }}
          onNote={async (savedId, note) => {
            await fetch(`/api/saved/${savedId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ note }),
            });
            await refreshSaved();
          }}
          onDigDeeper={digDeeper}
          onOpenRun={openReport}
        />
      ) : null}
    </div>
  );
}
