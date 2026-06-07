import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env");
dotenv.config({ path: envPath });

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "change-me",
  encryptionKey: process.env.ENCRYPTION_KEY ?? "32-byte-demo-key-change-me-now!!!",
  aiProvider: process.env.AI_PROVIDER ?? "mock",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  enableRealWbApi: process.env.ENABLE_REAL_WB_API === "true",
  wbApiBaseUrl: process.env.WB_API_BASE_URL ?? "https://common-api.wildberries.ru"
};
