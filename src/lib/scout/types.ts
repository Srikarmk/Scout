export type LensId = "prior-art" | "gaps" | "ideation" | "critique";

export type Depth = "quick" | "standard" | "deep" | "exhaustive";

export type Angle =
  | "research-paper"
  | "product"
  | "startup"
  | "open-source"
  | "learning";

export type TimeBudget = "weekend" | "two-weeks" | "semester" | "open-ended";

export type TeamSize = "solo" | "pair" | "team";

export type SourceMix = "academic" | "oss" | "industry" | "community" | "market";

export type ModelChoice = "opus" | "sonnet";

export type Recency = "any" | "36" | "24" | "12" | "6";

export interface ScoutConfig {
  topic: string;
  /** Free text: an existing project to improve, rather than a blank-slate topic. */
  existingProject: string;
  lenses: LensId[];
  depth: Depth;
  angle: Angle;
  timeBudget: TimeBudget;
  teamSize: TeamSize;
  /** 0 = safe incremental improvements, 100 = moonshot. */
  novelty: number;
  ideaCount: number;
  sources: SourceMix[];
  recencyMonths: Recency;
  constraints: string;
  avoid: string;
  model: ModelChoice;
}

export interface Source {
  title: string;
  url: string;
  why?: string;
}

export interface Gap {
  title: string;
  detail: string;
  evidence: string;
  sources: Source[];
}

export interface Idea {
  id: string;
  title: string;
  oneLiner: string;
  whyNow: string;
  novelty: number;
  feasibility: number;
  impact: number;
  noveltyRationale: string;
  closestPriorArt: string;
  differentiator: string;
  firstMilestone: string;
  stack: string[];
  risks: string[];
  killCriteria: string[];
  effort: string;
  sources: Source[];
  verdict: string;
}

export interface ScoutReport {
  runId: string;
  topic: string;
  createdAt: string;
  config: ScoutConfig;
  summary: string;
  landscape: string;
  gaps: Gap[];
  ideas: Idea[];
  openQuestions: string[];
  readingList: Source[];
  phases: Record<string, string>;
  costUsd: number;
  durationMs: number;
}

export interface PhaseMeta {
  id: string;
  label: string;
  blurb: string;
}

export type ScoutEvent =
  | { type: "run-start"; runId: string; phases: PhaseMeta[]; config: ScoutConfig }
  | { type: "phase-start"; phase: string }
  | { type: "phase-end"; phase: string; ok: boolean; costUsd: number; durationMs: number }
  | { type: "agent-start"; agent: string; label: string; phase: string; model: string }
  | { type: "agent-end"; agent: string; ok: boolean; costUsd: number; turns: number; error?: string }
  | { type: "agent-text"; agent: string; text: string; nested: boolean }
  | { type: "agent-tool"; agent: string; tool: string; detail: string; nested: boolean }
  | { type: "agent-tools-available"; agent: string; tools: string[] }
  | { type: "log"; level: "info" | "warn" | "error"; message: string }
  | { type: "report"; report: ScoutReport }
  | { type: "run-end"; runId: string; costUsd: number; durationMs: number; error?: string };

export interface ReportSummary {
  runId: string;
  topic: string;
  createdAt: string;
  ideaCount: number;
  costUsd: number;
  angle: Angle;
  depth: Depth;
}
