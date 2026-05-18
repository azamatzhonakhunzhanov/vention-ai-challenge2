/**
 * Narrated end-to-end run. Spawns the built server and drives it through a real
 * MCP stdio client, printing the actual tool/resource JSON for each step.
 *   node --import tsx scripts/e2e-demo.ts
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const ENV = {
  ATC_RUNWAY_LENGTHS_M: "3000,2500",
  ATC_GATE_COUNT: "3",
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

let checks = 0;
let fails = 0;
const expect = (label: string, cond: boolean) => {
  checks++;
  if (!cond) fails++;
  console.log(`   ${cond ? "✓" : "✗ FAIL"}  ${label}`);
};
const hr = (t: string) => console.log(`\n${"━".repeat(72)}\n${t}\n${"━".repeat(72)}`);

async function connect() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [new URL("../dist/index.js", import.meta.url).pathname],
    env: { ...process.env, ...ENV } as Record<string, string>,
  });
  const client = new Client({ name: "e2e-demo", version: "1.0.0" });
  await client.connect(transport);
  return { client, transport };
}
const parse = (r: any) => JSON.parse(r.content[0].text);
const call = async (c: Client, name: string, args: any = {}) => {
  const out = await c.callTool({ name, arguments: args }).then(parse);
  console.log(`\n→ ${name}(${JSON.stringify(args)})`);
  console.log(JSON.stringify(out, null, 2));
  return out;
};
const read = async (c: Client, uri: string) => {
  const out = await c.readResource({ uri } as any).then((r: any) => JSON.parse(r.contents[0].text));
  console.log(`\n📄 resource ${uri}`);
  console.log(JSON.stringify(out, null, 2));
  return out;
};

async function main() {
  const { client, transport } = await connect();

  hr("HANDSHAKE — tools & resources advertised by the server");
  console.log("tools:    ", (await client.listTools()).tools.map((t) => t.name).join(", "));
  console.log("resources:", (await client.listResources()).resources.map((r) => r.uri).join(", "));

  hr("SCENARIO 1 — Morning Rush (mixed arrivals/departures, priorities)");
  await call(client, "reset_airport");
  await call(client, "submit_flight", { flightNumber: "AR-HI", operation: "arrival", priority: "high" });
  await call(client, "submit_flight", { flightNumber: "DP-MD", operation: "departure", priority: "medium" });
  await call(client, "submit_flight", { flightNumber: "AR-LO", operation: "arrival", priority: "low" });
  await call(client, "submit_flight", { flightNumber: "DP-LO", operation: "departure", priority: "low" });
  const g1 = await call(client, "generate_schedule");
  const q1 = await read(client, "atc://flights/queue");
  const rw1 = await read(client, "atc://runways/usage");
  await read(client, "atc://timeline");
  expect("all 4 flights scheduled", g1.scheduled === 4 && g1.unscheduled === 0);
  expect("nothing left unscheduled in queue", q1.unscheduled.length === 0);
  let overlap = false;
  for (const r of rw1) for (let i = 1; i < r.operations.length; i++) if (r.operations[i].startSec < r.operations[i - 1].endSec) overlap = true;
  expect("no overlapping runway operations", !overlap);
  const tl1 = await read(client, "atc://timeline");
  const s = Object.fromEntries(tl1.map((o: any) => [o.flightNumber, o.startSec]));
  expect("high-priority arrival not later than low-priority arrival", s["AR-HI"] <= s["AR-LO"]);

  hr("SCENARIO 2 — Heavy Hauler (runway capability constraint)");
  await call(client, "reset_airport");
  await call(client, "submit_flight", { flightNumber: "HEAVY-1", operation: "departure", priority: "high", minRunwayLengthM: 6000 });
  await call(client, "submit_flight", { flightNumber: "OK-1", operation: "arrival", priority: "medium" });
  await call(client, "generate_schedule");
  const q2 = await read(client, "atc://flights/queue");
  const st2 = (await call(client, "get_airport_status")).status;
  const heavy = q2.unscheduled.find((f: any) => f.flightNumber === "HEAVY-1");
  expect("oversized HEAVY-1 is unscheduled", !!heavy);
  expect("reason explains no suitable runway", !!heavy && /runway/i.test(heavy.reason));
  expect("valid OK-1 still scheduled", q2.scheduled.some((f: any) => f.flightNumber === "OK-1"));
  expect("status lists HEAVY-1 as blocked", st2.blockedFlights.some((b: any) => b.flightNumber === "HEAVY-1"));

  hr("SCENARIO 3 — Connecting Flight (dependency + buffer + bottleneck)");
  await call(client, "reset_airport");
  await call(client, "submit_flight", { flightNumber: "IN-100", operation: "arrival", priority: "medium" });
  await call(client, "submit_flight", { flightNumber: "OUT-200", operation: "departure", priority: "medium", dependencies: ["IN-100"] });
  await call(client, "generate_schedule");
  const tl3 = await read(client, "atc://timeline");
  const inb = tl3.find((t: any) => t.flightNumber === "IN-100");
  const out = tl3.find((t: any) => t.flightNumber === "OUT-200");
  const chain = await call(client, "analyze_bottleneck");
  expect("both flights scheduled", !!inb && !!out);
  expect("OUT-200 starts >= IN-100 complete + 300s dependency buffer", !!inb && !!out && out.startSec >= inb.completeSec + 300);
  expect("bottleneck chain is IN-100 -> OUT-200", JSON.stringify(chain.chain?.flights) === JSON.stringify(["IN-100", "OUT-200"]));

  hr("DISRUPTION — cancel inbound, dependents re-evaluated immediately");
  const cx = await call(client, "cancel_flight", { flightNumber: "IN-100" });
  const q4 = await read(client, "atc://flights/queue");
  expect("IN-100 cancelled", q4.cancelled.some((f: any) => f.flightNumber === "IN-100"));
  expect("cancel response reports re-evaluated dependent OUT-200", cx.dependentsReevaluated?.some((d: any) => d.flightNumber === "OUT-200"));

  hr("DETERMINISM — regenerate, timeline must be identical");
  const a = JSON.stringify(await call(client, "generate_schedule"));
  const b = JSON.stringify(await call(client, "generate_schedule"));
  expect("two regenerations produce identical output", a === b);

  await transport.close();
  hr(`RESULT: ${checks - fails}/${checks} checks passed, ${fails} failed`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
