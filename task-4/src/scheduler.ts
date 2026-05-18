import type { AirportConfig } from "./config.js";
import { type Assignment, type Flight, type OpType, PRIORITY_RANK } from "./types.js";

interface Interval {
  start: number;
  end: number;
  op: OpType;
}

interface RunwayState {
  id: string;
  lengthM: number;
  ops: Interval[];
}

interface PoolState {
  id: string;
  ops: Interval[];
}

export interface ScheduleResult {
  scheduled: Map<string, Assignment>;
  /** flightNumber -> reason it could not be scheduled. */
  unscheduled: Map<string, string>;
  /** Latest completeSec across all scheduled flights, or null if none. */
  completionSec: number | null;
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Required runway separation between two ops of the given types. */
function separation(cfg: AirportConfig, a: OpType, b: OpType): number {
  if (a === "departure" && b === "departure") return cfg.sepTakeoffSec;
  if (a === "arrival" && b === "arrival") return cfg.sepLandingSec;
  return cfg.sepMixedSec;
}

/**
 * Compute the runway + gate windows for an operation that starts at `s`.
 * - Arrival: land on runway, then occupy a gate for turnaround.
 * - Departure: occupy a gate for turnaround, then take off from the runway.
 */
function windowsFor(cfg: AirportConfig, op: OpType, s: number) {
  if (op === "arrival") {
    const runwayStart = s;
    const runwayEnd = s + cfg.arrivalDurationSec;
    const gateStart = runwayEnd;
    const gateEnd = gateStart + cfg.gateTurnaroundSec;
    return { runwayStart, runwayEnd, gateStart, gateEnd, completeSec: gateEnd };
  }
  const gateStart = s;
  const gateEnd = s + cfg.gateTurnaroundSec;
  const runwayStart = gateEnd;
  const runwayEnd = runwayStart + cfg.departureDurationSec;
  return { runwayStart, runwayEnd, gateStart, gateEnd, completeSec: runwayEnd };
}

function runwayFree(cfg: AirportConfig, rw: RunwayState, win: Interval): boolean {
  for (const o of rw.ops) {
    if (overlaps(o, win)) return false;
    const buf = separation(cfg, o.op, win.op);
    // Need at least `buf` of clear time between the two runway windows.
    const gap = o.start >= win.end ? o.start - win.end : win.start - o.end;
    if (gap < buf) return false;
  }
  return true;
}

/** A pooled resource (gate or ground crew) is free for `win` if nothing overlaps. */
function poolFree(pool: PoolState, win: Interval): boolean {
  return !pool.ops.some((o) => overlaps(o, win));
}

/**
 * Deterministic greedy scheduler.
 *
 * Flights are processed in dependency (topological) order; ties broken by
 * priority, then submission order, then flight number. Each flight is placed at
 * the earliest feasible start time that satisfies runway separation, gate and
 * ground-crew capacity, dependency completion + buffer, runway length, and the
 * scheduling horizon.
 */
export function schedule(cfg: AirportConfig, flights: Flight[]): ScheduleResult {
  const scheduled = new Map<string, Assignment>();
  const unscheduled = new Map<string, string>();

  const active = flights.filter((f) => f.state !== "cancelled");
  const byId = new Map(active.map((f) => [f.flightNumber, f]));
  const cancelled = new Set(flights.filter((f) => f.state === "cancelled").map((f) => f.flightNumber));

  const maxRunwayLen = Math.max(...cfg.runways.map((r) => r.lengthM));
  const runways: RunwayState[] = cfg.runways.map((r) => ({ id: r.id, lengthM: r.lengthM, ops: [] }));
  const gates: PoolState[] = Array.from({ length: cfg.gateCount }, (_, i) => ({ id: `GATE-${i + 1}`, ops: [] }));
  // Ground crew is modelled as N individually-assignable crews; each handles
  // one gate turnaround at a time (a real assignment, not just a cap).
  const crews: PoolState[] = Array.from({ length: cfg.groundCrewCount }, (_, i) => ({ id: `CREW-${i + 1}`, ops: [] }));

  // --- Cycle detection (Kahn) over active flights only ---
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const f of active) {
    indeg.set(f.flightNumber, 0);
    adj.set(f.flightNumber, []);
  }
  for (const f of active) {
    for (const dep of f.dependencies) {
      if (byId.has(dep)) {
        adj.get(dep)!.push(f.flightNumber);
        indeg.set(f.flightNumber, (indeg.get(f.flightNumber) ?? 0) + 1);
      }
    }
  }
  const queue = active.filter((f) => (indeg.get(f.flightNumber) ?? 0) === 0).map((f) => f.flightNumber);
  let processed = 0;
  const tmpIndeg = new Map(indeg);
  const tmpQ = [...queue];
  while (tmpQ.length) {
    const id = tmpQ.shift()!;
    processed++;
    for (const nxt of adj.get(id) ?? []) {
      tmpIndeg.set(nxt, (tmpIndeg.get(nxt) ?? 0) - 1);
      if ((tmpIndeg.get(nxt) ?? 0) === 0) tmpQ.push(nxt);
    }
  }
  const inCycle = new Set<string>();
  if (processed < active.length) {
    const reachable = new Set(queue);
    const work = [...queue];
    while (work.length) {
      const id = work.shift()!;
      for (const nxt of adj.get(id) ?? []) {
        if (!reachable.has(nxt)) {
          reachable.add(nxt);
          work.push(nxt);
        }
      }
    }
    for (const f of active) if (!reachable.has(f.flightNumber)) inCycle.add(f.flightNumber);
  }

