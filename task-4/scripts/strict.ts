import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function mk(env: Record<string, string>) {
  const t = new StdioClientTransport({
    command: process.execPath,
    args: [new URL("../dist/index.js", import.meta.url).pathname],
    env: { ...process.env, ...env } as Record<string, string>,
  });
  const c = new Client({ name: "strict", version: "1.0.0" });
  await c.connect(t);
  return { c, t };
}
const parse = (r: any) => JSON.parse(r.content[0].text);
const call = (c: Client, n: string, a: any = {}) => c.callTool({ name: n, arguments: a }).then(parse);

const BASE = {
  ATC_RUNWAY_COUNT: "1",
  ATC_GATE_COUNT: "1",
  ATC_GROUND_CREW_COUNT: "1",
  ATC_GATE_TURNAROUND_SEC: "300",
  ATC_DEPENDENCY_BUFFER_SEC: "300",
  ATC_ARRIVAL_DURATION_SEC: "300",
  ATC_DEPARTURE_DURATION_SEC: "300",
};

async function tEnumerate() {
  const { c, t } = await mk(BASE);
  const tools = (await c.listTools()).tools.map((x) => x.name).sort();
  const res = (await c.listResources()).resources.map((x) => x.uri).sort();
  console.log("listTools ->", tools.join(", "));
  console.log("listResources ->", res.join(", "));
  await t.close();
}

async function tPriorityContended() {
  // 1 runway, 1 gate, 1 crew. Submit LOW first, then HIGH. Same op type so they
  // genuinely contend for the single runway.
  const { c, t } = await mk(BASE);
  await call(c, "reset_airport");
  await call(c, "submit_flight", { flightNumber: "LOW-1", operation: "departure", priority: "low" });
  await call(c, "submit_flight", { flightNumber: "HIGH-1", operation: "departure", priority: "high" });
  await call(c, "submit_flight", { flightNumber: "MED-1", operation: "departure", priority: "medium" });
  await call(c, "generate_schedule");
  const tl = (await call(c, "get_airport_status")).status;
  const q = parse(await c.readResource({ uri: "atc://timeline" } as any).then((r: any) => ({ content: [{ text: r.contents[0].text }] })));
  const byNum: Record<string, number> = {};
  for (const o of q) byNum[o.flightNumber] = o.startSec;
  console.log("contended starts ->", JSON.stringify(byNum), "completion", tl.scheduleCompletionSec);
  const ok = byNum["HIGH-1"] < byNum["MED-1"] && byNum["MED-1"] < byNum["LOW-1"];
  console.log(ok ? "  PASS priority strictly orders under contention" : "  FAIL priority order wrong");
  await t.close();
}

async function tBottleneckOptimality() {
  // Build a diamond where the longest *elapsed* chain is NOT the one whose
  // predecessor has the largest own-span. Tests analyzeBottleneck correctness.
  //
  // EARLY (arrival, starts 0) ---> TAIL
  // LATEBIG (arrival) -----------> TAIL
  // TAIL depends on both EARLY and LATEBIG.
  const { c, t } = await mk({
    ...BASE,
    ATC_RUNWAY_COUNT: "3",
    ATC_GATE_COUNT: "3",
    ATC_GROUND_CREW_COUNT: "3",
    ATC_DEPENDENCY_BUFFER_SEC: "0",
  });
  await call(c, "reset_airport");
  // EARLY: plain short arrival, starts at 0, completes early.
  await call(c, "submit_flight", { flightNumber: "EARLY", operation: "arrival", priority: "high" });
  // MIDDLE depends on EARLY (so EARLY's chain has span > 0), completes a bit later.
  await call(c, "submit_flight", { flightNumber: "MIDDLE", operation: "arrival", priority: "high", dependencies: ["EARLY"] });
  // LATE: independent arrival but we delay it via a dependency on MIDDLE-less path.
  await call(c, "submit_flight", { flightNumber: "LATE", operation: "arrival", priority: "low" });
  // TAIL depends on EARLY (early start, long elapsed) and LATE (late start, short elapsed).
  await call(c, "submit_flight", { flightNumber: "TAIL", operation: "departure", priority: "high", dependencies: ["EARLY", "LATE"] });
  await call(c, "generate_schedule");
  const tl: any[] = await c
    .readResource({ uri: "atc://timeline" } as any)
    .then((r: any) => JSON.parse(r.contents[0].text));
  const s: Record<string, any> = {};
  for (const o of tl) s[o.flightNumber] = o;
  const chain = (await call(c, "analyze_bottleneck")).chain;
  // True longest elapsed chain ending at TAIL = TAIL.complete - min(ancestor.start).
  const viaEarly = s["TAIL"].completeSec - s["EARLY"].startSec;
  const viaLate = s["TAIL"].completeSec - s["LATE"].startSec;
  const trueMax = Math.max(viaEarly, viaLate);
  console.log("starts:", JSON.stringify(Object.fromEntries(Object.entries(s).map(([k, v]: any) => [k, [v.startSec, v.completeSec]]))));
  console.log("reported chain:", JSON.stringify(chain));
  console.log(`viaEARLY=${viaEarly} viaLATE=${viaLate} trueMax=${trueMax} reported=${chain?.totalDurationSec}`);
  console.log(chain && chain.totalDurationSec === trueMax ? "  PASS bottleneck is the true longest" : "  FAIL bottleneck NOT the true longest elapsed chain");
  await t.close();
}

