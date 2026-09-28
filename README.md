# Scout

Point it at a topic. It deploys a team of Claude research agents at the open web and comes back
with ranked, evidenced project ideas — plus the prior art that would have made you waste a month,
and the gaps nobody has claimed yet.

Built on the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk), so the agents get real
`WebSearch` / `WebFetch` tool use and can spawn their own subagents.

## Running it

```bash
npm run dev
```

Then open http://localhost:3030.

**Authentication.** Scout spawns the Claude Code CLI for every agent, so that CLI has to be signed
in. Run `claude` in a terminal and sign in with `/login`, or export `ANTHROPIC_API_KEY` before
starting the dev server. The app probes `/api/health` on load and shows a banner when it cannot
authenticate — a run started in that state stops at the first agent instead of burning through
every phase.

**What a run costs.** `/api/health` also reports how the work is billed and the header says which.
Signed in with a Claude subscription, runs draw on that plan's usage limits and nothing is charged
per token; the dollar figures in the UI are the SDK's equivalent-price estimate, useful as a fuel
gauge. With `ANTHROPIC_API_KEY` set, the same work is metered to Console credits for real. Either
way each agent carries a hard `maxBudgetUsd` from its depth profile.

## Runs survive a refresh

A run lives in a server-side registry, not in the browser tab. `POST /api/research` starts it and
returns a `runId` immediately; the page then tails `GET /api/research/<runId>/stream?cursor=N` over
SSE. Closing the tab or refreshing only drops the stream — the agents keep working. On load the page
reads the last run id from `localStorage`, asks the server whether it is still known, and reattaches
from cursor 0 so the whole transcript is rebuilt. A stream that dies mid-run reconnects on its own
with backoff, resuming from the last event index rather than replaying.

Runs stay reattachable for an hour after they finish. The one thing that does not survive is
restarting the dev server: the registry is in memory, so an in-flight run dies with the process.
Finished reports are already on disk and are unaffected.

## How a run works

Five phases. Each box is a separate `query()` against the Agent SDK, with its own system prompt,
tool allowlist, turn cap, and dollar ceiling.

```
framing ──┬──> prior-art scout ──> deep-dive x N ─┐
          │                                       ├──> ideation ──> critique ──> report (JSON)
          └──> gap analyst ─────> deep-dive x N ──┘
```

1. **Framing** sharpens the question, builds the search vocabulary the field actually uses, and
   names the adjacent fields worth raiding. Everything downstream reads it.
2. **Prior-art scout** and **gap analyst** run *in parallel*. Each one fans out to `deep-dive`
   subagents (Sonnet, cheap) that read a single source properly — the method section, the
   limitations section, the open issues — rather than trusting a search snippet.
3. **Ideation** crosses the confirmed gaps against the adjacent fields and produces N ideas, each
   sized to your actual time budget.
4. **Critique** tries to kill every idea: searches to check it does not already exist, checks it
   against your hard constraints, scores novelty / feasibility / impact, and writes kill criteria.
5. **Report** compiles everything into one strict JSON object, preferring the critic's scores over
   the idea generator's optimism.

Turning a lens off in the UI removes that phase. Turning off ideation also skips critique.

## What you can customise

| Control | What it changes |
| --- | --- |
| Lenses | Which agents get deployed at all |
| Depth | Turn caps, search counts, deep-dive fan-out, reasoning effort, cost ceiling |
| Goal type | Whether novelty, shippability, a market wedge, adoption, or learning is the scoring axis |
| Time budget / team size | Any idea that does not fit is rejected by the critic |
| Novelty appetite | Slides from "proven incremental improvement" to "should probably fail" |
| Sources to favour | Where the scouts look first: academic, OSS, industry, community, market |
| Recency | How old evidence is allowed to be |
| Idea count | 3 to 12 |
| Hard constraints | Violating ideas are thrown out, not softened |
| Already tried | Dead ends the agents must not re-suggest |
| Existing project | Paste a README and ideas build on it instead of starting blank |
| Model | Opus for judgment, Sonnet for speed |

Presets set several of these at once: paper hunt, weekend hack, startup wedge, improve what I have,
OSS tool.

## Deploying

Scout cannot run on serverless hosts. Every agent is a spawned Claude Code subprocess, a run takes
5-20 minutes holding an SSE stream open, and the run registry is in-process memory — none of which
survives a function timeout or an ephemeral instance. It needs a container with a long-lived
process. A `Dockerfile` and `fly.toml` are included.

