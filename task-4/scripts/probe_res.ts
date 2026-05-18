import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const t = new StdioClientTransport({
  command: process.execPath,
  args: [new URL("../dist/index.js", import.meta.url).pathname],
  env: { ...process.env, ATC_RUNWAY_COUNT: "2", ATC_GATE_COUNT: "2", ATC_GROUND_CREW_COUNT: "1" } as Record<string, string>,
});
const c = new Client({ name: "p", version: "1.0.0" });
await c.connect(t);
for (const uri of ["atc://flights/queue", "atc://runways/usage", "atc://timeline"]) {
  const r: any = await c.readResource({ uri });
  console.log(uri, "=> returned uri:", r.contents[0].uri, ":: text:", r.contents[0].text.slice(0, 140));
}
await t.close();