async function tBottleneckTrigger() {
  // Single runway serializes roots so chain start times genuinely differ.
  // A: root, start 0.  ROOT: root, start 300.  B: depends ROOT (bigger span).
  // TAIL: depends [A, B]. True longest = A->TAIL (start 0). The buggy DP picks
  // B as predecessor because its own span is larger, under-reporting the chain.
  const { c, t } = await mk({
    ATC_RUNWAY_COUNT: "1",
    ATC_GATE_COUNT: "5",
    ATC_GROUND_CREW_COUNT: "5",
    ATC_SEP_TAKEOFF_SEC: "0",
    ATC_SEP_LANDING_SEC: "0",
    ATC_SEP_MIXED_SEC: "0",
    ATC_GATE_TURNAROUND_SEC: "300",
    ATC_DEPENDENCY_BUFFER_SEC: "0",
    ATC_ARRIVAL_DURATION_SEC: "300",
    ATC_DEPARTURE_DURATION_SEC: "300",
  });
  await call(c, "reset_airport");
  await call(c, "submit_flight", { flightNumber: "A", operation: "arrival", priority: "high" });
  await call(c, "submit_flight", { flightNumber: "ROOT", operation: "arrival", priority: "high" });
  await call(c, "submit_flight", { flightNumber: "B", operation: "arrival", priority: "high", dependencies: ["ROOT"] });
  await call(c, "submit_flight", { flightNumber: "TAIL", operation: "departure", priority: "high", dependencies: ["A", "B"] });
  await call(c, "generate_schedule");
  const tl: any[] = await c.readResource({ uri: "atc://timeline" } as any).then((r: any) => JSON.parse(r.contents[0].text));
  const s: Record<string, any> = {};
  for (const o of tl) s[o.flightNumber] = o;
  const chain = (await call(c, "analyze_bottleneck")).chain;
  const trueMax = Math.max(
    s["TAIL"].completeSec - s["A"].startSec,
    s["TAIL"].completeSec - s["ROOT"].startSec,
  );
  console.log("starts/completes:", JSON.stringify(Object.fromEntries(Object.entries(s).map(([k, v]: any) => [k, [v.startSec, v.completeSec]]))));
  console.log("reported chain:", JSON.stringify(chain));
  console.log(`trueMaxElapsedToTAIL=${trueMax} reported=${chain?.totalDurationSec}`);
  console.log(chain && chain.totalDurationSec >= trueMax ? "  PASS bottleneck reports the true longest" : "  FAIL bottleneck under-reports (selection bug)");
  await t.close();
}

function ok(name: string, cond: boolean, detail?: unknown) {
  console.log(cond ? `  PASS ${name}` : `  FAIL ${name}${detail !== undefined ? " :: " + JSON.stringify(detail) : ""}`);
}

async function tPriorityInversionFixed() {
  // The exact documented pathology: H is high priority but depends on D (low);
  // L is an unrelated low-priority flight. Single runway. H must NOT end up
  // behind L. Expected order of starts: D < H < L.
  console.log("\nFix #1: priority never inverted by an unrelated lower-priority flight");
  const { c, t } = await mk({
    ATC_RUNWAY_COUNT: "1",
    ATC_GATE_COUNT: "5",
    ATC_GROUND_CREW_COUNT: "5",
    ATC_SEP_TAKEOFF_SEC: "0",
    ATC_SEP_LANDING_SEC: "0",
    ATC_SEP_MIXED_SEC: "0",
    ATC_GATE_TURNAROUND_SEC: "0",
    ATC_DEPENDENCY_BUFFER_SEC: "0",
    ATC_ARRIVAL_DURATION_SEC: "300",
    ATC_DEPARTURE_DURATION_SEC: "300",
  });
  await call(c, "reset_airport");
  await call(c, "submit_flight", { flightNumber: "L", operation: "departure", priority: "low" });
  await call(c, "submit_flight", { flightNumber: "D", operation: "departure", priority: "low" });
  await call(c, "submit_flight", { flightNumber: "H", operation: "departure", priority: "high", dependencies: ["D"] });
  await call(c, "generate_schedule");
  const tl: any[] = await c.readResource({ uri: "atc://timeline" } as any).then((r: any) => JSON.parse(r.contents[0].text));
  const s: Record<string, number> = {};
  for (const o of tl) s[o.flightNumber] = o.startSec;
  console.log("starts ->", JSON.stringify(s));
  ok("D (dependency of high) before L", s["D"] < s["L"], s);
  ok("H (high) before L (unrelated low)", s["H"] < s["L"], s);
  await t.close();
}

