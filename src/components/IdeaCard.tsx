"use client";

import { useState } from "react";
import type { Idea } from "@/lib/scout/types";
import { Meter, VerdictBadge } from "./ui";

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

export function Row({ label, children }: { label: string; children?: string }) {
  if (!children) return null;
  return (
    <div className="space-y-1">
      <div className="text-[11.5px] uppercase tracking-wide text-ink-3">{label}</div>
      <p className="text-[13.5px] leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}

export function List({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5">
      <div className="text-[11.5px] uppercase tracking-wide text-ink-3">{label}</div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-2">
            <span className="text-ink-3">-</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function IdeaCard({
  idea,
  rank,
  saved,
  onSave,
  onUnsave,
  onDigDeeper,
  note,
  onNoteChange,
  defaultOpen,
}: {
  idea: Idea;
  rank?: number;
  saved?: boolean;
  onSave?: () => void;
  onUnsave?: () => void;
  onDigDeeper?: () => void;
  note?: string;
  onNoteChange?: (note: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? rank === 1);
  const [draft, setDraft] = useState(note ?? "");
  const [editingNote, setEditingNote] = useState(false);

  return (
    <article className="rounded-xl border border-line bg-panel">
      <div className="flex items-start gap-3 px-4 py-3.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          {rank ? (
            <span className="mt-0.5 font-mono text-[13px] tabular-nums text-ink-3">
              {String(rank).padStart(2, "0")}
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-medium text-ink">{idea.title}</span>
              <VerdictBadge verdict={idea.verdict} />
            </span>
            <span className="mt-1 block text-[13px] leading-relaxed text-ink-2">{idea.oneLiner}</span>
          </span>
        </button>

        <div className="hidden w-52 shrink-0 grid-cols-3 gap-3 sm:grid">
          <Meter label="Nov" value={idea.novelty} />
          <Meter label="Feas" value={idea.feasibility} />
          <Meter label="Imp" value={idea.impact} />
        </div>

        {onSave || onUnsave ? (
          <button
            type="button"
            title={saved ? "Remove from shortlist" : "Save to shortlist"}
            onClick={() => (saved ? onUnsave?.() : onSave?.())}
            className={[
              "mt-0.5 shrink-0 rounded-md border px-2 py-1 text-[11.5px] transition-colors",
              saved
                ? "border-warn/50 bg-warn/10 text-warn"
                : "border-line bg-raise text-ink-3 hover:border-line-strong hover:text-ink",
            ].join(" ")}
          >
            {saved ? "saved" : "save"}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="space-y-4 border-t border-line px-4 py-4">
          <div className="grid gap-4 sm:hidden sm:grid-cols-3">
            <Meter label="Novelty" value={idea.novelty} />
            <Meter label="Feasibility" value={idea.feasibility} />
            <Meter label="Impact" value={idea.impact} />
          </div>

          <Row label="Why now">{idea.whyNow}</Row>
          <Row label="Closest prior art">{idea.closestPriorArt}</Row>
          <Row label="What makes it different">{idea.differentiator}</Row>
          <Row label="Why the scores">{idea.noveltyRationale}</Row>
          <Row label="First milestone">{idea.firstMilestone}</Row>
          {idea.effort ? <Row label="Effort">{idea.effort}</Row> : null}

          {idea.stack.length > 0 ? (
            <div className="space-y-1.5">
              <div className="text-[11.5px] uppercase tracking-wide text-ink-3">Stack</div>
              <div className="flex flex-wrap gap-1.5">
                {idea.stack.map((item, i) => (
                  <span
                    key={i}
                    className="rounded-md border border-line bg-raise px-2 py-0.5 font-mono text-[11.5px] text-ink-2"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <List label="Risks" items={idea.risks} />
            <List label="Kill criteria" items={idea.killCriteria} />
          </div>

          {idea.sources.length > 0 ? (
            <div className="space-y-1.5">
              <div className="text-[11.5px] uppercase tracking-wide text-ink-3">Sources</div>
              <ul className="space-y-1">
                {idea.sources.map((source, i) => (
                  <li key={i} className="text-[12.5px] leading-relaxed">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-accent hover:underline"
                    >
                      {source.title || hostOf(source.url)}
                    </a>
                    <span className="ml-2 text-ink-3">{hostOf(source.url)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {onNoteChange ? (
            <div className="space-y-1.5">
              <div className="text-[11.5px] uppercase tracking-wide text-ink-3">Your note</div>
              {editingNote ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    rows={3}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="What you think, what to check first, who to ask."
                    className="w-full resize-y rounded-lg border border-line bg-raise px-3 py-2 text-[13px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onNoteChange(draft);
                        setEditingNote(false);
                      }}
                      className="rounded-md border border-accent bg-accent-soft px-2.5 py-1 text-[12px] text-ink"
                    >
                      save note
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(note ?? "");
                        setEditingNote(false);
                      }}
                      className="rounded-md border border-line bg-raise px-2.5 py-1 text-[12px] text-ink-3"
                    >
                      cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingNote(true)}
                  className="w-full rounded-lg border border-dashed border-line bg-raise px-3 py-2 text-left text-[13px] text-ink-2 hover:border-line-strong"
                >
                  {note?.trim() || "Add a note"}
                </button>
              )}
            </div>
          ) : null}

          {onDigDeeper ? (
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              <button
                type="button"
                onClick={onDigDeeper}
                className="rounded-md border border-accent bg-accent-soft px-3 py-1.5 text-[12.5px] text-ink hover:bg-accent/20"
              >
                Dig deeper on this
              </button>
              <span className="self-center text-[12px] text-ink-3">
                starts a new run scoped to this idea
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
