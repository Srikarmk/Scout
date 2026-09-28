import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Idea } from "./types";

const ROOT = path.join(process.cwd(), ".scout");
const FILE = path.join(ROOT, "saved.json");

export interface SavedIdea {
  savedId: string;
  runId: string;
  topic: string;
  savedAt: string;
  note: string;
  idea: Idea;
}

/** Read-modify-write on one file: serialise so two quick saves cannot clobber each other. */
let queue: Promise<unknown> = Promise.resolve();

function exclusive<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => {});
  return next;
}

async function readAll(): Promise<SavedIdea[]> {
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8"));
    return Array.isArray(parsed) ? (parsed as SavedIdea[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: SavedIdea[]): Promise<void> {
  await mkdir(ROOT, { recursive: true });
  await writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

export function listSaved(): Promise<SavedIdea[]> {
  return exclusive(async () => {
    const items = await readAll();
    return items.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  });
}

export function saveIdea(input: {
  runId: string;
  topic: string;
  idea: Idea;
  note?: string;
}): Promise<SavedIdea> {
  return exclusive(async () => {
    const items = await readAll();
    const existing = items.find((s) => s.runId === input.runId && s.idea.id === input.idea.id);
    if (existing) return existing;

    const entry: SavedIdea = {
      savedId: randomUUID(),
      runId: input.runId,
      topic: input.topic,
      savedAt: new Date().toISOString(),
      note: input.note ?? "",
      idea: input.idea,
    };
    await writeAll([entry, ...items]);
    return entry;
  });
}

export function updateNote(savedId: string, note: string): Promise<SavedIdea | null> {
  return exclusive(async () => {
    const items = await readAll();
    const entry = items.find((s) => s.savedId === savedId);
    if (!entry) return null;
    entry.note = note.slice(0, 8000);
    await writeAll(items);
    return entry;
  });
}

export function removeSaved(savedId: string): Promise<boolean> {
  return exclusive(async () => {
    const items = await readAll();
    const next = items.filter((s) => s.savedId !== savedId);
    if (next.length === items.length) return false;
    await writeAll(next);
    return true;
  });
}
