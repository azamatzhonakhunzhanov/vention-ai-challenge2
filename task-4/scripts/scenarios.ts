/**
 * End-to-end validation: starts the built server as a subprocess and drives it
 * through a real MCP stdio client. Run with: npm run scenarios
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const ENV = {
  ATC_RUNWAY_LENGTHS_M: "3000,2500",
  ATC_GATE_COUNT: "2",
  ATC_GROUND_CREW_COUNT: "2",
  ATC_SEP_TAKEOFF_SEC: "120",
  ATC_SEP_LANDING_SEC: "120",
  ATC_SEP_MIXED_SEC: "90",
  ATC_GATE_TURNAROUND_SEC: "600",
  ATC_DEPENDENCY_BUFFER_SEC: "300",
  ATC_MAX_HORIZON_SEC: "86400",
  ATC_ARRIVAL_DURATION_SEC: "300",
  ATC_DEPARTURE_DURATION_SEC: "300",
};

let pass = 0;
let failCount = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    failCount++;
    console.log(`  FAIL  ${name}${detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""}`);
  }
}

async function newClient() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [new URL("../dist/index.js", import.meta.url).pathname],
    env: { ...process.env, ...ENV } as Record<string, string>,
  });
  const client = new Client({ name: "scenario-runner", version: "1.0.0" });
  await client.connect(transport);
  return { client, transport };
}

const parse = (r: any) => JSON.parse(r.content[0].text);
const call = (c: Client, name: string, args: any = {}) => c.callTool({ name, arguments: args }).then(parse);
const readRes = (c: Client, uri: string) =>
  c.readResource({ uri }).then((r: any) => JSON.parse(r.contents[0].text));

async function scenario1() {
  console.log("\nScenario 1: Morning Rush");
  const { client, transport } = await newClient();
  await call(client, "reset_airport");
  await call(client, "submit_flight", { flightNumber: "AR-HI", operation: "arrival", priority: "high" });
  await call(client, "submit_flight", { flightNumber: "DP-MD", operation: "departure", priority: "medium" });
  await call(client, "submit_flight", { flightNumber: "AR-LO", operation: "arrival", priority: "low" });
  await call(client, "submit_flight", { flightNumber: "DP-LO", operation: "departure", priority: "low" });
  const gen = await call(client, "generate_schedule");
  check("all 4 flights scheduled", gen.scheduled === 4, gen);
  const queue = await readRes(client, "atc://flights/queue");
  check("no unscheduled flights", queue.unscheduled.length === 0, queue.unscheduled);
  const timeline = await readRes(client, "atc://timeline");
  // No overlapping runway usage on the same runway.
  let conflict = false;
  for (const r of await readRes(client, "atc://runways/usage")) {
    for (let i = 1; i < r.operations.length; i++) {
      if (r.operations[i].startSec < r.operations[i - 1].endSec) conflict = true;
    }
  }
  check("no overlapping runway operations", !conflict);
  const hi = timeline.find((t: any) => t.flightNumber === "AR-HI");
  const lo = timeline.find((t: any) => t.flightNumber === "AR-LO");
  check("high-priority arrival scheduled no later than low-priority arrival", hi.startSec <= lo.startSec, {
    hi: hi.startSec,
    lo: lo.startSec,
  });
  await transport.close();
}

async function scenario2() {
  console.log("\nScenario 2: Heavy Hauler");
  const { client, transport } = await newClient();
  await call(client, "reset_airport");
  await call(client, "submit_flight", {
    flightNumber: "HEAVY-1",
    operation: "departure",
    priority: "high",
    minRunwayLengthM: 6000,
  });
  await call(client, "submit_flight", { flightNumber: "OK-1", operation: "arrival", priority: "medium" });
  await call(client, "generate_schedule");
  const queue = await readRes(client, "atc://flights/queue");
  const heavy = queue.unscheduled.find((f: any) => f.flightNumber === "HEAVY-1");
  check("oversized flight is unscheduled", !!heavy, queue);
  check("reason mentions runway length", !!heavy && /runway/i.test(heavy.reason), heavy?.reason);
  check("other valid flight still scheduled", queue.scheduled.some((f: any) => f.flightNumber === "OK-1"), queue.scheduled);
  const status = (await call(client, "get_airport_status")).status;
  check("status reports the blocked flight", status.blockedFlights.some((b: any) => b.flightNumber === "HEAVY-1"));
  await transport.close();
}

async function scenario3() {
  console.log("\nScenario 3: Connecting Flight");
  const { client, transport } = await newClient();
  await call(client, "reset_airport");
  await call(client, "submit_flight", { flightNumber: "IN-100", operation: "arrival", priority: "medium" });
  await call(client, "submit_flight", {
    flightNumber: "OUT-200",
    operation: "departure",
    priority: "medium",
    dependencies: ["IN-100"],
  });
  await call(client, "generate_schedule");
  const timeline = await readRes(client, "atc://timeline");
  const inb = timeline.find((t: any) => t.flightNumber === "IN-100");
  const out = timeline.find((t: any) => t.flightNumber === "OUT-200");
  check("both flights scheduled", !!inb && !!out);
  check(
    "outbound starts >= inbound complete + dependency buffer (300s)",
    !!inb && !!out && out.startSec >= inb.completeSec + 300,
    { inComplete: inb?.completeSec, outStart: out?.startSec },
  );
  const chain = await call(client, "analyze_bottleneck");
  check(
    "bottleneck chain is IN-100 -> OUT-200",
    JSON.stringify(chain.chain?.flights) === JSON.stringify(["IN-100", "OUT-200"]),
    chain.chain,
  );
  await transport.close();
}

async function scenario4Determinism() {
  console.log("\nScenario 4: Determinism + cancellation");
  const runOnce = async () => {
    const { client, transport } = await newClient();
    await call(client, "reset_airport");
    for (let i = 1; i <= 6; i++) {
      await call(client, "submit_flight", {
        flightNumber: `F-${i}`,
        operation: i % 2 ? "arrival" : "departure",
        priority: i <= 2 ? "high" : "low",
      });
    }
    await call(client, "generate_schedule");
    const tl = await readRes(client, "atc://timeline");
    await transport.close();
    return tl.map((t: any) => `${t.flightNumber}@${t.startSec}#${t.runwayId}`).join("|");
  };
  const a = await runOnce();
  const b = await runOnce();
  check("identical inputs produce identical schedule", a === b, { a, b });

  const { client, transport } = await newClient();
  await call(client, "reset_airport");
  await call(client, "submit_flight", { flightNumber: "DEP-A", operation: "arrival" });
  await call(client, "submit_flight", { flightNumber: "DEP-B", operation: "departure", dependencies: ["DEP-A"] });
  await call(client, "generate_schedule");
  let q = await readRes(client, "atc://flights/queue");
  check("DEP-B scheduled before cancellation", q.scheduled.some((f: any) => f.flightNumber === "DEP-B"));
  const cancelResp = await call(client, "cancel_flight", { flightNumber: "DEP-A" });
  // No explicit generate_schedule here: cancel must re-evaluate immediately.
  q = await readRes(client, "atc://flights/queue");
  check("DEP-A is cancelled", q.cancelled.some((f: any) => f.flightNumber === "DEP-A"));
  check(
    "cancel response reports the re-evaluated dependent",
    cancelResp.dependentsReevaluated?.some((d: any) => d.flightNumber === "DEP-B"),
    cancelResp,
  );
  check(
    "DEP-B re-evaluated immediately and still scheduled (cancelled dep constraint dropped)",
    q.scheduled.some((f: any) => f.flightNumber === "DEP-B"),
    q,
  );
  await transport.close();
}

async function main() {
  await scenario1();
  await scenario2();
  await scenario3();
  await scenario4Determinism();
  console.log(`\n=== ${pass} passed, ${failCount} failed ===`);
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
