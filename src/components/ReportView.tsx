"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Idea, ScoutReport } from "@/lib/scout/types";
import IdeaCard, { List, hostOf } from "./IdeaCard";
import { Panel } from "./ui";

function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-scout">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: inner }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {inner}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

const TABS = [
  { id: "ideas", label: "Ideas" },
  { id: "gaps", label: "Gaps" },
  { id: "landscape", label: "Landscape" },
  { id: "reading", label: "Reading list" },
  { id: "raw", label: "Agent transcripts" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ReportView({
  report,
  onReset,
  savedIdeaKeys,
  onSaveIdea,
  onUnsaveIdea,
  onDigDeeper,
}: {
  report: ScoutReport;
  onReset: () => void;
  savedIdeaKeys: Set<string>;
  onSaveIdea: (idea: Idea) => void;
  onUnsaveIdea: (idea: Idea) => void;
  onDigDeeper: (idea: Idea) => void;
}) {
  const [tab, setTab] = useState<TabId>("ideas");
  const [openPhase, setOpenPhase] = useState<string | null>(null);

  const key = (idea: Idea) => `${report.runId}:${idea.id}`;
  const savedCount = report.ideas.filter((idea) => savedIdeaKeys.has(key(idea))).length;

  return (
    <div className="space-y-4">
      <Panel>
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[17px] font-medium text-ink">{report.topic}</h1>
              <div className="mt-1 flex flex-wrap gap-3 font-mono text-[11.5px] tabular-nums text-ink-3">
                <span>{new Date(report.createdAt).toLocaleString()}</span>
                <span>${report.costUsd.toFixed(2)} of usage</span>
                <span>{Math.round(report.durationMs / 60000)} min</span>
                <span>{report.config.depth} depth</span>
                <span>{report.config.model}</span>
                {savedCount > 0 ? <span className="text-warn">{savedCount} saved</span> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                download
                href={`/api/reports/${report.runId}/pdf`}
                className="rounded-md border border-accent bg-accent-soft px-3 py-1.5 text-[12.5px] text-ink hover:bg-accent/20"
              >
                Download PDF
              </a>
              <a
                href={`/api/reports/${report.runId}/pdf?inline=1`}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-md border border-line bg-raise px-2.5 py-1.5 text-[12.5px] text-ink-2 hover:text-ink"
              >
                preview
              </a>
              <button
                type="button"
                onClick={onReset}
                className="rounded-md border border-line bg-raise px-2.5 py-1.5 text-[12.5px] text-ink-2 hover:text-ink"
              >
                new run
              </button>
            </div>
          </div>
          <p className="text-[13.5px] leading-relaxed text-ink-2">{report.summary}</p>
        </div>
      </Panel>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((entry) => {
          const count =
            entry.id === "ideas"
              ? report.ideas.length
              : entry.id === "gaps"
                ? report.gaps.length
                : entry.id === "reading"
                  ? report.readingList.length
                  : undefined;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={[
                "rounded-md border px-3 py-1.5 text-[12.5px] transition-colors",
                tab === entry.id
                  ? "border-accent bg-accent-soft text-ink"
                  : "border-line bg-raise text-ink-2 hover:border-line-strong hover:text-ink",
              ].join(" ")}
            >
              {entry.label}
              {count !== undefined ? <span className="ml-1.5 text-ink-3">{count}</span> : null}
            </button>
          );
        })}
      </div>

      {tab === "ideas" ? (
        <div className="space-y-2.5">
          {report.ideas.length === 0 ? (
            <Panel>
              <p className="p-4 text-[13px] text-ink-3">
                No ideas came back. The agent transcripts tab shows where it stopped.
              </p>
            </Panel>
          ) : (
            report.ideas.map((idea, index) => (
              <IdeaCard
                key={idea.id || index}
                idea={idea}
                rank={index + 1}
                saved={savedIdeaKeys.has(key(idea))}
                onSave={() => onSaveIdea(idea)}
                onUnsave={() => onUnsaveIdea(idea)}
                onDigDeeper={() => onDigDeeper(idea)}
              />
            ))
          )}
          {report.openQuestions.length > 0 ? (
            <Panel title="What the research could not settle">
              <div className="p-4">
                <List label="Open questions" items={report.openQuestions} />
              </div>
            </Panel>
          ) : null}
        </div>
      ) : null}

      {tab === "gaps" ? (
        <div className="space-y-2.5">
          {report.gaps.map((gap, index) => (
            <Panel key={index} title={gap.title}>
              <div className="space-y-3 p-4">
                <p className="text-[13.5px] leading-relaxed text-ink-2">{gap.detail}</p>
                {gap.evidence ? (
                  <blockquote className="border-l-2 border-line-strong pl-3 text-[13px] leading-relaxed text-ink-3">
                    {gap.evidence}
                  </blockquote>
                ) : null}
                {gap.sources.length > 0 ? (
                  <ul className="space-y-1">
                    {gap.sources.map((source, i) => (
                      <li key={i} className="text-[12.5px]">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-accent hover:underline"
                        >
                          {source.title || hostOf(source.url)}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Panel>
          ))}
          {report.gaps.length === 0 ? (
            <Panel>
              <p className="p-4 text-[13px] text-ink-3">The gap lens was off for this run.</p>
            </Panel>
          ) : null}
        </div>
      ) : null}

      {tab === "landscape" ? (
        <Panel>
          <div className="p-4">
            {report.landscape ? (
              <Markdown>{report.landscape}</Markdown>
            ) : (
              <p className="text-[13px] text-ink-3">The prior-art lens was off for this run.</p>
            )}
          </div>
        </Panel>
      ) : null}

      {tab === "reading" ? (
        <Panel title="Worth your time">
          <ul className="divide-y divide-line">
            {report.readingList.map((source, i) => (
              <li key={i} className="px-4 py-3">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[13.5px] text-accent hover:underline"
                >
                  {source.title || hostOf(source.url)}
                </a>
                <div className="mt-0.5 text-[12px] text-ink-3">{hostOf(source.url)}</div>
                {source.why ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{source.why}</p>
                ) : null}
              </li>
            ))}
            {report.readingList.length === 0 ? (
              <li className="px-4 py-3 text-[13px] text-ink-3">Nothing was flagged as required reading.</li>
            ) : null}
          </ul>
        </Panel>
      ) : null}

      {tab === "raw" ? (
        <div className="space-y-2.5">
          {Object.entries(report.phases).map(([phase, text]) => (
            <Panel
              key={phase}
              title={phase}
              right={
                <button
                  type="button"
                  onClick={() => setOpenPhase(openPhase === phase ? null : phase)}
                  className="text-[12px] text-ink-3 hover:text-ink"
                >
                  {openPhase === phase ? "collapse" : "expand"}
                </button>
              }
            >
              {openPhase === phase ? (
                <div className="p-4">
                  <Markdown>{text}</Markdown>
                </div>
              ) : (
                <p className="truncate px-4 py-3 text-[12.5px] text-ink-3">
                  {text.replace(/\s+/g, " ").slice(0, 160)}
                </p>
              )}
            </Panel>
          ))}
        </div>
      ) : null}
    </div>
  );
}
