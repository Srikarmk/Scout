"use client";

import { useState } from "react";
import {
  ANGLES,
  DEPTHS,
  DEPTH_PROFILES,
  LENSES,
  MODELS,
  PRESETS,
  RECENCY,
  SOURCES,
  TEAM_SIZES,
  TIME_BUDGETS,
} from "@/lib/scout/config";
import type { ScoutConfig } from "@/lib/scout/types";
import { ChipToggle, Field, Panel, Segmented, Slider, TextArea } from "./ui";

function noveltyWord(n: number): string {
  if (n < 25) return "incremental";
  if (n < 50) return "recombinant";
  if (n < 75) return "new ground";
  return "moonshot";
}

export default function ConfigPanel({
  config,
  onChange,
  onRun,
  running,
}: {
  config: ScoutConfig;
  onChange: (next: ScoutConfig) => void;
  onRun: () => void;
  running: boolean;
}) {
  const [advanced, setAdvanced] = useState(false);
  const patch = (next: Partial<ScoutConfig>) => onChange({ ...config, ...next });
  const profile = DEPTH_PROFILES[config.depth];

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const agentCount =
    1 +
    (config.lenses.includes("prior-art") ? 1 : 0) +
    (config.lenses.includes("gaps") ? 1 : 0) +
    (config.lenses.includes("ideation") ? 1 : 0) +
    (config.lenses.includes("critique") && config.lenses.includes("ideation") ? 1 : 0) +
    1;
  const scoutCount =
    (config.lenses.includes("prior-art") ? 1 : 0) + (config.lenses.includes("gaps") ? 1 : 0);
  const fanOut = scoutCount * profile.deepDives;

  return (
    <div className="space-y-4">
      <Panel>
        <div className="space-y-3 p-4">
          <Field label="What should I go research?" hint="a topic, a question, or a domain you are circling">
            <TextArea
              value={config.topic}
              onChange={(topic) => patch({ topic })}
              rows={3}
              disabled={running}
              placeholder="e.g. local-first sync engines for collaborative apps, or: why is on-device speech recognition still bad for accented English"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[12px] text-ink-3">Presets</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={running}
                title={preset.blurb}
                onClick={() => patch(preset.patch)}
                className="rounded-md border border-line bg-raise px-2.5 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Research lenses" right={<span className="text-[12px] text-ink-3">each one is its own agent</span>}>
        <div className="grid gap-2 p-4 sm:grid-cols-2">
          {LENSES.map((lens) => {
            const active = config.lenses.includes(lens.value);
            const dependsOnIdeation = lens.value === "critique" && !config.lenses.includes("ideation");
            return (
              <button
                key={lens.value}
                type="button"
                disabled={running}
                onClick={() => patch({ lenses: toggle(config.lenses, lens.value) })}
                className={[
                  "rounded-lg border p-3 text-left transition-colors disabled:opacity-50",
                  active
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-raise hover:border-line-strong",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[13px] font-medium ${active ? "text-ink" : "text-ink-2"}`}>
                    {lens.label}
                  </span>
                  <span
                    className={[
                      "h-3.5 w-3.5 rounded-[4px] border",
                      active ? "border-accent bg-accent" : "border-line-strong",
                    ].join(" ")}
                  />
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-3">{lens.blurb}</p>
                {active && dependsOnIdeation ? (
                  <p className="mt-1.5 text-[11.5px] text-warn">
                    Needs idea generation on; it will be skipped otherwise.
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title="Shape of the answer">
        <div className="space-y-5 p-4">
          <Field label="What are you trying to end up with?">
            <Segmented options={ANGLES} value={config.angle} onChange={(angle) => patch({ angle })} disabled={running} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Time you have">
              <Segmented
                options={TIME_BUDGETS}
                value={config.timeBudget}
                onChange={(timeBudget) => patch({ timeBudget })}
                disabled={running}
              />
            </Field>
            <Field label="Who is building it">
              <Segmented
                options={TEAM_SIZES}
                value={config.teamSize}
                onChange={(teamSize) => patch({ teamSize })}
                disabled={running}
              />
            </Field>
          </div>

          <Field
            label="Novelty appetite"
            hint={`${config.novelty}/100 — ${noveltyWord(config.novelty)}`}
          >
            <Slider value={config.novelty} min={0} max={100} step={5} onChange={(novelty) => patch({ novelty })} disabled={running} />
            <div className="flex justify-between text-[11.5px] text-ink-3">
              <span>proven improvements</span>
              <span>unexplored ground</span>
            </div>
          </Field>

          <Field label="How many ideas" hint={`${config.ideaCount}`}>
            <Slider value={config.ideaCount} min={3} max={12} onChange={(ideaCount) => patch({ ideaCount })} disabled={running} />
          </Field>
        </div>
      </Panel>

      <Panel title="How hard to look">
        <div className="space-y-5 p-4">
          <Field label="Depth" hint={DEPTHS.find((d) => d.value === config.depth)?.blurb}>
            <Segmented options={DEPTHS} value={config.depth} onChange={(depth) => patch({ depth })} disabled={running} />
          </Field>

          <Field label="Sources to favour" hint="drives where the scouts look first">
            <div className="flex flex-wrap gap-1.5">
              {SOURCES.map((source) => (
                <ChipToggle
                  key={source.value}
                  label={source.label}
                  blurb={source.blurb}
                  active={config.sources.includes(source.value)}
                  onToggle={() => patch({ sources: toggle(config.sources, source.value) })}
                  disabled={running}
                />
              ))}
            </div>
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Recency">
              <Segmented
                options={RECENCY}
                value={config.recencyMonths}
                onChange={(recencyMonths) => patch({ recencyMonths })}
                disabled={running}
              />
            </Field>
            <Field label="Model">
              <Segmented options={MODELS} value={config.model} onChange={(model) => patch({ model })} disabled={running} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-lg border border-line bg-raise p-3">
            <div>
              <div className="text-[11.5px] uppercase tracking-wide text-ink-3">Agents</div>
              <div className="font-mono text-[18px] tabular-nums text-ink">{agentCount}</div>
            </div>
            <div>
              <div className="text-[11.5px] uppercase tracking-wide text-ink-3">Deep dives</div>
              <div className="font-mono text-[18px] tabular-nums text-ink">{fanOut}</div>
            </div>
            <div>
              <div className="text-[11.5px] uppercase tracking-wide text-ink-3">Cost ceiling</div>
              <div className="font-mono text-[18px] tabular-nums text-ink">
                ${Math.round(profile.budgetUsd * 3)}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="Constraints"
        right={
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="text-[12px] text-ink-3 hover:text-ink"
          >
            {advanced ? "hide" : "show"}
          </button>
        }
      >
        {advanced ? (
          <div className="space-y-4 p-4">
            <Field label="Hard constraints" hint="any idea that violates these is thrown out">
              <TextArea
                value={config.constraints}
                onChange={(constraints) => patch({ constraints })}
                rows={2}
                disabled={running}
                placeholder="e.g. no GPU budget; must run offline; TypeScript only; cannot collect user data"
              />
            </Field>
            <Field label="Already tried or not interested in">
              <TextArea
                value={config.avoid}
                onChange={(avoid) => patch({ avoid })}
                rows={2}
                disabled={running}
                placeholder="e.g. I already built a RAG chatbot for this; no browser extensions"
              />
            </Field>
            <Field
              label="An existing project to improve"
              hint="paste a README or a description and the ideas will build on it"
            >
              <TextArea
                value={config.existingProject}
                onChange={(existingProject) => patch({ existingProject })}
                rows={5}
                disabled={running}
                mono
                placeholder="Leave empty for a blank-slate search."
              />
            </Field>
          </div>
        ) : (
          <div className="px-4 py-3 text-[12.5px] text-ink-3">
            {config.constraints || config.avoid || config.existingProject
              ? "Set. Click show to edit."
              : "Optional: hard constraints, dead ends to skip, or an existing project to improve."}
          </div>
        )}
      </Panel>

      <button
        type="button"
        disabled={running || config.topic.trim().length < 3 || config.lenses.length === 0}
        onClick={onRun}
        className="w-full rounded-lg border border-accent bg-accent-soft py-3 text-[14px] font-medium text-ink transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:border-line disabled:bg-raise disabled:text-ink-3"
      >
        {running ? "Researching..." : `Deploy ${agentCount} agents`}
      </button>
    </div>
  );
}
