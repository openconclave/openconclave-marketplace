/**
 * Thin MCP proxy — finds the OpenConclave server code and runs it.
 * CWD is NOT changed — .openconclave/ data dir is created in the project folder.
 * Server code lives at ~/.openconclave-app/, data lives where Claude Code runs.
 */
import { resolve } from "path";
import { existsSync } from "fs";

const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
const candidates = [
  process.env.OPENCONCLAVE_DIR,
  resolve(home, ".openconclave-app"),
].filter(Boolean) as string[];

let mcpPath: string | null = null;
for (const dir of candidates) {
  const p = resolve(dir, "packages/server/src/mcp/server.ts");
  if (existsSync(p)) {
    mcpPath = p;
    break;
  }
}

if (!mcpPath) {
  console.error("OpenConclave not found. Install: curl -fsSL https://openconclave.com/install.sh | bash");
  process.exit(1);
}

// Import the MCP server — CWD stays at the project folder
await import(mcpPath);
