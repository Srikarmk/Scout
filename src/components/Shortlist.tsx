"use client";

import type { SavedIdea } from "@/lib/scout/saved";
import type { Idea } from "@/lib/scout/types";
import IdeaCard from "./IdeaCard";
import { Panel } from "./ui";

export default function Shortlist({
  items,
  onRemove,
  onNote,
  onDigDeeper,
  onOpenRun,
}: {
  items: SavedIdea[];
  onRemove: (savedId: string) => void;
  onNote: (savedId: string, note: string) => void;
  onDigDeeper: (idea: Idea, topic: string) => void;
  onOpenRun: (runId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <Panel>
        <div className="space-y-2 px-5 py-10">
          <p className="text-[14px] text-ink">Nothing saved yet.</p>
          <p className="max-w-lg text-[13px] leading-relaxed text-ink-2">
            Hit <span className="text-ink">save</span> on any idea in a report and it lands here, with
            the run it came from and room for your own notes. The shortlist is the thing to export
            once you have run a few topics: it is your cross-run comparison.
          </p>
        </div>
      </Panel>
    );
  }

  const groups = new Map<string, SavedIdea[]>();
  for (const item of items) {
    groups.set(item.runId, [...(groups.get(item.runId) ?? []), item]);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink-2">
          {items.length} idea{items.length === 1 ? "" : "s"} across {groups.size} run
          {groups.size === 1 ? "" : "s"}
        </p>
        <div className="flex gap-2">
          {/* A binary download, not a page: next/link would client-side navigate. */}
          <a
            download
            href="/api/saved/pdf"
            className="rounded-md border border-accent bg-accent-soft px-3 py-1.5 text-[12.5px] text-ink hover:bg-accent/20"
          >
            Download shortlist PDF
          </a>
          <a
            href="/api/saved/pdf?inline=1"
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-md border border-line bg-raise px-2.5 py-1.5 text-[12.5px] text-ink-2 hover:text-ink"
          >
            preview
          </a>
        </div>
      </div>

      {[...groups.entries()].map(([runId, group]) => (
        <section key={runId} className="space-y-2.5">
          <header className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
            <h2 className="truncate text-[13px] font-medium text-ink">
              {group[0].topic || "Untitled run"}
            </h2>
            <button
              type="button"
              onClick={() => onOpenRun(runId)}
              className="shrink-0 text-[12px] text-ink-3 hover:text-ink"
            >
              open full report
            </button>
          </header>

          {group.map((entry) => (
            <div key={entry.savedId} className="space-y-1">
              <IdeaCard
                idea={entry.idea}
                saved
                onUnsave={() => onRemove(entry.savedId)}
                note={entry.note}
                onNoteChange={(note) => onNote(entry.savedId, note)}
                onDigDeeper={() => onDigDeeper(entry.idea, entry.topic)}
                defaultOpen={false}
              />
              <p className="px-1 font-mono text-[11px] text-ink-3">
                saved {new Date(entry.savedAt).toLocaleString()}
              </p>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
