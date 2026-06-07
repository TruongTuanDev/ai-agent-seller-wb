const { rmSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const { join } = require("node:path");

const appDir = process.cwd();
const nextDir = join(appDir, ".next");
const maxAttempts = 3;

function clean() {
  rmSync(nextDir, { recursive: true, force: true });
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  clean();
  const result = spawnSync("next", ["build"], {
    cwd: appDir,
    shell: true,
    stdio: "inherit"
  });

  if (result.status === 0) {
    process.exit(0);
  }

  if (attempt === maxAttempts) {
    process.exit(result.status ?? 1);
  }
}
