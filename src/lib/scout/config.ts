import type {
  Angle,
  Depth,
  LensId,
  ModelChoice,
  Recency,
  ScoutConfig,
  SourceMix,
  TeamSize,
  TimeBudget,
} from "./types";

export interface Option<T extends string> {
  value: T;
  label: string;
  blurb: string;
}

export const LENSES: Array<Option<LensId>> = [
  {
    value: "prior-art",
    label: "Prior art",
    blurb: "What already exists: papers, repos, products, and who is doing it well.",
  },
  {
    value: "gaps",
    label: "Gap analysis",
    blurb: "Where the existing work falls down: limitations, open issues, complaints.",
  },
  {
    value: "ideation",
    label: "Idea generation",
    blurb: "Concrete project ideas, each with a why-now and a first milestone.",
  },
  {
    value: "critique",
    label: "Feasibility critique",
    blurb: "Red-teams every idea and scores it, so the output is ranked, not a wish list.",
  },
];

export const DEPTHS: Array<Option<Depth>> = [
  { value: "quick", label: "Quick", blurb: "One pass per lens, no deep dives. ~2-4 min." },
  { value: "standard", label: "Standard", blurb: "Each scout takes 2 deep dives. ~5-9 min." },
  { value: "deep", label: "Deep", blurb: "4 deep dives per scout, wider search. ~10-18 min." },
  { value: "exhaustive", label: "Exhaustive", blurb: "6+ deep dives, maximum effort. 20 min+." },
];

export const ANGLES: Array<Option<Angle>> = [
  {
    value: "research-paper",
    label: "Research contribution",
    blurb: "Publishable novelty. Needs a falsifiable claim and a baseline to beat.",
  },
  {
    value: "product",
    label: "Shippable product",
    blurb: "Something real users touch. Novelty matters less than a job done well.",
  },
  {
    value: "startup",
    label: "Startup wedge",
    blurb: "A market entry point: who pays, why now, why incumbents will not.",
  },
  {
    value: "open-source",
    label: "Open-source tool",
    blurb: "Developer-facing. Adoption comes from a sharp, unmet workflow pain.",
  },
  {
    value: "learning",
    label: "Learning project",
    blurb: "Built to teach you a skill. Optimizes for depth of understanding per hour.",
  },
];

export const TIME_BUDGETS: Array<Option<TimeBudget>> = [
  { value: "weekend", label: "A weekend", blurb: "Under ~20 hours of build time." },
  { value: "two-weeks", label: "Two weeks", blurb: "A focused sprint, maybe 60-80 hours." },
  { value: "semester", label: "A semester", blurb: "Three to four months, part time." },
  { value: "open-ended", label: "Open-ended", blurb: "No deadline. Ambition is allowed to win." },
];

export const TEAM_SIZES: Array<Option<TeamSize>> = [
  { value: "solo", label: "Solo", blurb: "Just you." },
  { value: "pair", label: "Two people", blurb: "You and one collaborator." },
  { value: "team", label: "Small team", blurb: "Three or more." },
];

export const SOURCES: Array<Option<SourceMix>> = [
  { value: "academic", label: "Academic", blurb: "arXiv, ACL, NeurIPS, journals, preprints." },
  { value: "oss", label: "Open source", blurb: "GitHub repos, issue trackers, RFCs, changelogs." },
  { value: "industry", label: "Industry", blurb: "Engineering blogs, tech reports, docs." },
  { value: "community", label: "Community", blurb: "HN, Reddit, forums, Discord digests." },
  { value: "market", label: "Market", blurb: "Products, pricing, funding, launches." },
];

export const RECENCY: Array<Option<Recency>> = [
  { value: "any", label: "Any age", blurb: "Foundational work counts." },
  { value: "36", label: "Last 3 years", blurb: "" },
  { value: "24", label: "Last 2 years", blurb: "" },
  { value: "12", label: "Last 12 months", blurb: "" },
  { value: "6", label: "Last 6 months", blurb: "Bleeding edge only." },
];

