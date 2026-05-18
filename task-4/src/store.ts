import type { AirportConfig } from "./config.js";
import { analyzeBottleneck, type BottleneckChain, schedule } from "./scheduler.js";
import type { Flight, OpType, Priority } from "./types.js";

export interface SubmitInput {
  flightNumber: string;
  operation: OpType;
  priority?: Priority;
  dependencies?: string[];
  minRunwayLengthM?: number;
}

export class AirportStore {
  private flights = new Map<string, Flight>();
  private seq = 0;
  private lastScheduleAt: string | null = null;
  private completionSec: number | null = null;

  constructor(public readonly cfg: AirportConfig) {}

  reset(): void {
    this.flights.clear();
    this.seq = 0;
    this.lastScheduleAt = null;
    this.completionSec = null;
  }

  submit(input: SubmitInput): Flight {
    if (this.flights.has(input.flightNumber)) {
      throw new Error(`Flight "${input.flightNumber}" already exists.`);
    }
    const flight: Flight = {
      flightNumber: input.flightNumber,
      operation: input.operation,
      priority: input.priority ?? "medium",
      dependencies: input.dependencies ?? [],
      requirements: { minRunwayLengthM: input.minRunwayLengthM },
      state: "queued",
      submittedSeq: this.seq++,
    };
    this.flights.set(flight.flightNumber, flight);
    return flight;
  }

  cancel(flightNumber: string): Flight {
    const f = this.flights.get(flightNumber);
    if (!f) throw new Error(`Unknown flight "${flightNumber}".`);
    f.state = "cancelled";
    f.reason = "Cancelled by operator.";
    f.assignment = undefined;
    // Dependent flights are re-evaluated on the next generateSchedule call.
    return f;
  }

  list(): Flight[] {
    return [...this.flights.values()].sort((a, b) => a.submittedSeq - b.submittedSeq);
  }

  get(flightNumber: string): Flight | undefined {
    return this.flights.get(flightNumber);
  }

  /** Replace the current schedule with a freshly computed one. */
  generateSchedule(): { scheduled: number; unscheduled: number; completionSec: number | null } {
    for (const f of this.flights.values()) {
      if (f.state === "cancelled") continue;
      f.state = "queued";
      f.reason = undefined;
      f.assignment = undefined;
    }
    const result = schedule(this.cfg, this.list());
    for (const f of this.flights.values()) {
      if (f.state === "cancelled") continue;
      const asg = result.scheduled.get(f.flightNumber);
      if (asg) {
        f.state = "scheduled";
        f.assignment = asg;
        f.reason = undefined;
      } else {
        f.state = "unscheduled";
        f.reason = result.unscheduled.get(f.flightNumber) ?? "Could not be scheduled.";
      }
    }
    this.lastScheduleAt = new Date().toISOString();
    this.completionSec = result.completionSec;
    return {
      scheduled: result.scheduled.size,
      unscheduled: result.unscheduled.size,
      completionSec: result.completionSec,
    };
  }

  bottleneck(): BottleneckChain | null {
    const scheduled = new Map(
      this.list()
        .filter((f) => f.assignment)
        .map((f) => [f.flightNumber, f.assignment!]),
    );
    return analyzeBottleneck(this.list(), scheduled);
  }

  /** Relative offset -> absolute ISO timestamp (only when an epoch is configured). */
  private iso(sec: number | null | undefined): string | null {
    if (sec == null || !this.cfg.scheduleEpoch) return null;
    return new Date(Date.parse(this.cfg.scheduleEpoch) + sec * 1000).toISOString();
  }

