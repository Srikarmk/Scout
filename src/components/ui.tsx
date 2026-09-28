"use client";

import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        {hint ? <span className="text-[12px] text-ink-3">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ value: T; label: string; blurb?: string }>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            title={option.blurb}
            onClick={() => onChange(option.value)}
            className={[
              "rounded-md border px-2.5 py-1.5 text-[12.5px] transition-colors disabled:opacity-50",
              active
                ? "border-accent bg-accent-soft text-ink"
                : "border-line bg-raise text-ink-2 hover:border-line-strong hover:text-ink",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ChipToggle({
  label,
  blurb,
  active,
  onToggle,
  disabled,
}: {
  label: string;
  blurb?: string;
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={blurb}
      onClick={onToggle}
      className={[
        "rounded-md border px-2.5 py-1.5 text-[12.5px] transition-colors disabled:opacity-50",
        active
          ? "border-accent bg-accent-soft text-ink"
          : "border-line bg-raise text-ink-3 hover:border-line-strong hover:text-ink-2",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-accent disabled:opacity-50"
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled,
  mono,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={[
        "w-full resize-y rounded-lg border border-line bg-raise px-3 py-2.5 text-[13.5px] leading-relaxed text-ink",
        "placeholder:text-ink-3 focus:border-accent focus:outline-none disabled:opacity-50",
        mono ? "font-mono text-[12.5px]" : "",
      ].join(" ")}
    />
  );
}

/** Same-ramp meter: one hue, track one step off the surface. Never a second hue. */
export function Meter({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11.5px] uppercase tracking-wide text-ink-3">{label}</span>
        <span className="font-mono text-[13px] tabular-nums text-ink">{pct}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const VERDICT_STYLE: Record<string, string> = {
  "BUILD THIS": "border-good/40 bg-good/10 text-good",
  "PROMISING WITH CHANGES": "border-accent/40 bg-accent/10 text-accent",
  "RISKY BUT INTERESTING": "border-warn/40 bg-warn/10 text-warn",
  DEAD: "border-bad/40 bg-bad/10 text-bad",
  UNVETTED: "border-line-strong bg-raise text-ink-3",
};

export function VerdictBadge({ verdict }: { verdict: string }) {
  const key = verdict.trim().toUpperCase();
  const style = VERDICT_STYLE[key] ?? "border-line bg-raise text-ink-2";
  return (
    <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${style}`}>
      {key || "UNRATED"}
    </span>
  );
}

export function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-line bg-panel ${className}`}>
      {title ? (
        <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-[13px] font-medium text-ink">{title}</h2>
          {right}
        </header>
      ) : null}
      {children}
    </section>
  );
}
