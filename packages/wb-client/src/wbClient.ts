import { WbHttpClient } from "./core";
import { AdsModule } from "./modules/ads";
import { AnalyticsModule } from "./modules/analytics";
import { FeedbacksModule } from "./modules/feedbacks";
import { PricesModule } from "./modules/prices";
import { ProductsModule } from "./modules/products";
import { ReportsModule } from "./modules/reports";
import { StocksModule } from "./modules/stocks";
import type { WbClientOptions, WbConnectionCheck, WbNormalizedError, WbSellerInfo } from "./types";

export class WbClient {
  private readonly http: WbHttpClient;

  public readonly products: ProductsModule;
  public readonly prices: PricesModule;
  public readonly stocks: StocksModule;
  public readonly feedbacks: FeedbacksModule;
  public readonly analytics: AnalyticsModule;
  public readonly reports: ReportsModule;
  public readonly ads: AdsModule;

  constructor(private readonly options: WbClientOptions) {
    this.http = new WbHttpClient(options);
    this.products = new ProductsModule(this.http);
    this.prices = new PricesModule(this.http);
    this.stocks = new StocksModule(this.http);
    this.feedbacks = new FeedbacksModule(this.http);
    this.analytics = new AnalyticsModule(this.http);
    this.reports = new ReportsModule(this.http);
    this.ads = new AdsModule(this.http);
  }

  getMode() {
    return this.http.getMode();
  }

  getWriteMode() {
    return this.http.getWriteMode();
  }

  async withRateLimit<T>(handler: () => Promise<T>): Promise<T> {
    try {
      return await handler();
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async getSellerInfo(): Promise<WbSellerInfo> {
    if (this.getMode() === "mock") {
      return {
        name: "Demo Seller",
        sid: "demo-sid",
        tradeMark: "Demo Brand"
      };
    }

    return this.http.request<WbSellerInfo>({
      url: "https://common-api.wildberries.ru/api/v1/seller-info"
    });
  }

  async testConnection(): Promise<WbConnectionCheck> {
    const scopes = ["general"];
    const capabilities = ["seller-info"];
    const errors: string[] = [];
    const seller = await this.getSellerInfo();

    const checks = [
      {
        name: "products",
        run: () => this.products.list()
      },
      {
        name: "stocks",
        run: () => this.stocks.list()
      },
      {
        name: "feedbacks",
        run: () => this.feedbacks.list()
      },
      {
        name: "analytics",
        run: () => this.analytics.salesFunnel()
      }
    ];

    for (const check of checks) {
      try {
        await check.run();
        scopes.push(check.name);
        capabilities.push(check.name);
      } catch (error) {
        const normalized = this.normalizeError(error);
        errors.push(`${check.name}: ${normalized.message}`);
      }
    }

    return {
      seller,
      scopes,
      capabilities,
      errors
    };
  }

  normalizeError(error: unknown): WbNormalizedError {
    if (error instanceof Error) {
      return {
        statusCode: "statusCode" in error
          ? (error as { statusCode?: number }).statusCode
          : "status" in error
            ? (error as { status?: number }).status
            : undefined,
        code: "code" in error ? (error as { code?: string }).code : undefined,
        message: error.message,
        details: "details" in error ? (error as { details?: unknown }).details : undefined,
        retryable: "retryable" in error ? Boolean((error as { retryable?: boolean }).retryable) : false,
        mode: this.getMode(),
      };
    }

    return {
      statusCode: undefined,
      code: "WB_UNKNOWN_ERROR",
      message: "Unknown Wildberries client error",
      details: error,
      retryable: false,
      mode: this.getMode()
    };
  }
}
