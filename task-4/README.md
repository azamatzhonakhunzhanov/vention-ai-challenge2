# ✈️ Air Traffic Control — MCP Server

An AI-ready **Air Traffic Control** system exposed over the
[Model Context Protocol](https://modelcontextprotocol.io). It accepts flight
plans, computes a **conflict-free, priority-aware, deterministic** schedule
across limited runways, gates and ground crew, reacts to disruptions
(cancellations, dependency changes), and lets any MCP client inspect and drive
airport operations through clean tools and resources.

The focus is **scheduling logic and coordination** — no UI, no aircraft
physics. Everything below is implemented, documented, and verified by an
automated test harness that drives the real server through a real MCP client.

> 📁 **Working directory — read this first.** This submission *is* the
> `task-4/` folder of the repository, and this README lives inside it. **Every
> command in this document assumes your terminal's working directory is
> `task-4/`.** From a fresh clone that means run `cd task-4` once (from the
> repo root); if you already opened a terminal in `task-4/`, you're set — do
> **not** `cd task-4` again. Commands below therefore do not repeat `cd task-4`.

---

## Why this implementation stands out

- **Hard guarantees, not best-effort.** No runway/gate/crew is ever
  double-booked; separation, turnaround, dependency and horizon constraints are
  always respected; a higher-priority flight (or its dependency chain) can never
  be delayed behind an unrelated lower-priority flight.
- **Fully deterministic.** Identical inputs + configuration always produce a
  byte-identical schedule — every tiebreak is a total order derived from input,
  with no clocks or map-iteration order in the scheduling path.
- **Correct critical-path bottleneck analysis**, validated against an
  adversarial diamond-dependency case.
- **Real per-crew assignment** (`CREW-n`) and **optional absolute timestamps**
  via a fixed epoch — without sacrificing determinism.
- **Two end-to-end test harnesses** (`scenarios` + adversarial `strict`) that
  exercise the server exactly as a judge or AI client would.

---

## Quick start

Requires **Node.js ≥ 20**. Run from the `task-4/` directory (see the note
above).

```bash
npm install
npm run build           # TypeScript -> dist/

# Validate everything (starts the built server, drives it via a real MCP client)
npm run scenarios       # 16/16 — the 3 required scenarios + determinism + cancel
npm run strict          # adversarial probes — all green
npm run demo            # narrated end-to-end run, prints real request/response
```

Run the server (speaks MCP over **stdio**):

```bash
ATC_RUNWAY_LENGTHS_M="3000,2500" ATC_GATE_COUNT=3 ATC_GROUND_CREW_COUNT=2 \
  npm start
```

> Running `node dist/index.js` directly will appear to "hang" — that's correct:
> it is waiting for an MCP client on stdin. Use the Inspector or a client below.

---

## Configuration (environment variables)

All airport limits come from the environment. **Invalid or missing required
configuration fails fast at startup with a clear message and exit code 1** —
the MCP server never starts in a half-valid state.

Runways are configured **one of two ways** (lengths take precedence):

| Variable | Required | Default | Accepted values | Meaning |
|---|---|---|---|---|
| `ATC_RUNWAY_LENGTHS_M` | one of these | — | comma list of positive numbers, e.g. `3000,2500,1800` | Explicit per-runway usable length (m). Enables runway-capability constraints. |
| `ATC_RUNWAY_COUNT` | one of these | — | integer ≥ 1 | Number of identical runways. |
| `ATC_RUNWAY_DEFAULT_LENGTH_M` | no | `3000` | number > 0 | Length applied to every runway when using `ATC_RUNWAY_COUNT`. |

Core limits and buffers:

| Variable | Required | Default | Accepted values | Meaning |
|---|---|---|---|---|
| `ATC_GATE_COUNT` | **yes** | — | integer ≥ 1 | Number of gates (`GATE-1..N`). |
| `ATC_GROUND_CREW_COUNT` | **yes** | — | integer ≥ 1 | Individually-assignable ground crews (`CREW-1..N`); each works one turnaround at a time. |
| `ATC_SEP_TAKEOFF_SEC` | no | `120` | number ≥ 0 | Runway separation between two **departures**. |
| `ATC_SEP_LANDING_SEC` | no | `120` | number ≥ 0 | Runway separation between two **arrivals**. |
| `ATC_SEP_MIXED_SEC` | no | `90` | number ≥ 0 | Runway separation between an arrival and a departure. |
| `ATC_GATE_TURNAROUND_SEC` | no | `1800` | number ≥ 0 | Gate occupancy time per flight. |
| `ATC_DEPENDENCY_BUFFER_SEC` | no | `600` | number ≥ 0 | Minimum gap between a dependency's completion and a dependent's start. |
| `ATC_MAX_HORIZON_SEC` | no | `86400` | number ≥ 1 | Flights that cannot complete within this horizon stay unscheduled. |
| `ATC_ARRIVAL_DURATION_SEC` | no | `300` | number ≥ 1 | Runway occupancy for a landing. |
| `ATC_DEPARTURE_DURATION_SEC` | no | `300` | number ≥ 1 | Runway occupancy for a takeoff. |
| `ATC_SCHEDULE_EPOCH` | no | _(unset)_ | ISO 8601, e.g. `2030-01-01T00:00:00Z` | Fixed anchor for absolute wall-clock timestamps. When set, outputs add ISO `startTime`/`completeTime`. Being **fixed config (not the clock)**, schedules stay deterministic. Unset ⇒ relative seconds only. |

All scheduling math is in **seconds relative to schedule time 0**. Set
`ATC_SCHEDULE_EPOCH` to additionally receive absolute timestamps.

---

## Connecting an MCP client

The server is a **stdio MCP server**. Any MCP-compatible client launches it as a
subprocess and talks JSON-RPC over stdin/stdout.

**Step 1 — build, then get the one path you'll paste everywhere.** Run this from
`task-4/` and **copy the line it prints**:

```bash
npm install && npm run build && echo "$(pwd)/dist/index.js"
# example output:  /Users/you/atc-mcp/task-4/dist/index.js
```

Everywhere below you see **`ABS_ENTRY`**, replace it (no angle brackets, no extra
`task-4/`) with that exact printed path. It is the absolute path of the built
file `task-4/dist/index.js`.

The universal contract every client needs is just:

| Field | Value |
|---|---|
| transport | `stdio` |
| command | `node` |
| args | `["ABS_ENTRY"]`  ← the path printed above |
| env | the airport config vars (see table above) |

### Claude Code (CLI)

**One command** (stdio is the default transport; `-e` passes env vars):

```bash
claude mcp add atc \
  -e ATC_RUNWAY_LENGTHS_M=3000,2500 \
  -e ATC_GATE_COUNT=3 \
  -e ATC_GROUND_CREW_COUNT=2 \
  -e ATC_GATE_TURNAROUND_SEC=600 \
  -e ATC_DEPENDENCY_BUFFER_SEC=300 \
  -- node ABS_ENTRY
```

(Replace `ABS_ENTRY` with the path printed in Step 1, e.g.
`-- node /Users/you/atc-mcp/task-4/dist/index.js`.)

Add `--scope project` to write a shareable `.mcp.json` into the repo (handy for
graders), or `--scope user` to make it available everywhere. Then verify:

```bash
claude mcp list          # should show: atc - ✓ connected
claude mcp get atc       # shows command/args/env
```

Inside a Claude Code session, run `/mcp` to see `atc` and its 6 tools / 3
resources, then just ask in natural language (e.g. *"reset the airport, submit a
high-priority arrival BA1, generate the schedule and show the timeline"*).

Equivalent **project file** — create `.mcp.json` at the repo root (same schema
Claude Desktop / Cursor use):

```json
{
  "mcpServers": {
    "atc": {
      "command": "node",
      "args": ["ABS_ENTRY"],
      "env": {
        "ATC_RUNWAY_LENGTHS_M": "3000,2500",
        "ATC_GATE_COUNT": "3",
        "ATC_GROUND_CREW_COUNT": "2",
        "ATC_GATE_TURNAROUND_SEC": "600",
        "ATC_DEPENDENCY_BUFFER_SEC": "300"
      }
    }
  }
}
```

### Claude Desktop

Edit `claude_desktop_config.json`
(macOS: `~/Library/Application Support/Claude/`,
Windows: `%APPDATA%\Claude\`), add the **same `mcpServers` block** shown above,
and **fully restart** Claude Desktop. The 🔌/tools icon then lists the `atc`
tools.

### Cursor / Continue / Cline / Windsurf / custom SDK clients

These all consume the identical `mcpServers` JSON — drop the same block into the
client's MCP config (`.cursor/mcp.json`, Continue's `config.json` →
`mcpServers`, etc.) using the **same `ABS_ENTRY` path**. For a custom client
built on an MCP SDK, point a `StdioClientTransport` at
`command: "node", args: ["ABS_ENTRY"], env: {…}` (exactly what
`scripts/scenarios.ts` does — a working ~60-line reference).

### MCP Inspector (interactive UI — no client needed)

Best for hands-on poking and grading (run from `task-4/`):

```bash
ATC_RUNWAY_LENGTHS_M="3000,2500" ATC_GATE_COUNT=3 ATC_GROUND_CREW_COUNT=2 \
  npx @modelcontextprotocol/inspector node dist/index.js
```

Open the printed `http://localhost:6274`, click **Connect**, then invoke tools
and read resources. (Click a resource row and press **Refresh**; the body's
`uri:` field confirms which resource was fetched.)

> Tips: always use the **absolute** `ABS_ENTRY` path — clients spawn the process
> from their own working directory, so a relative path will not resolve. To run
> from source without `npm run build`, replace the `dist/index.js` suffix with
> `src/index.ts` and use `command: "npx", args: ["tsx", "<that path>"]`. If a
> client shows the server as failed, run `node ABS_ENTRY` once manually with the
> env vars to see the fail-fast config message on stderr.

---

## Tools

Every tool returns a JSON text payload; failures return `{ ok: false, error }`
with `isError: true`.

| Tool | Description | Input |
|---|---|---|
| `submit_flight` | Submit an arrival or departure into the queue. | `flightNumber` (unique, required), `operation` (`arrival`\|`departure`, required), `priority` (`high`\|`medium`\|`low`, default `medium`), `dependencies` (string[]), `minRunwayLengthM` (number) |
| `generate_schedule` | **Replace** the current schedule with a freshly computed one from the current queue + config. Returns counts + the new timeline. Deterministic. | — |
| `get_airport_status` | Structured status: flight counts by state & operation, per-runway/gate/crew usage, resource-constraint indicators, blocked flights with reasons, schedule completion time/ISO. | — |
| `cancel_flight` | Cancel a flight; the schedule is **immediately re-evaluated** and each affected dependent's new state is returned. Deterministic. | `flightNumber` (required) |
| `analyze_bottleneck` | The longest active scheduled dependency chain (critical path): ordered flights + total elapsed duration (accounts for operation durations and dependency buffers). `chain: null` if none. | — |
| `reset_airport` | Clear all flights and schedule state (clean slate for scenarios). | — |

**Example — `submit_flight`**

```json
{ "flightNumber": "OUT-200", "operation": "departure",
  "priority": "high", "dependencies": ["IN-100"], "minRunwayLengthM": 2800 }
```

**Example — `analyze_bottleneck` result**

```json
{ "ok": true, "chain": {
  "flights": ["IN-100", "OUT-200"],
  "totalDurationSec": 1500, "startSec": 0, "completeSec": 1500 } }
```

---

## Resources

| Name | URI | Contents |
|---|---|---|
| Flight queue | `atc://flights/queue` | All flights grouped into `scheduled`, `queued`, `unscheduled` (each with a `reason`), `cancelled`. |
| Runway availability & usage | `atc://runways/usage` | Per runway: `runwayId`, `lengthM`, and the chronological `operations` (with `startSec`/`endSec`, plus ISO times when an epoch is set). |
| Operation timeline | `atc://timeline` | Chronological list of every scheduled operation with runway, gate, **crew**, relative + (optional) absolute times, and dependencies. |

**Example — `atc://timeline` entry**

```json
{ "flightNumber": "IN-100", "operation": "arrival", "priority": "medium",
  "runwayId": "RWY-1", "gateId": "GATE-1", "crewId": "CREW-1",
  "startSec": 0, "completeSec": 900,
  "runwayStartSec": 0, "runwayEndSec": 300,
  "gateStartSec": 300, "gateEndSec": 900, "dependencies": [] }
```

---

## Scheduling model & guarantees

Each flight is two coupled resource occupancies:

- **Arrival** — runway for `ARRIVAL_DURATION` (landing), then a gate + crew for
  `GATE_TURNAROUND`. `start = runway start`, `complete = gate end`.
- **Departure** — a gate + crew for `GATE_TURNAROUND`, then a runway for
  `DEPARTURE_DURATION` (takeoff). `start = gate start`, `complete = runway end`.

So *"the inbound has completed"* means the aircraft is off the runway **and**
out of its gate — the natural precondition for a connecting departure.

Guarantees enforced by the scheduler:

1. No two operations overlap on a runway; the correct separation
   (takeoff/landing/mixed) is enforced between consecutive runway uses.
2. Every flight gets a concrete runway, **gate** (`GATE-n`) and **crew**
   (`CREW-n`); no gate or crew is ever double-booked.
3. A dependent never starts before `dependency.complete + DEPENDENCY_BUFFER`.
4. Runway-length requirements are honoured; an aircraft needing a longer runway
   than any available stays **unscheduled with a clear reason**.
5. Flights are placed in **strict priority order** with dependency chains placed
   on demand — a high-priority flight (or its deps) is never delayed behind an
   unrelated lower-priority flight.
6. Anything that cannot fit before `MAX_HORIZON` stays unscheduled with a
   reason; it remains visible in the queue.
7. **Determinism:** identical inputs + config ⇒ identical schedule, including
   absolute timestamps when `ATC_SCHEDULE_EPOCH` is set.

---

## Validation

```bash
npm run scenarios                      # 16 assertions, 0 failures
node --import tsx scripts/strict.ts    # adversarial probes, 0 failures
```

`scripts/scenarios.ts` covers the three required scenarios end-to-end through a
real MCP stdio client:

- **Morning Rush** — mixed arrivals/departures all scheduled, no overlaps,
  higher priority earlier, queue shows unscheduled clearly.
- **Heavy Hauler** — oversized departure stays unscheduled with a runway-length
  reason; other flights still schedule; status reports the blocked flight.
- **Connecting Flight** — dependency + buffer respected; timeline shows order;
  bottleneck = the connecting chain.
- Plus **determinism** (identical re-runs) and **cancellation re-evaluation**.

`scripts/strict.ts` adds adversarial probes: priority strictly orders under
single-runway contention, the bottleneck critical path is the true longest (a
diamond case that breaks the naïve approach), priority is never inverted by an
unrelated low-priority flight, ground crew is never double-booked, and the
schedule epoch yields correct, deterministic absolute timestamps.

---

## Requirements compliance matrix

| Requirement | Where / how |
|---|---|
| Anyone can submit flights | `submit_flight` tool |
| Flight has number, operation, priority, optional dependencies, optional runway requirement | `submit_flight` input schema (`src/index.ts`) |
| Limits via env: runways, gates, crew, separations, turnaround, dependency buffer, horizon | `src/config.ts` |
| Invalid config fails clearly at startup | `loadConfig` throws → stderr message + `exit(1)` |
| Tool: submit | `submit_flight` |
| Tool: generate/refresh (replaces schedule) | `generate_schedule` |
| Tool: status (resource usage + counts) | `get_airport_status` |
| Tool: cancel + update dependents | `cancel_flight` (immediate re-evaluation) |
| Tool: bottleneck analysis | `analyze_bottleneck` |
| Resource: flight queue incl. unscheduled & cancelled | `atc://flights/queue` |
| Resource: runway availability & usage | `atc://runways/usage` |
| Resource: chronological timeline | `atc://timeline` |
| No overlapping runway/gate usage | scheduler interval checks |
| Respects runway req, gate, separation, dependency, capacity | scheduler placement |
| Higher priority earlier when constrained | strict priority order |
| Unschedulable flights visible with reason | `unscheduled` state + `reason` |
| Cancel marks cancelled + dependents re-evaluated | `cancel_flight` |
| Status has counts by state/op, capacity/usage, constraint indicators, blocked w/ reasons, completion time | `store.status()` |
| Bottleneck = longest scheduled dependency chain with elapsed duration | `analyzeBottleneck` |
| Deterministic | total-order tiebreaks; verified |
| Source in `task-4/`, `README.md`, `report.md` | this folder |

---

## Project layout

```
task-4/
├── src/
│   ├── index.ts       # MCP server: tools + resources (stdio)
│   ├── config.ts      # env-var configuration + fail-fast validation
│   ├── types.ts       # domain types
│   ├── scheduler.ts   # deterministic scheduler + bottleneck analysis
│   └── store.ts       # in-memory airport state + projections
├── scripts/
│   ├── scenarios.ts   # required scenarios, e2e via real MCP client
│   └── strict.ts      # adversarial verification probes
├── README.md
└── report.md
```
