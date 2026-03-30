/**
 * SessionStart hook — starts OpenConclave server if not already running.
 * Browser is opened by the server itself (start.ts), not by this hook.
 */
import { resolve } from "path";
import { existsSync } from "fs";
import { spawn } from "bun";

const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
const ocDir = process.env.OPENCONCLAVE_DIR ?? resolve(home, ".openconclave-app");
const port = process.env.OPENCONCLAVE_PORT ?? "4000";

// Check if server is already running
try {
  const res = await fetch(`http://localhost:${port}/api/health`);
  if (res.ok) {
    console.log(`OpenConclave running on port ${port}`);
    process.exit(0);
  }
} catch {}

// Check if OpenConclave is installed
if (!existsSync(resolve(ocDir, "packages/server/src/index.ts"))) {
  console.log("OpenConclave not installed. Run: curl -fsSL https://openconclave.com/install.sh | bash");
  process.exit(0);
}

// Start server in background (detached so it survives hook exit)
const server = spawn({
  cmd: ["bun", "start"],
  cwd: ocDir,
  stdout: "ignore",
  stderr: "ignore",
  stdin: "ignore",
  detached: true,
});
server.unref();

// Wait for server to be ready
for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch(`http://localhost:${port}/api/health`);
    if (res.ok) {
      console.log(`OpenConclave started on port ${port}`);
      process.exit(0);
    }
  } catch {}
  await Bun.sleep(500);
}

console.log("OpenConclave server failed to start");
