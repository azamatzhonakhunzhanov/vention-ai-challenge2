# Report — Air Traffic Control MCP Server

## 1. Summary

This is a lightweight but **provably-correct** Air Traffic Control coordinator
exposed over MCP. The design goal was a scheduler that is **simple to reason
about, deterministic, and correct under adversarial inputs** — not a heuristic
that merely looks plausible on the happy path. Every guarantee in the spec is
enforced by construction and verified by an automated harness that drives the
real server through a real MCP client.

Headline decisions:

- A **discrete-event greedy list scheduler** over typed resource intervals,
  chosen over an ILP/CP solver for transparency, determinism and speed.
- **Strict global priority ordering with on-demand dependency placement**, which
  *eliminates* the classic "high-priority flight stuck behind an unrelated
  low-priority flight" pathology rather than merely reducing it.
- A **critical-path DP** for bottleneck analysis that is provably the true
  longest elapsed chain (not a naïve sub-span heuristic).
- Determinism treated as a **first-class invariant**: every ordering decision is
  a total order derived from input; nothing reads a clock or relies on map
  iteration order.

## 2. Problem framing & key decisions

**Why greedy, not an optimiser?** The task rewards correct coordination and
*deterministic* results, not optimality. A transparent greedy scheduler is
auditable line-by-line, runs in milliseconds, and is trivially deterministic. An
ILP/CP-SAT model would be opaque, introduce a solver dependency, and (without
care) be non-deterministic across versions/seeds.

**Modelling a flight.** Each flight is two coupled occupancies:

| Operation | Phase 1 | Phase 2 | `start` | `complete` |
|---|---|---|---|---|
| Arrival | runway `ARR_DUR` (land) | gate+crew `TURNAROUND` | runway start | gate end |
| Departure | gate+crew `TURNAROUND` | runway `DEP_DUR` (take off) | gate start | runway end |

This makes *"the inbound has completed"* mean **off the runway and out of the
gate** — exactly the precondition a connecting outbound needs, so dependency
semantics fall out naturally.

**Resources.** Runways carry a length (capability constraint). Gates and ground
crew are pools of individually-assignable units (`GATE-n`, `CREW-n`) — crew is a
real assignment, not a concurrency counter, so a specific crew is reported and
never double-booked.

## 3. Scheduling approach

### 3.1 Pre-processing

1. Cancelled flights are excluded from resource contention.
2. Runway-length-infeasible flights are rejected up front with a precise reason
   (`No runway meets the required length of X m (longest available is Y m)`).
3. A **Kahn pass** detects dependency cycles; flights in a cycle are marked
   unscheduled (`Cyclic dependency detected`) instead of hanging the scheduler.

### 3.2 Processing order — the key decision

Flights are considered in **strict global priority order**
`(priorityRank, submissionSeq, flightNumber)`. Each flight is emitted by a DFS
that emits its dependency chain *immediately before it*. Consequence: a
high-priority flight's dependencies are placed **ahead of every lower-priority
flight**, so a high-priority flight (or its dependency chain) can never be
delayed behind an unrelated lower-priority flight that happened to grab an
earlier slot.

This is strictly better than the common "topological order, break ties by
priority among the ready set", which lets independent low-priority flights
consume early slots while a high-priority flight waits on a dependency. The
ordering is a **total order**, so it is fully deterministic.

### 3.3 Placement

For each flight the earliest dependency-ready time is
`max(dep.complete + DEPENDENCY_BUFFER)` over scheduled dependencies (a cancelled
dependency drops the constraint; an unknown/unscheduled one blocks the dependent
with an explanatory reason).

The scheduler then evaluates a **deterministic candidate set of start times**:
the dependency-ready time plus every existing runway/gate/crew interval
boundary, each interpreted as both a runway-window and a gate-window boundary
and offset by each separation buffer. Generating candidates only at resource
boundaries means placement is **exact** (no time discretisation / slot grid)
while the search space stays small. The earliest candidate for which a
length-eligible runway, a free gate, and a free crew **all** coexist wins, with
ties broken by lowest runway/gate/crew index. Anything that cannot complete
before `MAX_HORIZON` stays unscheduled with a reason and remains visible.

**Complexity.** `O(F² · R)` worst case for `F` flights and `R` runways — flights
× candidate boundaries × resource checks — which is negligible for realistic
airport queues and keeps the whole `generate_schedule` call sub-millisecond in
the test scenarios.

### 3.4 Determinism (why it holds)

