import cors from "cors";
import express from "express";
import morgan from "morgan";
import { env } from "./config/env";
import { authRouter } from "./modules/auth/routes";
import { shopsRouter } from "./modules/shops/routes";
import { wbRouter } from "./modules/wb/routes";
import { aiRouter } from "./modules/ai/routes";
import { reportsRouter } from "./modules/reports/routes";
import { actionsRouter } from "./modules/reviews/routes";
import { telegramRouter } from "./modules/telegram/routes";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "wb-api" });
});

app.use("/auth", authRouter);
app.use("/shops", shopsRouter);
app.use("/wb", wbRouter);
app.use("/ai", aiRouter);
app.use("/reports", reportsRouter);
app.use("/actions", actionsRouter);
app.use("/telegram", telegramRouter);

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