  // --- Strict global priority order with on-demand dependency placement ---
  // Flights are considered in strict (priority, submission, flight number)
  // order. A flight's dependency chain is emitted immediately before it and
  // therefore *ahead of any lower-priority flight*, so a high-priority flight
  // (or its dependencies) can never be delayed behind an unrelated
  // lower-priority flight that happened to grab an earlier slot. Fully
  // deterministic: the sort is a total order and DFS visitation is fixed.
  const cmp = (a: Flight, b: Flight) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    a.submittedSeq - b.submittedSeq ||
    a.flightNumber.localeCompare(b.flightNumber);

  const order: Flight[] = [];
  const emitted = new Set<string>();
  const visit = (f: Flight) => {
    if (emitted.has(f.flightNumber) || inCycle.has(f.flightNumber)) return;
    emitted.add(f.flightNumber);
    for (const dep of f.dependencies) {
      const d = byId.get(dep);
      if (d && !inCycle.has(dep)) visit(d);
    }
    order.push(f);
  };
  for (const f of [...active].sort(cmp)) visit(f);

  for (const id of inCycle) {
    unscheduled.set(id, "Cyclic dependency detected; cannot determine an ordering.");
  }

  // --- Placement ---
  for (const f of order) {
    // Runway length feasibility.
    const minLen = f.requirements.minRunwayLengthM;
    const eligibleRunways = runways.filter((r) => minLen === undefined || r.lengthM >= minLen);
    if (eligibleRunways.length === 0) {
      unscheduled.set(
        f.flightNumber,
        `No runway meets the required length of ${minLen} m (longest available is ${maxRunwayLen} m).`,
      );
      continue;
    }

    // Dependency constraints.
    let depReady = 0;
    let blocked: string | null = null;
    for (const dep of f.dependencies) {
      if (cancelled.has(dep)) continue; // dependency cancelled -> constraint dropped
      if (!byId.has(dep)) {
        blocked = `Depends on unknown flight "${dep}".`;
        break;
      }
      const depAsg = scheduled.get(dep);
      if (!depAsg) {
        blocked = `Blocked by dependency "${dep}" which is not scheduled.`;
        break;
      }
      depReady = Math.max(depReady, depAsg.completeSec + cfg.dependencyBufferSec);
    }
    if (blocked) {
      unscheduled.set(f.flightNumber, blocked);
      continue;
    }

    // Candidate start times: dependency-ready time plus the boundaries created
    // by every existing runway/gate occupancy. This keeps placement
    // deterministic and finds the earliest feasible slot.
    const candidates = new Set<number>([depReady]);
    const offsets = [0, cfg.sepTakeoffSec, cfg.sepLandingSec, cfg.sepMixedSec];
    const addBoundary = (end: number) => {
      for (const b of offsets) {
        // The boundary may bind either the runway window or the gate window;
        // map it through both interpretations so the earliest feasible start
        // is always among the candidates.
        candidates.add(end + b);
        candidates.add(toStart(cfg, f.operation, end + b));
      }
    };
    for (const r of runways) for (const o of r.ops) addBoundary(o.end);
    for (const g of gates) for (const o of g.ops) addBoundary(o.end);
    for (const c of crews) for (const o of c.ops) addBoundary(o.end);
    const sorted = [...candidates].filter((t) => t >= depReady).sort((a, b) => a - b);

    let chosen: { asg: Assignment; rw: RunwayState; gate: PoolState; crew: PoolState } | null = null;
    for (const s0 of sorted) {
      const s = Math.max(0, s0);
      const w = windowsFor(cfg, f.operation, s);
      if (w.completeSec > cfg.maxHorizonSec) continue;
      const runwayWin: Interval = { start: w.runwayStart, end: w.runwayEnd, op: f.operation };
      const gateWin: Interval = { start: w.gateStart, end: w.gateEnd, op: f.operation };
      const gate = gates.find((g) => poolFree(g, gateWin));
      if (!gate) continue;
      // A specific ground crew works this turnaround for the gate window.
      const crew = crews.find((c) => poolFree(c, gateWin));
      if (!crew) continue;
      const rw = eligibleRunways.find((r) => runwayFree(cfg, r, runwayWin));
      if (!rw) continue;
      chosen = {
        rw,
        gate,
        crew,
        asg: {
          runwayId: rw.id,
          gateId: gate.id,
          crewId: crew.id,
          startSec: s,
          completeSec: w.completeSec,
          runwayStartSec: w.runwayStart,
          runwayEndSec: w.runwayEnd,
          gateStartSec: w.gateStart,
          gateEndSec: w.gateEnd,
        },
      };
      break;
    }

    if (!chosen) {
      unscheduled.set(
        f.flightNumber,
        `No conflict-free runway/gate/crew slot available within the ${cfg.maxHorizonSec}s scheduling horizon.`,
      );
      continue;
    }

    chosen.rw.ops.push({ start: chosen.asg.runwayStartSec, end: chosen.asg.runwayEndSec, op: f.operation });
    chosen.gate.ops.push({ start: chosen.asg.gateStartSec, end: chosen.asg.gateEndSec, op: f.operation });
    chosen.crew.ops.push({ start: chosen.asg.gateStartSec, end: chosen.asg.gateEndSec, op: f.operation });
    scheduled.set(f.flightNumber, chosen.asg);
  }

