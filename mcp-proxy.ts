/**
 * Thin MCP proxy — finds the OpenConclave installation and loads its MCP server.
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
    process.chdir(dir);
    break;
  }
}

if (!mcpPath) {
  console.error("OpenConclave not found. Install: curl -fsSL https://openconclave.com/install.sh | bash");
  process.exit(1);
}

// Import and run the actual MCP server directly (same process, shared stdio)
await import(mcpPath);
