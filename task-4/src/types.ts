export type Priority = "high" | "medium" | "low";
export type OpType = "arrival" | "departure";
export type FlightState = "queued" | "scheduled" | "unscheduled" | "cancelled";

export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export interface FlightRequirements {
  minRunwayLengthM?: number;
}

export interface Assignment {
  runwayId: string;
  gateId: string;
  crewId: string;
  /** Overall operation window (taxi/gate + runway). */
  startSec: number;
  completeSec: number;
  /** Runway occupancy window. */
  runwayStartSec: number;
  runwayEndSec: number;
  /** Gate occupancy window. */
  gateStartSec: number;
  gateEndSec: number;
}

export interface Flight {
  flightNumber: string;
  operation: OpType;
  priority: Priority;
  dependencies: string[];
  requirements: FlightRequirements;
  state: FlightState;
  /** Human-readable reason when unscheduled or cancelled. */
  reason?: string;
  submittedSeq: number;
  assignment?: Assignment;
}
