import type { WbHttpClient } from "../core";

export class AdsModule {
  constructor(private readonly http: WbHttpClient) {}

  async campaigns() {
    if (this.http.getMode() === "mock") {
      return [{ id: "ads-1", name: "Demo Search Campaign", status: "paused" }];
    }

    throw this.http.createError(
      "TODO: ads endpoints stay mocked in this phase.",
      { code: "WB_TODO_ADS" }
    );
  }
}
