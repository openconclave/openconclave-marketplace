import { resolve } from "path";
import { existsSync } from "fs";
import { spawn } from "bun";

const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
const candidates = [
  process.env.OPENCONCLAVE_DIR,
  resolve(home, ".openconclave-app"),
].filter(Boolean) as string[];

let ocDir: string | null = null;
for (const dir of candidates) {
  const p = resolve(dir, "packages/server/src/mcp/run-server.ts");
  if (existsSync(p)) {
    ocDir = dir;
    break;
  }
}

if (!ocDir) {
  console.error("OpenConclave not found. Install: curl -fsSL https://openconclave.com/install.sh | bash");
  process.exit(1);
}

const mcpScript = resolve(ocDir, "packages/server/src/mcp/run-server.ts");
const proc = spawn({
  cmd: ["bun", "run", mcpScript],
  cwd: ocDir,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

const code = await proc.exited;
process.exit(code);