  status() {
    const flights = this.list();
    const byState: Record<string, number> = { queued: 0, scheduled: 0, unscheduled: 0, cancelled: 0 };
    const byOp: Record<string, number> = { arrival: 0, departure: 0 };
    for (const f of flights) {
      byState[f.state]++;
      byOp[f.operation]++;
    }
    const scheduled = flights.filter((f) => f.assignment);

    const runwayUsage = this.cfg.runways.map((r) => {
      const ops = scheduled.filter((f) => f.assignment!.runwayId === r.id);
      const busy = ops.reduce((s, f) => s + (f.assignment!.runwayEndSec - f.assignment!.runwayStartSec), 0);
      return {
        runwayId: r.id,
        lengthM: r.lengthM,
        operations: ops.length,
        busySec: busy,
        utilizationPct: this.completionSec ? Math.round((busy / this.completionSec) * 100) : 0,
      };
    });
    const gateUsage = Array.from({ length: this.cfg.gateCount }, (_, i) => `GATE-${i + 1}`).map((id) => {
      const ops = scheduled.filter((f) => f.assignment!.gateId === id);
      return {
        gateId: id,
        operations: ops.length,
        busySec: ops.reduce((s, f) => s + (f.assignment!.gateEndSec - f.assignment!.gateStartSec), 0),
      };
    });
    const crewUsage = Array.from({ length: this.cfg.groundCrewCount }, (_, i) => `CREW-${i + 1}`).map((id) => {
      const ops = scheduled.filter((f) => f.assignment!.crewId === id);
      return {
        crewId: id,
        operations: ops.length,
        busySec: ops.reduce((s, f) => s + (f.assignment!.gateEndSec - f.assignment!.gateStartSec), 0),
      };
    });
    const blocked = flights
      .filter((f) => f.state === "unscheduled")
      .map((f) => ({ flightNumber: f.flightNumber, reason: f.reason }));

    return {
      flightsByState: byState,
      flightsByOperation: byOp,
      runways: {
        count: this.cfg.runways.length,
        usage: runwayUsage,
      },
      gates: {
        count: this.cfg.gateCount,
        scheduledOccupancies: scheduled.length,
        usage: gateUsage,
      },
      groundCrew: {
        count: this.cfg.groundCrewCount,
        usage: crewUsage,
      },
      resourceConstraints: {
        runwaySaturated: runwayUsage.some((u) => u.utilizationPct >= 80),
        gatesFullyBooked: gateUsage.length > 0 && gateUsage.every((g) => g.operations > 0),
        crewFullyBooked: crewUsage.length > 0 && crewUsage.every((c) => c.operations > 0),
        anyBlocked: blocked.length > 0,
      },
      blockedFlights: blocked,
      scheduleCompletionSec: this.completionSec,
      scheduleEpoch: this.cfg.scheduleEpoch ?? null,
      scheduleCompletionTime: this.iso(this.completionSec),
      lastScheduleAt: this.lastScheduleAt,
    };
  }

  runwayResource() {
    const flights = this.list().filter((f) => f.assignment);
    return this.cfg.runways.map((r) => ({
      runwayId: r.id,
      lengthM: r.lengthM,
      operations: flights
        .filter((f) => f.assignment!.runwayId === r.id)
        .map((f) => ({
          flightNumber: f.flightNumber,
          operation: f.operation,
          startSec: f.assignment!.runwayStartSec,
          endSec: f.assignment!.runwayEndSec,
          startTime: this.iso(f.assignment!.runwayStartSec),
          endTime: this.iso(f.assignment!.runwayEndSec),
        }))
        .sort((a, b) => a.startSec - b.startSec),
    }));
  }

  timelineResource() {
    return this.list()
      .filter((f) => f.assignment)
      .map((f) => ({
        flightNumber: f.flightNumber,
        operation: f.operation,
        priority: f.priority,
        runwayId: f.assignment!.runwayId,
        gateId: f.assignment!.gateId,
        crewId: f.assignment!.crewId,
        startSec: f.assignment!.startSec,
        completeSec: f.assignment!.completeSec,
        startTime: this.iso(f.assignment!.startSec),
        completeTime: this.iso(f.assignment!.completeSec),
        runwayStartSec: f.assignment!.runwayStartSec,
        runwayEndSec: f.assignment!.runwayEndSec,
        gateStartSec: f.assignment!.gateStartSec,
        gateEndSec: f.assignment!.gateEndSec,
        dependencies: f.dependencies,
      }))
      .sort((a, b) => a.startSec - b.startSec || a.flightNumber.localeCompare(b.flightNumber));
  }

  queueResource() {
    const flights = this.list();
    const pick = (state: string) =>
      flights
        .filter((f) => f.state === state)
        .map((f) => ({
          flightNumber: f.flightNumber,
          operation: f.operation,
          priority: f.priority,
          dependencies: f.dependencies,
          requirements: f.requirements,
          reason: f.reason,
          assignment: f.assignment,
        }));
    return {
      scheduled: pick("scheduled"),
      queued: pick("queued"),
      unscheduled: pick("unscheduled"),
      cancelled: pick("cancelled"),
    };
  }
}
