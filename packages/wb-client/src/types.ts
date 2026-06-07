export interface WbClientOptions {
  token: string;
  mock?: boolean;
  enableRealApi?: boolean;
  writeDryRun?: boolean;
  requestDelayMs?: number;
}

export type WbExecutionMode = "mock" | "dry_run" | "real_write";

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
  description?: string;
  brand: string;
  category: string;
  price: number;
  discount: number;
  stock: number;
  rating?: number;
  reviewCount?: number;
  chrtIds?: number[];
  attributes?: Record<string, unknown>;
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
  statusCode?: number;
  code?: string;
  details?: unknown;
  retryable?: boolean;
  mode: "mock" | "real";
}

export interface WbNormalizedError {
  statusCode?: number;
  code?: string;
  message: string;
  details?: unknown;
  retryable: boolean;
  mode: "mock" | "real";
}

export interface WbReplyFeedbackResult {
  ok: true;
  mode: WbExecutionMode;
  dryRun: boolean;
  statusCode?: number;
  feedbackId: string;
  response?: {
    statusCode: number;
    message: string;
  };
}
