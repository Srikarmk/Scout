import { DEFAULT_CONFIG, LENSES, SOURCES } from "./config";
import type { LensId, ScoutConfig, SourceMix } from "./types";

const LENS_IDS = new Set(LENSES.map((l) => l.value));
const SOURCE_IDS = new Set(SOURCES.map((s) => s.value));

export function coerceConfig(body: unknown): ScoutConfig | { error: string } {
  if (!body || typeof body !== "object") return { error: "expected a JSON object" };
  const raw = body as Record<string, unknown>;
  const topic = typeof raw.topic === "string" ? raw.topic.trim() : "";
  if (topic.length < 3) return { error: "give me a topic with at least a few words in it" };

  const lenses = Array.isArray(raw.lenses)
    ? (raw.lenses.filter(
        (l): l is LensId => typeof l === "string" && LENS_IDS.has(l as LensId),
      ) as LensId[])
    : DEFAULT_CONFIG.lenses;
  if (lenses.length === 0) return { error: "enable at least one research lens" };

  const sources = Array.isArray(raw.sources)
    ? (raw.sources.filter(
        (s): s is SourceMix => typeof s === "string" && SOURCE_IDS.has(s as SourceMix),
      ) as SourceMix[])
    : DEFAULT_CONFIG.sources;

  const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    typeof value === "string" && (allowed as readonly string[]).includes(value)
      ? (value as T)
      : fallback;

  const ideaCount = Number(raw.ideaCount);
  const novelty = Number(raw.novelty);

  return {
    topic,
    existingProject:
      typeof raw.existingProject === "string" ? raw.existingProject.slice(0, 8000) : "",
    lenses,
    sources,
    depth: pick(raw.depth, ["quick", "standard", "deep", "exhaustive"] as const, DEFAULT_CONFIG.depth),
    angle: pick(
      raw.angle,
      ["research-paper", "product", "startup", "open-source", "learning"] as const,
      DEFAULT_CONFIG.angle,
    ),
    timeBudget: pick(
      raw.timeBudget,
      ["weekend", "two-weeks", "semester", "open-ended"] as const,
      DEFAULT_CONFIG.timeBudget,
    ),
    teamSize: pick(raw.teamSize, ["solo", "pair", "team"] as const, DEFAULT_CONFIG.teamSize),
    recencyMonths: pick(
      raw.recencyMonths,
      ["any", "36", "24", "12", "6"] as const,
      DEFAULT_CONFIG.recencyMonths,
    ),
    model: pick(raw.model, ["opus", "sonnet"] as const, DEFAULT_CONFIG.model),
    novelty: Number.isFinite(novelty)
      ? Math.max(0, Math.min(100, Math.round(novelty)))
      : DEFAULT_CONFIG.novelty,
    ideaCount: Number.isFinite(ideaCount)
      ? Math.max(1, Math.min(12, Math.round(ideaCount)))
      : DEFAULT_CONFIG.ideaCount,
    constraints: typeof raw.constraints === "string" ? raw.constraints.slice(0, 4000) : "",
    avoid: typeof raw.avoid === "string" ? raw.avoid.slice(0, 4000) : "",
  };
}
