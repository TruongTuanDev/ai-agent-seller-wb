import type { WbHttpClient } from "../core";

export class PricesModule {
  constructor(private readonly http: WbHttpClient) {}

  async update(input: { nmId: string; price: number; discount?: number }) {
    if (this.http.getMode() === "mock") {
      return {
        success: true,
        updated: input,
        mode: "mock"
      };
    }

    throw this.http.createError(
      "TODO: real price update endpoint requires approval flow and stricter endpoint validation before enabling writes.",
      { code: "WB_TODO_WRITE_ENDPOINT" }
    );
  }
}
