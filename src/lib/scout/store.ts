import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReportSummary, ScoutReport } from "./types";

const ROOT = path.join(process.cwd(), ".scout");
const REPORTS = path.join(ROOT, "reports");
export const WORK_DIR = path.join(ROOT, "work");

async function ensureDirs() {
  await mkdir(REPORTS, { recursive: true });
  await mkdir(WORK_DIR, { recursive: true });
}

export async function workDir(): Promise<string> {
  await ensureDirs();
  return WORK_DIR;
}

export async function saveReport(report: ScoutReport): Promise<void> {
  await ensureDirs();
  await writeFile(
    path.join(REPORTS, `${report.runId}.json`),
    JSON.stringify(report, null, 2),
    "utf8",
  );
}

export async function loadReport(runId: string): Promise<ScoutReport | null> {
  if (!/^[a-f0-9-]{36}$/i.test(runId)) return null;
  try {
    const raw = await readFile(path.join(REPORTS, `${runId}.json`), "utf8");
    return JSON.parse(raw) as ScoutReport;
  } catch {
    return null;
  }
}

export async function deleteReport(runId: string): Promise<boolean> {
  if (!/^[a-f0-9-]{36}$/i.test(runId)) return false;
  try {
    await unlink(path.join(REPORTS, `${runId}.json`));
    return true;
  } catch {
    return false;
  }
}

export async function listReports(): Promise<ReportSummary[]> {
  await ensureDirs();
  const files = await readdir(REPORTS).catch(() => [] as string[]);
  const summaries: ReportSummary[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const report = JSON.parse(await readFile(path.join(REPORTS, file), "utf8")) as ScoutReport;
      summaries.push({
        runId: report.runId,
        topic: report.topic,
        createdAt: report.createdAt,
        ideaCount: report.ideas?.length ?? 0,
        costUsd: report.costUsd ?? 0,
        angle: report.config?.angle ?? "product",
        depth: report.config?.depth ?? "standard",
      });
    } catch {
      // a half-written report is not worth failing the list over
    }
  }
  return summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