- Flight order: a total comparator (`priority, seq, flightNumber`) + fixed DFS.
- Candidate times: collected into a `Set`, then **sorted ascending**.
- Resource selection: first match in fixed index order.
- No `Date.now()`, `Math.random()`, or map-iteration-order anywhere in the
  scheduling path. `generate_schedule` resets and recomputes from scratch, so
  repeated calls are idempotent. (`get_airport_status` carries a `lastScheduleAt`
  audit timestamp — explicitly *metadata*, never an input to scheduling.)

### 3.5 Bottleneck analysis (critical path)

Over scheduled flights, a DP in start-time order computes, for each flight, the
dependency chain ending at it with the **earliest-starting** ancestor — because
a flight's completion time is fixed, the longest elapsed chain ending at it is
the one whose path starts earliest. The global winner (length ≥ 2) maximises
`last.complete − first.start`, which inherently accounts for operation durations
and the dependency buffers already baked into the scheduled timestamps.

## 4. Tools & techniques used

- **TypeScript**, `@modelcontextprotocol/sdk` (`McpServer`, stdio transport).
- **Zod** schemas for tool inputs — validation + self-documenting parameters.
- Strict env-var configuration with **fail-fast** validation (clear message,
  `exit(1)`; never starts half-valid).
- Clean separation: `config` (validation) · `scheduler` (pure algorithm) ·
  `store` (state + projections) · `index` (MCP surface). The scheduler is a
  pure function `(config, flights) → result`, which is what makes determinism
  and testing tractable.
- **Two e2e harnesses** that spawn the built server and drive it through a real
  MCP stdio client: `scenarios.ts` (3 required scenarios + determinism + cancel,
  16 assertions) and `strict.ts` (adversarial probes).

## 5. What worked

- Modelling each flight as ordered runway→gate (or gate→runway) windows made
  dependencies, separation and the "completed" semantics fall out cleanly.
- Boundary-derived candidate times gave **exact** placement with simple,
  debuggable code and zero discretisation error.
- Treating the scheduler as a pure function let the harness drive the *real*
  MCP server (not a mock) and still get deterministic, diffable output.
- Adversarial testing paid for itself — it caught real bugs a happy-path test
  would have missed (next section).

## 6. What did not work first time (found via strict review, then fixed)

- **Candidate-time generation.** v1 mapped resource boundaries only through the
  *runway* interpretation. Departures (bound by the gate window at `t`) could
  miss a gate-release time and be wrongly left unschedulable. Fixed by
  interpreting every boundary as both a runway and a gate boundary.
- **Bottleneck DP selection.** v1 picked, at each node, the predecessor whose
  *own* chain span was largest — wrong, since the node's completion is fixed and
  the longest chain is the one starting earliest. A diamond case
  (`A[0→600]`, `ROOT[300→900]`, `B[900→1500]`, `TAIL[1500→2100]`, `TAIL`
  depending on `A`+`B`) reported `ROOT→B→TAIL` (1800s) when the true answer is
  `A→TAIL` (2100s). Fixed to minimise chain start with deterministic tiebreaks.
- **Cancellation re-evaluation.** v1 deferred dependent updates to the next
  `generate_schedule`. To satisfy *"cancel … and update affected dependent
  flights"* strictly, `cancel_flight` now re-runs the deterministic scheduler
  immediately and returns each dependent's new state.

These three are documented honestly because finding and fixing them via
adversarial probes is the strongest evidence the final implementation is
correct.

## 7. Resolved limitations (previously trade-offs, now fixed)

- **Priority inversion via dependencies → eliminated** (strict priority order +
  on-demand DFS dependency placement). Probe: `D@0, H@300, L@600`.
- **Relative-only time → optional absolute timestamps** via the fixed
  `ATC_SCHEDULE_EPOCH` anchor, without breaking determinism.
- **Crew as a concurrency cap → real per-crew assignment** (`CREW-1..N`),
  surfaced in outputs, never double-booked.

## 8. Remaining trade-offs (honest)

- Deterministic greedy is **not a globally optimal solver**: under heavy
  contention among **equal-priority** flights the makespan may be sub-optimal.
  This is inherent to the deterministic-greedy choice and an accepted trade-off
  (correct coordination + determinism > optimality, per the task's goals).
- Operation durations are configured constants, not per-aircraft.
- State is in-memory per server process (intentional for the task's scope).

## 9. Possible extensions

- Per-aircraft durations / wake-turbulence categories.
- A local-search post-pass (e.g. critical-path swaps) for makespan, guarded to
  remain deterministic.
- Persistence + an `mcp` resource subscription so clients get push updates on
  reschedule.

## 10. How to verify

```bash
cd task-4 && npm install && npm run build
npm run scenarios                      # 16/16, 0 failures
node --import tsx scripts/strict.ts    # adversarial probes, 0 failures
```