export const MODELS: Array<Option<ModelChoice>> = [
  { value: "opus", label: "Opus", blurb: "Best judgment. Slower, pricier." },
  { value: "sonnet", label: "Sonnet", blurb: "Faster and cheaper. Good for quick sweeps." },
];

export interface DepthProfile {
  scoutMaxTurns: number;
  synthMaxTurns: number;
  deepDives: number;
  searchesPerScout: number;
  effort: "low" | "medium" | "high" | "xhigh";
  budgetUsd: number;
}

export const DEPTH_PROFILES: Record<Depth, DepthProfile> = {
  quick: {
    scoutMaxTurns: 14,
    synthMaxTurns: 10,
    deepDives: 0,
    searchesPerScout: 4,
    effort: "medium",
    budgetUsd: 2,
  },
  standard: {
    scoutMaxTurns: 28,
    synthMaxTurns: 16,
    deepDives: 2,
    searchesPerScout: 7,
    effort: "high",
    budgetUsd: 5,
  },
  deep: {
    scoutMaxTurns: 48,
    synthMaxTurns: 24,
    deepDives: 4,
    searchesPerScout: 12,
    effort: "high",
    budgetUsd: 12,
  },
  exhaustive: {
    scoutMaxTurns: 75,
    synthMaxTurns: 32,
    deepDives: 6,
    searchesPerScout: 18,
    effort: "xhigh",
    budgetUsd: 25,
  },
};

export const DEFAULT_CONFIG: ScoutConfig = {
  topic: "",
  existingProject: "",
  lenses: ["prior-art", "gaps", "ideation", "critique"],
  depth: "standard",
  angle: "product",
  timeBudget: "two-weeks",
  teamSize: "solo",
  novelty: 55,
  ideaCount: 6,
  sources: ["academic", "oss", "industry", "community"],
  recencyMonths: "24",
  constraints: "",
  avoid: "",
  model: "opus",
};

export interface Preset {
  id: string;
  label: string;
  blurb: string;
  patch: Partial<ScoutConfig>;
}

export const PRESETS: Preset[] = [
  {
    id: "paper",
    label: "Paper hunt",
    blurb: "Find a publishable gap in the literature.",
    patch: {
      angle: "research-paper",
      depth: "deep",
      novelty: 85,
      sources: ["academic", "oss"],
      recencyMonths: "24",
      timeBudget: "semester",
      ideaCount: 5,
    },
  },
  {
    id: "weekend",
    label: "Weekend hack",
    blurb: "Something sharp you can finish in two days.",
    patch: {
      angle: "product",
      depth: "quick",
      novelty: 35,
      timeBudget: "weekend",
      teamSize: "solo",
      sources: ["oss", "community"],
      ideaCount: 8,
      model: "sonnet",
    },
  },
  {
    id: "wedge",
    label: "Startup wedge",
    blurb: "Where a small team could actually get paid.",
    patch: {
      angle: "startup",
      depth: "deep",
      novelty: 60,
      sources: ["market", "industry", "community"],
      timeBudget: "open-ended",
      teamSize: "pair",
      ideaCount: 6,
    },
  },
  {
    id: "improve",
    label: "Improve what I have",
    blurb: "Audit an existing project and find its next move.",
    patch: {
      angle: "product",
      depth: "standard",
      novelty: 30,
      lenses: ["prior-art", "gaps", "ideation", "critique"],
      sources: ["oss", "industry", "community"],
      ideaCount: 7,
    },
  },
  {
    id: "oss",
    label: "OSS tool",
    blurb: "A developer tool people would actually star.",
    patch: {
      angle: "open-source",
      depth: "standard",
      novelty: 50,
      sources: ["oss", "community", "industry"],
      timeBudget: "two-weeks",
      ideaCount: 7,
    },
  },
];

export function modelId(choice: ModelChoice): string {
  return choice === "opus" ? "claude-opus-5" : "claude-sonnet-5";
}

/** The cheap model used for the fan-out deep-dive subagents. */
export const WORKER_MODEL = "claude-sonnet-5";
