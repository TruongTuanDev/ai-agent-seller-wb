export interface WbClientOptions {
  token: string;
  mock?: boolean;
  enableRealApi?: boolean;
  requestDelayMs?: number;
}

export interface WbSellerInfo {
  name?: string;
  sid?: string;
  tin?: string;
  tradeMark?: string;
}

export interface WbWarehouse {
  id: number;
  name: string;
  officeId?: number;
}

export interface WbProduct {
  nmId: string;
  vendorCode: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  discount: number;
  stock: number;
  rating?: number;
  reviewCount?: number;
  chrtIds?: number[];
}

export interface WbStock {
  warehouseId: number;
  warehouseName?: string;
  chrtId: number;
  nmId?: string;
  amount: number;
  barcode?: string;
}

export interface WbFeedback {
  id: string;
  productNmId: string;
  rating: number;
  text: string;
  createdAt?: string;
  answered?: boolean;
  productValuation?: number;
}

export interface WbSalesFunnelMetrics {
  impressions: number;
  clicks: number;
  addToCart: number;
  orders: number;
  addToCartConversion: number;
  cartToOrderConversion: number;
  buyouts?: number;
  cancelSumRub?: number;
}

export interface WbConnectionCheck {
  seller: WbSellerInfo;
  scopes: string[];
  capabilities: string[];
  errors: string[];
}

export interface WbRequestError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
  mode: "mock" | "real";
}