async function tPerCrewAssignment() {
  // 2 crews, abundant runways/gates. 3 simultaneous arrivals contend for crew.
  console.log("\nFix #3: real per-crew assignment (no crew double-booked)");
  const { c, t } = await mk({
    ATC_RUNWAY_COUNT: "5",
    ATC_GATE_COUNT: "5",
    ATC_GROUND_CREW_COUNT: "2",
    ATC_SEP_TAKEOFF_SEC: "0",
    ATC_SEP_LANDING_SEC: "0",
    ATC_SEP_MIXED_SEC: "0",
    ATC_GATE_TURNAROUND_SEC: "300",
    ATC_DEPENDENCY_BUFFER_SEC: "0",
    ATC_ARRIVAL_DURATION_SEC: "300",
    ATC_DEPARTURE_DURATION_SEC: "300",
  });
  await call(c, "reset_airport");
  for (const n of ["F1", "F2", "F3"]) await call(c, "submit_flight", { flightNumber: n, operation: "arrival", priority: "medium" });
  await call(c, "generate_schedule");
  const tl: any[] = await c.readResource({ uri: "atc://timeline" } as any).then((r: any) => JSON.parse(r.contents[0].text));
  const crews = new Set(tl.map((o) => o.crewId));
  ok("every flight has a crewId", tl.every((o) => /^CREW-\d+$/.test(o.crewId)), tl.map((o) => o.crewId));
  ok("only CREW-1/CREW-2 used (cap respected)", [...crews].every((x) => x === "CREW-1" || x === "CREW-2"), [...crews]);
  // No crew handles two overlapping gate windows.
  let dbl = false;
  for (let i = 0; i < tl.length; i++) {
    for (let j = i + 1; j < tl.length; j++) {
      if (tl[i].crewId === tl[j].crewId && tl[i].gateStartSec < tl[j].gateEndSec && tl[j].gateStartSec < tl[i].gateEndSec) dbl = true;
    }
  }
  ok("no crew double-booked across overlapping turnarounds", !dbl);
  const status = (await call(c, "get_airport_status")).status;
  ok("status exposes per-crew usage", Array.isArray(status.groundCrew.usage) && status.groundCrew.usage.length === 2, status.groundCrew);
  await t.close();
}

async function tScheduleEpoch() {
  console.log("\nFix #2: deterministic wall-clock timestamps via ATC_SCHEDULE_EPOCH");
  const EPOCH = "2030-01-01T00:00:00.000Z";
  const run = async () => {
    const { c, t } = await mk({
      ATC_RUNWAY_COUNT: "1",
      ATC_GATE_COUNT: "1",
      ATC_GROUND_CREW_COUNT: "1",
      ATC_GATE_TURNAROUND_SEC: "300",
      ATC_ARRIVAL_DURATION_SEC: "300",
      ATC_SCHEDULE_EPOCH: EPOCH,
    });
    await call(c, "reset_airport");
    await call(c, "submit_flight", { flightNumber: "EP1", operation: "arrival", priority: "high" });
    await call(c, "generate_schedule");
    const tl: any[] = await c.readResource({ uri: "atc://timeline" } as any).then((r: any) => JSON.parse(r.contents[0].text));
    const st = (await call(c, "get_airport_status")).status;
    await t.close();
    return { tl, st };
  };
  const a = await run();
  const b = await run();
  const f = a.tl[0];
  console.log("EP1 ->", f.startTime, "..", f.completeTime, "epoch", a.st.scheduleEpoch);
  ok("startTime == epoch + startSec", f.startTime === new Date(Date.parse(EPOCH) + f.startSec * 1000).toISOString());
  ok("completeTime == epoch + completeSec", f.completeTime === new Date(Date.parse(EPOCH) + f.completeSec * 1000).toISOString());
  ok("status reports the configured epoch", a.st.scheduleEpoch === EPOCH);
  ok("absolute timestamps are deterministic across runs", JSON.stringify(a.tl) === JSON.stringify(b.tl), { a: a.tl[0], b: b.tl[0] });
}

async function main() {
  await tEnumerate();
  await tPriorityContended();
  await tBottleneckOptimality();
  await tBottleneckTrigger();
  await tPriorityInversionFixed();
  await tPerCrewAssignment();
  await tScheduleEpoch();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
