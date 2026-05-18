#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ConfigError, loadConfig } from "./config.js";
import { AirportStore } from "./store.js";

function main() {
  let store: AirportStore;
  try {
    const cfg = loadConfig();
    store = new AirportStore(cfg);
  } catch (err) {
    const msg = err instanceof ConfigError ? err.message : String(err);
    process.stderr.write(`[atc-mcp] Invalid configuration: ${msg}\n`);
    process.exit(1);
  }

  const server = new McpServer({ name: "atc-mcp-server", version: "1.0.0" });

  const json = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  });
  const fail = (message: string) => ({
    content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: message }, null, 2) }],
    isError: true,
  });

  // ---- Tools ----

  server.registerTool(
    "submit_flight",
    {
      title: "Submit a flight",
      description:
        "Submit a new arrival or departure flight plan into the airport queue. Supports priority, dependencies on other flights, and an optional minimum runway length requirement.",
      inputSchema: {
        flightNumber: z.string().min(1).describe("Unique flight identifier, e.g. BA123"),
        operation: z.enum(["arrival", "departure"]),
        priority: z.enum(["high", "medium", "low"]).optional().describe("Defaults to medium"),
        dependencies: z
          .array(z.string())
          .optional()
          .describe("Flight numbers that must complete before this flight may start"),
        minRunwayLengthM: z
          .number()
          .positive()
          .optional()
          .describe("Minimum usable runway length in metres required by this aircraft"),
      },
    },
    async (args) => {
      try {
        const f = store.submit(args);
        return json({ ok: true, flight: f });
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.registerTool(
    "generate_schedule",
    {
      title: "Generate / refresh schedule",
      description:
        "Replace the current schedule with a freshly computed one based on the current flight queue and airport configuration. Deterministic for identical inputs.",
      inputSchema: {},
    },
    async () => {
      const summary = store.generateSchedule();
      return json({ ok: true, ...summary, timeline: store.timelineResource() });
    },
  );

  server.registerTool(
    "get_airport_status",
    {
      title: "Get airport status",
      description:
        "Structured operational status: flight counts by state and operation, runway/gate capacity and usage, resource constraint indicators, blocked flights with reasons, and schedule completion time.",
      inputSchema: {},
    },
    async () => json({ ok: true, status: store.status() }),
  );

  server.registerTool(
    "cancel_flight",
    {
      title: "Cancel a flight",
      description:
        "Cancel a flight and mark it cancelled. The schedule is immediately re-evaluated so affected dependent flights are updated. Deterministic.",
      inputSchema: { flightNumber: z.string().min(1) },
    },
    async ({ flightNumber }) => {
      try {
        const f = store.cancel(flightNumber);
        const dependentNumbers = store
          .list()
          .filter((x) => x.dependencies.includes(flightNumber))
          .map((x) => x.flightNumber);
        const summary = store.generateSchedule();
        const dependents = dependentNumbers.map((n) => {
          const d = store.get(n)!;
          return { flightNumber: d.flightNumber, state: d.state, reason: d.reason };
        });
        return json({ ok: true, flight: store.get(flightNumber), schedule: summary, dependentsReevaluated: dependents });
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.registerTool(
    "analyze_bottleneck",
    {
      title: "Bottleneck analysis",
      description:
        "Identify the longest active scheduled dependency chain (critical path) that drives total schedule duration, with the ordered flights and total elapsed duration.",
      inputSchema: {},
    },
    async () => {
      const chain = store.bottleneck();
      if (!chain) {
        return json({ ok: true, chain: null, message: "No multi-flight scheduled dependency chain exists." });
      }
      return json({ ok: true, chain });
    },
  );

  server.registerTool(
    "reset_airport",
    {
      title: "Reset airport state",
      description: "Clear all flights and schedule state. Useful to start validation scenarios from a clean state.",
      inputSchema: {},
    },
    async () => {
      store.reset();
      return json({ ok: true, message: "Airport state cleared." });
    },
  );

  // ---- Resources ----

  server.registerResource(
    "flight-queue",
    "atc://flights/queue",
    {
      title: "Flight queue",
      description: "All flights grouped by state: scheduled, queued, unscheduled, cancelled.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(store.queueResource(), null, 2) }],
    }),
  );

  server.registerResource(
    "runway-usage",
    "atc://runways/usage",
    {
      title: "Runway availability and usage",
      description: "Per-runway length and the chronological list of scheduled runway operations.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        { uri: uri.href, mimeType: "application/json", text: JSON.stringify(store.runwayResource(), null, 2) },
      ],
    }),
  );

  server.registerResource(
    "operation-timeline",
    "atc://timeline",
    {
      title: "Operation timeline",
      description: "Chronological timeline of all scheduled airport operations with runway, gate and dependency info.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        { uri: uri.href, mimeType: "application/json", text: JSON.stringify(store.timelineResource(), null, 2) },
      ],
    }),
  );

  const transport = new StdioServerTransport();
  server.connect(transport).then(
    () => process.stderr.write("[atc-mcp] server ready on stdio\n"),
    (err) => {
      process.stderr.write(`[atc-mcp] failed to start: ${String(err)}\n`);
      process.exit(1);
    },
  );
}

main();
