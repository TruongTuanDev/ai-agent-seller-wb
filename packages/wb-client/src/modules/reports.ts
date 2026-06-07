import type { WbHttpClient } from "../core";

export class ReportsModule {
  constructor(private readonly http: WbHttpClient) {}

  async finance() {
    if (this.http.getMode() === "mock") {
      return {
        revenue: 185000,
        payout: 141000,
        returns: 7,
        currency: "RUB"
      };
    }

    throw this.http.createError(
      "TODO: finance reports remain mock-first in this phase while read-only analytics and products are prioritized.",
      { code: "WB_TODO_REPORTS" }
    );
  }
}
