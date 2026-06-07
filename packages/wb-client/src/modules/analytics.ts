import type { WbHttpClient } from "../core";
import type { WbSalesFunnelMetrics } from "../types";

export class AnalyticsModule {
  constructor(private readonly http: WbHttpClient) {}

  async salesFunnel(input?: { nmIds?: number[] }): Promise<WbSalesFunnelMetrics> {
    if (this.http.getMode() === "mock") {
      return {
        impressions: 12000,
        clicks: 2100,
        addToCart: 310,
        orders: 92,
        addToCartConversion: 14.76,
        cartToOrderConversion: 29.68
      };
    }

    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const pastStart = new Date(today);
    pastStart.setDate(today.getDate() - 60);
    const pastEnd = new Date(today);
    pastEnd.setDate(today.getDate() - 30);

    const payload = await this.http.request<{
      data?: {
        products?: Array<Record<string, unknown>>;
      };
    }>({
      url: "https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products",
      method: "POST",
      body: {
        selectedPeriod: {
          start: thirtyDaysAgo.toISOString().slice(0, 10),
          end: today.toISOString().slice(0, 10)
        },
        pastPeriod: {
          start: pastStart.toISOString().slice(0, 10),
          end: pastEnd.toISOString().slice(0, 10)
        },
        nmIds: input?.nmIds ?? [],
        subjectIds: [],
        brandNames: [],
        tagIds: [],
        skipDeletedNm: true,
        limit: 50,
        offset: 0
      }
    });

    const totals = (payload.data?.products ?? []).reduce<{
      impressions: number;
      clicks: number;
      addToCart: number;
      orders: number;
      buyouts: number;
    }>(
      (accumulator, row) => {
        const current = (row.currentPeriod as Record<string, unknown> | undefined) ?? {};
        accumulator.impressions += Number(current.openCardCount ?? current.openCount ?? 0);
        accumulator.clicks += Number(current.openCardCount ?? current.openCount ?? 0);
        accumulator.addToCart += Number(current.addToCartCount ?? 0);
        accumulator.orders += Number(current.ordersCount ?? 0);
        accumulator.buyouts += Number(current.buyoutsCount ?? 0);
        return accumulator;
      },
      { impressions: 0, clicks: 0, addToCart: 0, orders: 0, buyouts: 0 }
    );

    const addToCartConversion = totals.clicks > 0 ? Number(((totals.addToCart / totals.clicks) * 100).toFixed(2)) : 0;
    const cartToOrderConversion = totals.addToCart > 0 ? Number(((totals.orders / totals.addToCart) * 100).toFixed(2)) : 0;

    return {
      impressions: totals.impressions,
      clicks: totals.clicks,
      addToCart: totals.addToCart,
      orders: totals.orders,
      buyouts: totals.buyouts,
      addToCartConversion,
      cartToOrderConversion
    };
  }
}
