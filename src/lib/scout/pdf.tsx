import React from "react";
import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import type { Idea, ScoutReport, Source } from "./types";
import type { SavedIdea } from "./saved";
import { ANGLES, DEPTHS } from "./config";

const INK = "#14181b";
const MUTED = "#5d666c";
const FAINT = "#98a1a7";
const LINE = "#d9dee1";
const ACCENT = "#1d5fa8";
const TRACK = "#e7ebee";

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 54, paddingHorizontal: 46, fontSize: 9.5, color: INK, lineHeight: 1.5 },
  kicker: { fontSize: 8, color: FAINT, letterSpacing: 1.1, marginBottom: 6 },
  title: { fontSize: 19, marginBottom: 6, color: INK },
  meta: { fontSize: 8.5, color: MUTED, marginBottom: 14 },
  summary: { fontSize: 10.5, color: INK, lineHeight: 1.6, marginBottom: 16 },
  rule: { borderBottomWidth: 1, borderBottomColor: LINE, marginBottom: 14 },
  sectionTitle: { fontSize: 12.5, marginTop: 6, marginBottom: 9, color: INK },
  card: { borderWidth: 1, borderColor: LINE, borderRadius: 5, padding: 11, marginBottom: 10 },
  ideaHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  ideaTitle: { fontSize: 11.5, color: INK, maxWidth: "76%" },
  verdict: { fontSize: 7.5, color: MUTED, borderWidth: 1, borderColor: LINE, borderRadius: 3, paddingVertical: 2, paddingHorizontal: 5 },
  oneLiner: { fontSize: 9.5, color: MUTED, marginBottom: 8 },
  meters: { flexDirection: "row", gap: 14, marginBottom: 9 },
  meterBox: { width: 108 },
  meterRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  meterLabel: { fontSize: 7, color: FAINT, letterSpacing: 0.7 },
  meterValue: { fontSize: 8.5, color: INK },
  track: { height: 2.5, backgroundColor: TRACK, borderRadius: 2 },
  fill: { height: 2.5, backgroundColor: ACCENT, borderRadius: 2 },
  fieldLabel: { fontSize: 7, color: FAINT, letterSpacing: 0.7, marginTop: 7, marginBottom: 2 },
  fieldBody: { fontSize: 9, color: INK, lineHeight: 1.5 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { width: 9, fontSize: 9, color: FAINT },
  bulletText: { flex: 1, fontSize: 9, color: INK, lineHeight: 1.45 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3 },
  chip: { fontSize: 7.5, color: MUTED, borderWidth: 1, borderColor: LINE, borderRadius: 3, paddingVertical: 1.5, paddingHorizontal: 4 },
  link: { fontSize: 8.5, color: ACCENT, textDecoration: "none" },
  twoCol: { flexDirection: "row", gap: 14 },
  col: { flex: 1 },
  para: { fontSize: 9.5, marginBottom: 6, lineHeight: 1.55 },
  mdH: { fontSize: 11, marginTop: 9, marginBottom: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 3 },
  cell: { flex: 1, fontSize: 8, paddingRight: 6, color: INK },
  cellHead: { flex: 1, fontSize: 8, paddingRight: 6, color: MUTED },
  footer: { position: "absolute", bottom: 26, left: 46, right: 46, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7.5, color: FAINT },
});

