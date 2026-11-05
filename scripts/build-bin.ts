// Compile the tine CLI (with the DAW, tutorial, player and language server
// embedded) into standalone executables. No runtime needed on the target.
import { $ } from "bun";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const out = join(root, "dist/bin");
mkdirSync(out, { recursive: true });
const targets = (process.argv[2] ?? "linux-x64,linux-arm64,darwin-x64,darwin-arm64,windows-x64").split(",");
for (const t of targets) {
  const file = join(out, `tine-${t}${t.startsWith("windows") ? ".exe" : ""}`);
  await $`bun build ${join(root, "src/cli/main.ts")} --compile --minify --target=bun-${t} --outfile ${file}`.quiet();
  console.log(`built ${file}`);
}