Two things are deliberately not baked into the image:

```bash
fly secrets set ANTHROPIC_API_KEY=...        # a deployed Scout cannot use a subscription login
fly secrets set SCOUT_ACCESS_TOKEN=...       # openssl rand -hex 24
```

`ANTHROPIC_API_KEY` means the deployment bills per token to Console credits, not to a Claude
subscription — the interactive OAuth login only works on a machine with a browser.

`SCOUT_ACCESS_TOKEN` gates every route behind a shared secret (`src/middleware.ts`). It is not a
real auth system, but a public Scout with a live API key is an open wallet, so the gate is on
whenever the variable is set. Leave it unset locally and the app is ungated.

`auto_stop_machines` is off in `fly.toml` on purpose: suspending the machine mid-run would kill the
agents and drop the registry. The `scout_data` volume keeps `.scout/` across deploys.

## Exporting

Every finished report renders to a real PDF server-side (`@react-pdf/renderer`, no headless
browser): ranked idea cards with score meters, gaps with their evidence, the landscape table, and
the reading list. Every source URL is a live hyperlink in the document.

- `GET /api/reports/<id>/pdf` — download. Add `?inline=1` to preview in a tab.
- `GET /api/saved/pdf` — the shortlist as one PDF, grouped by the run each idea came from, with
  your notes included.

There are no page numbers in the footer, deliberately: @react-pdf's `render` callback forces a
second layout pass that overflows its layout engine on documents this long.

## Exploring and keeping ideas

The three views in the header are the whole app:

- **Run** — configure and watch a run, then read the report.
- **Library** — every finished report on disk. Open, export, or delete.
- **Shortlist** — ideas you saved, grouped by run, each with a free-text note.

Two things make this a loop rather than a one-shot:

- **Save** on any idea card adds it to the shortlist with its provenance, so you can compare ideas
  across several runs and export the survivors as one PDF.
- **Dig deeper on this** seeds a fresh run from an idea — the title and one-liner become the topic,
  and the idea's why-now, prior art, differentiator, milestone and sources are handed to the agents
  as context. It pre-fills the config rather than starting immediately, so you choose the depth.

## Evidence rules

Every research agent is held to the same standard, stated in its system prompt: cite URLs you
actually opened, prefer primary sources, date every recency claim, flag anything you could not
verify as `UNVERIFIED:`, and never invent a citation. A gap in the evidence is a finding; a
fabricated one is a failure.

## Layout

```
src/lib/scout/
  types.ts     shared types and the event union the SSE stream carries
  config.ts    lenses, depth profiles, presets, model ids
  prompts.ts   every system and user prompt, built from the run config
  engine.ts    the orchestrator: phases, parallelism, fatal-error handling, JSON extraction
  registry.ts  server-side live runs, kept on globalThis so HMR cannot drop them
  store.ts     reports on disk under .scout/reports/
  saved.ts     the shortlist, in .scout/saved.json
  validate.ts  request-body coercion for a run config
  pdf.tsx      the report and shortlist PDF documents
src/app/api/
  research/               POST a config -> { runId }; GET lists live runs
  research/[runId]/stream SSE tail with cursor replay
  research/[runId]/stop   abort a live run
  reports/                list, fetch, delete finished reports
  reports/[id]/pdf        render a report to PDF
  saved/                  the shortlist: list, add, note, remove, export
  health/                 one cheap round trip: can the agents authenticate, and how is it billed
src/hooks/
  useRun.ts        start, attach, reattach, reconnect, stop
src/components/
  Scout.tsx        app shell and the three views
  ConfigPanel.tsx  every customisable control
  RunStream.tsx    live phase and agent activity
  ReportView.tsx   ideas, gaps, landscape, reading list, raw transcripts
  IdeaCard.tsx     one idea, with save / note / dig-deeper
  Library.tsx      finished reports
  Shortlist.tsx    saved ideas across runs
```

Reports are written to `.scout/reports/<runId>.json` and listed in the sidebar. Nothing leaves your
machine except the agents' own web searches.

## Tools the agents can touch

`WebSearch`, `WebFetch`, and `Task` (to spawn deep-dive subagents) — nothing else. No shell, no
filesystem writes, `permissionMode: "dontAsk"`, and `settingSources: []` so your local Claude Code
settings and hooks do not leak into a run.
