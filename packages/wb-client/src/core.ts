import type { WbClientOptions, WbRequestError } from "./types";

const DEFAULT_DELAY_MS = 220;

export class WbHttpClient {
  private readonly mode: "mock" | "real";
  private lastRequestAt = 0;

  constructor(private readonly options: WbClientOptions) {
    this.mode = options.mock || !options.enableRealApi ? "mock" : "real";
  }

  getMode() {
    return this.mode;
  }

  async request<T>(input: {
    url: string;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
  }): Promise<T> {
    if (this.mode === "mock") {
      throw this.createError("WB real API is disabled", { code: "WB_MOCK_MODE" });
    }

    const now = Date.now();
    const delayMs = this.options.requestDelayMs ?? DEFAULT_DELAY_MS;
    const waitMs = Math.max(0, this.lastRequestAt + delayMs - now);
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.lastRequestAt = Date.now();

    const url = new URL(input.url);
    Object.entries(input.query ?? {}).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url, {
      method: input.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.options.token}`,
        "Content-Type": "application/json"
      },
      body: input.body === undefined ? undefined : JSON.stringify(input.body)
    });

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
      throw this.createError(
        typeof payload === "string" ? payload : this.extractMessage(payload),
        {
          status: response.status,
          details: payload,
          code: typeof payload === "object" && payload && "code" in payload ? String(payload.code) : undefined
        }
      );
    }

    return payload as T;
  }

  createError(message: string, input: { status?: number; code?: string; details?: unknown } = {}): WbRequestError {
    const error = new Error(message) as WbRequestError;
    error.status = input.status;
    error.code = input.code;
    error.details = input.details;
    error.mode = this.mode;
    return error;
  }

  private extractMessage(payload: unknown) {
    if (typeof payload === "string") return payload;
    if (payload && typeof payload === "object") {
      if ("message" in payload && typeof payload.message === "string") return payload.message;
      if ("errorText" in payload && typeof payload.errorText === "string") return payload.errorText;
      if ("title" in payload && typeof payload.title === "string") return payload.title;
    }
    return "Wildberries API request failed";
  }
}
