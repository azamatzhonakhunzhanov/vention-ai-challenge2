// Airport configuration loaded strictly from environment variables.
// Invalid configuration throws a clear error so the process fails fast at startup.

export interface RunwaySpec {
  id: string;
  lengthM: number;
}

export interface AirportConfig {
  runways: RunwaySpec[];
  gateCount: number;
  groundCrewCount: number;
  sepTakeoffSec: number;
  sepLandingSec: number;
  sepMixedSec: number;
  gateTurnaroundSec: number;
  dependencyBufferSec: number;
  maxHorizonSec: number;
  arrivalDurationSec: number;
  departureDurationSec: number;
  /**
   * Optional fixed anchor for converting relative schedule offsets into
   * absolute ISO timestamps. Fixed config (not wall-clock), so schedules stay
   * deterministic. Undefined => outputs expose relative seconds only.
   */
  scheduleEpoch?: string;
}

class ConfigError extends Error {}

function num(env: NodeJS.ProcessEnv, key: string, def: number | undefined, opts: { min?: number; integer?: boolean }): number {
  const raw = env[key];
  let value: number;
  if (raw === undefined || raw.trim() === "") {
    if (def === undefined) throw new ConfigError(`Missing required env var ${key}`);
    value = def;
  } else {
    value = Number(raw);
    if (!Number.isFinite(value)) throw new ConfigError(`Env var ${key} must be a number, got "${raw}"`);
  }
  if (opts.integer && !Number.isInteger(value)) throw new ConfigError(`Env var ${key} must be an integer, got "${raw ?? def}"`);
  if (opts.min !== undefined && value < opts.min) {
    throw new ConfigError(`Env var ${key} must be >= ${opts.min}, got ${value}`);
  }
  return value;
}

function parseRunways(env: NodeJS.ProcessEnv): RunwaySpec[] {
  const lengthsRaw = env.ATC_RUNWAY_LENGTHS_M;
  if (lengthsRaw && lengthsRaw.trim() !== "") {
    const parts = lengthsRaw.split(",").map((s) => s.trim()).filter((s) => s !== "");
    if (parts.length === 0) throw new ConfigError(`ATC_RUNWAY_LENGTHS_M is empty`);
    return parts.map((p, i) => {
      const len = Number(p);
      if (!Number.isFinite(len) || len <= 0) {
        throw new ConfigError(`ATC_RUNWAY_LENGTHS_M entry #${i + 1} must be a positive number, got "${p}"`);
      }
      return { id: `RWY-${i + 1}`, lengthM: len };
    });
  }
  const count = num(env, "ATC_RUNWAY_COUNT", undefined, { min: 1, integer: true });
  const defaultLen = num(env, "ATC_RUNWAY_DEFAULT_LENGTH_M", 3000, { min: 1 });
  return Array.from({ length: count }, (_, i) => ({ id: `RWY-${i + 1}`, lengthM: defaultLen }));
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AirportConfig {
  const runways = parseRunways(env);
  const cfg: AirportConfig = {
    runways,
    gateCount: num(env, "ATC_GATE_COUNT", undefined, { min: 1, integer: true }),
    groundCrewCount: num(env, "ATC_GROUND_CREW_COUNT", undefined, { min: 1, integer: true }),
    sepTakeoffSec: num(env, "ATC_SEP_TAKEOFF_SEC", 120, { min: 0 }),
    sepLandingSec: num(env, "ATC_SEP_LANDING_SEC", 120, { min: 0 }),
    sepMixedSec: num(env, "ATC_SEP_MIXED_SEC", 90, { min: 0 }),
    gateTurnaroundSec: num(env, "ATC_GATE_TURNAROUND_SEC", 1800, { min: 0 }),
    dependencyBufferSec: num(env, "ATC_DEPENDENCY_BUFFER_SEC", 600, { min: 0 }),
    maxHorizonSec: num(env, "ATC_MAX_HORIZON_SEC", 86400, { min: 1 }),
    arrivalDurationSec: num(env, "ATC_ARRIVAL_DURATION_SEC", 300, { min: 1 }),
    departureDurationSec: num(env, "ATC_DEPARTURE_DURATION_SEC", 300, { min: 1 }),
  };

  const epochRaw = env.ATC_SCHEDULE_EPOCH;
  if (epochRaw !== undefined && epochRaw.trim() !== "") {
    const ms = Date.parse(epochRaw);
    if (Number.isNaN(ms)) {
      throw new ConfigError(`Env var ATC_SCHEDULE_EPOCH must be an ISO 8601 timestamp, got "${epochRaw}"`);
    }
    cfg.scheduleEpoch = new Date(ms).toISOString();
  }
  return cfg;
}

export { ConfigError };