  let completionSec: number | null = null;
  for (const a of scheduled.values()) completionSec = Math.max(completionSec ?? 0, a.completeSec);

  return { scheduled, unscheduled, completionSec };
}

/**
 * Given a desired *runway-window* boundary time, return the operation start
 * that would place the runway window at that boundary. For departures the
 * runway window is offset from the start by the gate turnaround.
 */
function toStart(cfg: AirportConfig, op: OpType, runwayBoundary: number): number {
  if (op === "arrival") return runwayBoundary;
  return runwayBoundary - cfg.gateTurnaroundSec;
}

export interface BottleneckChain {
  flights: string[];
  totalDurationSec: number;
  startSec: number;
  completeSec: number;
}

/**
 * Longest active scheduled dependency chain (critical path). The chain's
 * elapsed duration spans from the first flight's start to the last flight's
 * completion, inherently accounting for operation durations and the dependency
 * buffers enforced during scheduling.
 */
export function analyzeBottleneck(
  flights: Flight[],
  scheduled: Map<string, Assignment>,
): BottleneckChain | null {
  const sched = flights.filter((f) => scheduled.has(f.flightNumber));
  const byId = new Map(sched.map((f) => [f.flightNumber, f]));

  // best[id] = { len, start, path } for the longest chain ending at id.
  const best = new Map<string, { complete: number; start: number; path: string[] }>();
  const order = [...sched].sort(
    (a, b) => scheduled.get(a.flightNumber)!.startSec - scheduled.get(b.flightNumber)!.startSec ||
      a.flightNumber.localeCompare(b.flightNumber),
  );

  for (const f of order) {
    const asg = scheduled.get(f.flightNumber)!;
    // Elapsed of a chain ending at f = f.complete - (start of the earliest
    // flight on the chosen path). f.complete is fixed, so the longest chain
    // ending at f is the one whose predecessor path has the smallest start.
    let pick: { complete: number; start: number; path: string[] } | null = null;
    for (const dep of f.dependencies) {
      if (!byId.has(dep)) continue;
      const b = best.get(dep);
      if (!b) continue;
      if (
        !pick ||
        b.start < pick.start ||
        (b.start === pick.start && b.path.length > pick.path.length) ||
        (b.start === pick.start && b.path.length === pick.path.length && b.path.join() < pick.path.join())
      ) {
        pick = b;
      }
    }
    if (pick) {
      best.set(f.flightNumber, {
        complete: asg.completeSec,
        start: pick.start,
        path: [...pick.path, f.flightNumber],
      });
    } else {
      best.set(f.flightNumber, { complete: asg.completeSec, start: asg.startSec, path: [f.flightNumber] });
    }
  }

  let winner: { complete: number; start: number; path: string[] } | null = null;
  for (const b of best.values()) {
    if (b.path.length < 2) continue; // a real chain needs >= 2 dependent flights
    if (!winner || b.complete - b.start > winner.complete - winner.start) winner = b;
  }
  if (!winner) return null;
  return {
    flights: winner.path,
    totalDurationSec: winner.complete - winner.start,
    startSec: winner.start,
    completeSec: winner.complete,
  };
}
