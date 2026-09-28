"use client";

import type { ReportSummary } from "@/lib/scout/types";
import { Panel } from "./ui";

export default function Library({
  reports,
  onOpen,
  onDelete,
  busy,
}: {
  reports: ReportSummary[];
  onOpen: (runId: string) => void;
  onDelete: (runId: string) => void;
  busy: boolean;
}) {
  if (reports.length === 0) {
    return (
      <Panel>
        <div className="space-y-2 px-5 py-10">
          <p className="text-[14px] text-ink">No finished reports yet.</p>
          <p className="max-w-lg text-[13px] leading-relaxed text-ink-2">
            Every completed run is written to <code className="text-ink-3">.scout/reports/</code> and
            shows up here, so you can come back to it, export a PDF, or pull ideas into the shortlist.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
      {reports.map((report) => (
        <article
          key={report.runId}
          className="flex flex-col justify-between rounded-xl border border-line bg-panel p-4"
        >
          <button type="button" onClick={() => onOpen(report.runId)} className="text-left">
            <h3 className="line-clamp-2 text-[14px] font-medium leading-snug text-ink">
              {report.topic}
            </h3>
            <div className="mt-2 flex flex-wrap gap-2.5 font-mono text-[11.5px] tabular-nums text-ink-3">
              <span>{new Date(report.createdAt).toLocaleDateString()}</span>
              <span className="text-ink-2">{report.ideaCount} ideas</span>
              <span>${report.costUsd.toFixed(2)}</span>
            </div>
            <div className="mt-1 flex gap-2 text-[11.5px] text-ink-3">
              <span>{report.angle}</span>
              <span>·</span>
              <span>{report.depth}</span>
            </div>
          </button>

          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => onOpen(report.runId)}
              className="rounded-md border border-line bg-raise px-2.5 py-1 text-[12px] text-ink-2 hover:text-ink"
            >
              open
            </button>
            <a
              download
              href={`/api/reports/${report.runId}/pdf`}
              className="rounded-md border border-line bg-raise px-2.5 py-1 text-[12px] text-ink-2 hover:text-ink"
            >
              pdf
            </a>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDelete(report.runId)}
              className="ml-auto text-[12px] text-ink-3 hover:text-bad disabled:opacity-50"
            >
              delete
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