function Meter({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View style={s.meterBox}>
      <View style={s.meterRow}>
        <Text style={s.meterLabel}>{label}</Text>
        <Text style={s.meterValue}>{pct}</Text>
      </View>
      <View style={s.track}>
        <View style={[s.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function Field({ label, children }: { label: string; children?: string }) {
  if (!children || !children.trim()) return null;
  return (
    <View>
      <Text style={s.fieldLabel}>{label.toUpperCase()}</Text>
      <Text style={s.fieldBody}>{children}</Text>
    </View>
  );
}

function Bullets({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <View>
      <Text style={s.fieldLabel}>{label.toUpperCase()}</Text>
      {items.map((item, i) => (
        <View key={i} style={s.bullet}>
          <Text style={s.bulletDot}>-</Text>
          <Text style={s.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function Sources({ items }: { items: Source[] }) {
  if (!items.length) return null;
  return (
    <View>
      <Text style={s.fieldLabel}>SOURCES</Text>
      {items.map((source, i) => (
        <Link key={i} src={source.url} style={s.link}>
          {source.title || source.url}
        </Link>
      ))}
    </View>
  );
}

function IdeaBlock({ idea, rank, note }: { idea: Idea; rank?: number; note?: string }) {
  return (
    <View style={s.card} wrap={false}>
      <View style={s.ideaHead}>
        <Text style={s.ideaTitle}>
          {rank ? `${rank}. ` : ""}
          {idea.title}
        </Text>
        <Text style={s.verdict}>{(idea.verdict || "UNRATED").toUpperCase()}</Text>
      </View>
      {idea.oneLiner ? <Text style={s.oneLiner}>{idea.oneLiner}</Text> : null}

      <View style={s.meters}>
        <Meter label="NOVELTY" value={idea.novelty} />
        <Meter label="FEASIBILITY" value={idea.feasibility} />
        <Meter label="IMPACT" value={idea.impact} />
      </View>

      {note ? <Field label="Your note">{note}</Field> : null}
      <Field label="Why now">{idea.whyNow}</Field>
      <Field label="Closest prior art">{idea.closestPriorArt}</Field>
      <Field label="What makes it different">{idea.differentiator}</Field>
      <Field label="Why the scores">{idea.noveltyRationale}</Field>
      <Field label="First milestone">{idea.firstMilestone}</Field>
      <Field label="Effort">{idea.effort}</Field>

      {idea.stack.length ? (
        <View>
          <Text style={s.fieldLabel}>STACK</Text>
          <View style={s.chipRow}>
            {idea.stack.map((item, i) => (
              <Text key={i} style={s.chip}>
                {item}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      <View style={s.twoCol}>
        <View style={s.col}>
          <Bullets label="Risks" items={idea.risks} />
        </View>
        <View style={s.col}>
          <Bullets label="Kill criteria" items={idea.killCriteria} />
        </View>
      </View>

      <Sources items={idea.sources} />
    </View>
  );
}

type Block =
  | { kind: "h"; text: string }
  | { kind: "p"; text: string }
  | { kind: "li"; text: string }
  | { kind: "table"; rows: string[][] };

/** Enough markdown for what the landscape section actually contains. */
export function toBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.split("\n");
  let paragraph: string[] = [];
  let table: string[][] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: "p", text: inline(paragraph.join(" ")) });
      paragraph = [];
    }
  };
  const flushTable = () => {
    if (table.length) {
      blocks.push({ kind: "table", rows: table });
      table = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const isTableRow = /^\s*\|.*\|\s*$/.test(line);

    if (isTableRow) {
      flushParagraph();
      const cells = line.trim().slice(1, -1).split("|").map((c) => inline(c.trim()));
      if (cells.every((c) => /^:?-{2,}:?$/.test(c.replace(/\s/g, "")))) continue;
      table.push(cells);
      continue;
    }
    flushTable();

    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: "h", text: inline(heading[2]) });
      continue;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      blocks.push({ kind: "li", text: inline(bullet[1]) });
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushTable();
  return blocks;
}

function inline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\*\*|\*\*$/g, "");
}

function MarkdownBlocks({ markdown }: { markdown: string }) {
  return (
    <View>
      {toBlocks(markdown).map((block, i) => {
        if (block.kind === "h") return <Text key={i} style={s.mdH}>{block.text}</Text>;
        if (block.kind === "li")
          return (
            <View key={i} style={s.bullet}>
              <Text style={s.bulletDot}>-</Text>
              <Text style={s.bulletText}>{block.text}</Text>
            </View>
          );
        if (block.kind === "table")
          return (
            <View key={i} style={{ marginVertical: 6 }}>
              {block.rows.map((row, r) => (
                <View key={r} style={s.tableRow}>
                  {row.map((cell, c) => (
                    <Text key={c} style={r === 0 ? s.cellHead : s.cell}>
                      {cell}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          );
        return <Text key={i} style={s.para}>{block.text}</Text>;
      })}
    </View>
  );
}

/**
 * No page numbers: @react-pdf's `render` callback triggers a second layout pass
 * that overflows Yoga on documents this long ("unsupported number: -1.9e+21").
 * A static fixed footer is safe.
 */
function Footer({ label }: { label: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{label}</Text>
      <Text style={s.footerText}>scout</Text>
    </View>
  );
}


function configLine(report: ScoutReport): string {
  const angle = ANGLES.find((a) => a.value === report.config.angle)?.label ?? report.config.angle;
  const depth = DEPTHS.find((d) => d.value === report.config.depth)?.label ?? report.config.depth;
  const when = new Date(report.createdAt).toLocaleString();
  const mins = Math.round(report.durationMs / 60000);
  return `${when}  ·  ${angle}  ·  ${depth} depth  ·  ${report.config.model}  ·  novelty ${report.config.novelty}/100  ·  ${mins} min  ·  $${report.costUsd.toFixed(2)} of model usage`;
}

export function ReportDocument({ report }: { report: ScoutReport }) {
  return (
    <Document title={`Scout — ${report.topic}`} author="Scout">
      <Page size="A4" style={s.page}>
        <Text style={s.kicker}>SCOUT RESEARCH REPORT</Text>
        <Text style={s.title}>{report.topic}</Text>
        <Text style={s.meta}>{configLine(report)}</Text>
        <View style={s.rule} />
        {report.summary ? <Text style={s.summary}>{report.summary}</Text> : null}

        {report.ideas.length ? (
          <View>
            <Text style={s.sectionTitle}>Ideas, ranked</Text>
            {report.ideas.map((idea, i) => (
              <IdeaBlock key={idea.id || i} idea={idea} rank={i + 1} />
            ))}
          </View>
        ) : null}

        {report.gaps.length ? (
          <View>
            <Text style={s.sectionTitle} break>
              Confirmed gaps
            </Text>
            {report.gaps.map((gap, i) => (
              <View key={i} style={s.card} wrap={false}>
                <Text style={s.ideaTitle}>{gap.title}</Text>
                <Field label="What breaks">{gap.detail}</Field>
                <Field label="Evidence">{gap.evidence}</Field>
                <Sources items={gap.sources} />
              </View>
            ))}
          </View>
        ) : null}

        {report.landscape.trim() ? (
          <View>
            <Text style={s.sectionTitle} break>
              The landscape
            </Text>
            <MarkdownBlocks markdown={report.landscape} />
          </View>
        ) : null}

        {report.openQuestions.length ? (
          <View>
            <Text style={s.sectionTitle}>Open questions</Text>
            <Bullets label="" items={report.openQuestions} />
          </View>
        ) : null}

        {report.readingList.length ? (
          <View>
            <Text style={s.sectionTitle}>Reading list</Text>
            {report.readingList.map((source, i) => (
              <View key={i} style={{ marginBottom: 5 }}>
                <Link src={source.url} style={s.link}>
                  {source.title || source.url}
                </Link>
                {source.why ? <Text style={s.fieldBody}>{source.why}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        <Footer label={`Scout · ${report.topic}`} />
      </Page>
    </Document>
  );
}

export function ShortlistDocument({ items }: { items: SavedIdea[] }) {
  const byRun = new Map<string, SavedIdea[]>();
  for (const item of items) {
    byRun.set(item.runId, [...(byRun.get(item.runId) ?? []), item]);
  }

  return (
    <Document title="Scout — shortlist" author="Scout">
      <Page size="A4" style={s.page}>
        <Text style={s.kicker}>SCOUT SHORTLIST</Text>
        <Text style={s.title}>Saved ideas</Text>
        <Text style={s.meta}>
          {items.length} idea{items.length === 1 ? "" : "s"} across {byRun.size} run
          {byRun.size === 1 ? "" : "s"} · exported {new Date().toLocaleString()}
        </Text>
        <View style={s.rule} />

        {[...byRun.entries()].map(([runId, group]) => (
          <View key={runId}>
            <Text style={s.sectionTitle}>{group[0].topic || "Untitled run"}</Text>
            {group.map((entry) => (
              <IdeaBlock key={entry.savedId} idea={entry.idea} note={entry.note} />
            ))}
          </View>
        ))}

        <Footer label="Scout · shortlist" />
      </Page>
    </Document>
  );
}

/**
 * `renderToBuffer` is typed to take an element whose props are `DocumentProps`,
 * but a wrapper component that renders a `<Document>` never satisfies that.
 * The cast is confined to these two helpers.
 */
type DocElement = React.ReactElement<DocumentProps>;

export function renderReportPdf(report: ScoutReport): Promise<Buffer> {
  return renderToBuffer((<ReportDocument report={report} />) as unknown as DocElement);
}

export function renderShortlistPdf(items: SavedIdea[]): Promise<Buffer> {
  return renderToBuffer((<ShortlistDocument items={items} />) as unknown as DocElement);
}
