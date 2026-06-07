export type ExtensionMessage =
  | { type: "SET_TOKEN"; token: string }
  | { type: "GET_TOKEN" }
  | { type: "OPEN_SIDE_PANEL" }
  | { type: "LOGIN"; email: string; password: string }
  | { type: "ANALYZE_SHOP"; shopId: string }
  | { type: "REVIEW_REPLY"; shopId: string }
  | { type: "PRODUCT_DOCTOR"; shopId: string };
