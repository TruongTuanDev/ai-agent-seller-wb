import type { WbHttpClient } from "../core";
import type { WbProduct } from "../types";

const MOCK_PRODUCTS: WbProduct[] = [
  {
    nmId: "100001",
    vendorCode: "WB-DEMO-001",
    title: "Куртка демо",
    brand: "Demo Brand",
    category: "Outerwear",
    price: 2490,
    discount: 10,
    stock: 32,
    rating: 4.5,
    reviewCount: 18,
    chrtIds: [500001]
  },
  {
    nmId: "100002",
    vendorCode: "WB-DEMO-002",
    title: "Футболка демо",
    brand: "Demo Brand",
    category: "T-Shirts",
    price: 990,
    discount: 5,
    stock: 85,
    rating: 4.8,
    reviewCount: 42,
    chrtIds: [500002]
  }
];

export class ProductsModule {
  constructor(private readonly http: WbHttpClient) {}

  async list(): Promise<WbProduct[]> {
    if (this.http.getMode() === "mock") {
      return MOCK_PRODUCTS;
    }

    const payload = await this.http.request<{
      cards?: Array<{
        nmID?: number;
        vendorCode?: string;
        title?: string;
        subjectName?: string;
        brand?: string;
        sizes?: Array<{ chrtID?: number }>;
      }>;
    }>({
      url: "https://content-api.wildberries.ru/content/v2/get/cards/list",
      method: "POST",
      body: {
        settings: {
          sort: { ascending: false },
          filter: { withPhoto: -1 },
          cursor: { limit: 100 }
        }
      }
    });

    return (payload.cards ?? []).map((card) => ({
      nmId: String(card.nmID ?? ""),
      vendorCode: card.vendorCode ?? "",
      title: card.title ?? "",
      brand: card.brand ?? "",
      category: card.subjectName ?? "",
      price: 0,
      discount: 0,
      stock: 0,
      chrtIds: (card.sizes ?? []).map((size) => Number(size.chrtID ?? 0)).filter(Boolean)
    }));
  }
}
