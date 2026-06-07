import type { WbHttpClient } from "../core";
import type { WbStock, WbWarehouse } from "../types";

const MOCK_STOCKS: WbStock[] = [
  { warehouseId: 1, warehouseName: "Moscow", chrtId: 500001, nmId: "100001", amount: 32, barcode: "460000000001" },
  { warehouseId: 1, warehouseName: "Moscow", chrtId: 500002, nmId: "100002", amount: 85, barcode: "460000000002" }
];

export class StocksModule {
  constructor(private readonly http: WbHttpClient) {}

  async list(): Promise<WbStock[]> {
    if (this.http.getMode() === "mock") {
      return MOCK_STOCKS;
    }

    const warehouses = await this.http.request<Array<{ id: number; name: string; officeId?: number }>>({
      url: "https://marketplace-api.wildberries.ru/api/v3/warehouses"
    });

    const normalizedWarehouses: WbWarehouse[] = warehouses.map((warehouse) => ({
      id: warehouse.id,
      name: warehouse.name,
      officeId: warehouse.officeId
    }));

    const results = await Promise.all(
      normalizedWarehouses.map(async (warehouse) => {
        try {
          const response = await this.http.request<{ stocks?: Array<{ chrtId: number; amount: number; barcode?: string }> }>({
            url: `https://marketplace-api.wildberries.ru/api/v3/stocks/${warehouse.id}`,
            method: "POST",
            body: { chrtIds: [] }
          });

          return (response.stocks ?? []).map((stock) => ({
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            chrtId: stock.chrtId,
            amount: stock.amount,
            barcode: stock.barcode
          }));
        } catch {
          return [];
        }
      })
    );

    return results.flat();
  }

  async update(input: { warehouseId: number; chrtId: number; amount: number }) {
    if (this.http.getMode() === "mock") {
      return {
        success: true,
        updated: input,
        mode: "mock"
      };
    }

    throw this.http.createError(
      "TODO: real stock update endpoint remains gated behind approval and manual confirmation.",
      { code: "WB_TODO_WRITE_ENDPOINT" }
    );
  }
}
