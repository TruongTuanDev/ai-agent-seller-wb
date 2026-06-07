import cors from "cors";
import express from "express";
import morgan from "morgan";
import net from "node:net";
import { env } from "./config/env";
import { prisma } from "./database/prisma";
import { authRouter } from "./modules/auth/routes";
import { shopsRouter } from "./modules/shops/routes";
import { wbRouter } from "./modules/wb/routes";
import { aiRouter } from "./modules/ai/routes";
import { reportsRouter } from "./modules/reports/routes";
import { actionsRouter } from "./modules/reviews/routes";
import { telegramRouter } from "./modules/telegram/routes";
import { productsRouter } from "./modules/products/routes";
import { adminRouter } from "./modules/admin/routes";
import { copilotRouter } from "./modules/copilot/routes";
import { startTelegramDailyAlertJob } from "./modules/telegram/service";

const app = express();

async function checkRedisReachable(redisUrl: string) {
  if (!redisUrl) {
    return { ok: true, skipped: true };
  }

  const target = new URL(redisUrl);
  const port = Number(target.port || 6379);
  const host = target.hostname;

  return new Promise<{ ok: boolean; skipped?: boolean; error?: string }>((resolve) => {
    const socket = net.createConnection({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: "Redis timeout" });
    }, 1500);

    socket.on("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve({ ok: true });
    });

    socket.on("error", (error) => {
      clearTimeout(timeout);
      resolve({ ok: false, error: error.message });
    });
  });
}

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "wb-api" });
});

app.get("/ready", async (_req, res) => {
  const checks = {
    db: false,
    redis: false,
    config: false
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = true;
  } catch {
    checks.db = false;
  }

  const redisResult = await checkRedisReachable(env.redisUrl);
  checks.redis = redisResult.ok;

  checks.config = Boolean(env.databaseUrl && env.jwtSecret && env.encryptionKey);

  const ok = checks.db && checks.config && (env.redisUrl ? checks.redis : true);

  return res.status(ok ? 200 : 503).json({
    ok,
    service: "wb-api",
    checks,
    environment: env.nodeEnv,
    redisSkipped: !env.redisUrl
  });
});

app.use("/auth", authRouter);
app.use("/shops", shopsRouter);
app.use("/wb", wbRouter);
app.use("/ai", aiRouter);
app.use("/reports", reportsRouter);
app.use("/actions", actionsRouter);
app.use("/telegram", telegramRouter);
app.use("/products", productsRouter);
app.use("/admin", adminRouter);
app.use("/copilot", copilotRouter);

startTelegramDailyAlertJob();

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
