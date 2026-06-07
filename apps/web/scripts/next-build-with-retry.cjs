const { existsSync, rmSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const { join } = require("node:path");

const appDir = process.cwd();
const nextDir = join(appDir, ".next");
const maxAttempts = 3;

function clean() {
  if (!existsSync(nextDir)) {
    return;
  }

  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      rmSync(nextDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
      return;
    } catch (error) {
      lastError = error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
    }
  }

  if (lastError) {
    if (lastError.code === "EPERM" && String(lastError.path ?? "").includes(`${nextDir}\\trace`)) {
      console.warn("Skipping hard clean for .next/trace because Windows is still holding a lock; continuing with retry build.");
      return;
    }
    throw lastError;
  }
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
