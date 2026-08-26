// One-shot stdio MCP handshake probe: initialize → initialized → tools/list,
// prints the tool names, exits 0. Used by CI smoke and local verification.
import { spawn } from "node:child_process";

const proc = spawn(process.execPath, ["dist/index.js"], {
  cwd: process.cwd(),
  stdio: ["pipe", "pipe", "inherit"],
});

let buf = "";
const timer = setTimeout(() => {
  console.error("PROBE_TIMEOUT");
  proc.kill("SIGKILL");
  process.exit(1);
}, 8000);

proc.stdout.on("data", (chunk) => {
  buf += chunk.toString("utf8");
  for (const line of buf.split("\n")) {
    line.trim() && (() => {
      let msg;
      try { msg = JSON.parse(line); } catch { return; }
      if (msg.id === 2 && msg.result?.tools) {
        const names = msg.result.tools.map((t) => t.name).sort();
        console.log(`TOOLS_LISTED: ${names.length}`);
        for (const n of names) console.log(`  ${n}`);
        clearTimeout(timer);
        proc.kill();
        process.exit(0);
      }
    })();
  }
});

const send = (obj) => proc.stdin.write(JSON.stringify(obj) + "\n");
send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "probe", version: "0" } } });
send({ jsonrpc: "2.0", method: "notifications/initialized" });
send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
