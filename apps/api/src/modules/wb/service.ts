import { FeedbackStatus, Prisma } from "@prisma/client";
import { WbClient, type WbFeedback, type WbProduct, type WbStock } from "@wb/wb-client";
import { prisma } from "../../database/prisma";

export async function persistProducts(shopId: string, products: WbProduct[], stocks: WbStock[]) {
  await prisma.product.deleteMany({ where: { shopId } });

  const stockByNmId = new Map<string, number>();
  stocks.forEach((stock) => {
    if (stock.nmId) {
      stockByNmId.set(stock.nmId, (stockByNmId.get(stock.nmId) ?? 0) + stock.amount);
    }
  });

  if (products.length === 0) {
    return [];
  }

  await prisma.product.createMany({
    data: products.map((product, index) => ({
      shopId,
      wbNmId: product.nmId,
      vendorCode: product.vendorCode || `WB-${product.nmId}`,
      barcode: product.chrtIds?.[0] ? String(product.chrtIds[0]) : `barcode-${product.nmId}-${index}`,
      title: product.title,
      description: product.description,
      brand: product.brand,
      category: product.category,
      price: product.price,
      discount: product.discount,
      stock: stockByNmId.get(product.nmId) ?? product.stock,
      rating: product.rating ?? 0,
      reviewCount: product.reviewCount ?? 0,
      attributesJson: product.attributes
        ? (product.attributes as Prisma.InputJsonValue)
        : Prisma.JsonNull
    }))
  });

  return prisma.product.findMany({ where: { shopId }, orderBy: { createdAt: "asc" } });
}

export async function persistFeedbacks(shopId: string, feedbacks: WbFeedback[]) {
  const products = await prisma.product.findMany({ where: { shopId } });
  const productByNmId = new Map(products.map((product) => [product.wbNmId, product.id]));

  await prisma.feedback.deleteMany({ where: { shopId } });

  if (feedbacks.length === 0) {
    return [];
  }

  await prisma.feedback.createMany({
    data: feedbacks.map((feedback) => ({
      shopId,
      wbFeedbackId: feedback.id,
      productId: productByNmId.get(feedback.productNmId),
      rating: feedback.rating,
      text: feedback.text,
      status: feedback.answered ? FeedbackStatus.REPLIED : FeedbackStatus.NEW,
      createdAt: feedback.createdAt ? new Date(feedback.createdAt) : new Date()
    }))
  });

  return prisma.feedback.findMany({ where: { shopId }, orderBy: { createdAt: "desc" } });
}

export async function persistAnalyticsSnapshot(shopId: string, metrics: Record<string, unknown>) {
  const revenue = Number(metrics.revenue ?? 0);
  const ordersCount = Number(metrics.orders ?? 0);
  const addToCartConversion = Number(metrics.addToCartConversion ?? 0);
  const cartToOrderConversion = Number(metrics.cartToOrderConversion ?? 0);
  const buyoutPercent = Number(metrics.buyoutPercent ?? metrics.cartToOrderConversion ?? 0);

  return prisma.shopSnapshot.create({
    data: {
      shopId,
      date: new Date(),
      revenue,
      ordersCount,
      addToCartConversion,
      cartToOrderConversion,
      buyoutPercent,
      rawJson: metrics as Prisma.InputJsonValue
    }
  });
}

export async function syncShopData(shopId: string, client: WbClient) {
  const products = await client.withRateLimit(() => client.products.list());
  const stocks = await client.withRateLimit(() => client.stocks.list());
  const feedbacks = await client.withRateLimit(() => client.feedbacks.list());
  const analytics = await client.withRateLimit(() => client.analytics.salesFunnel());

  const savedProducts = await persistProducts(shopId, products, stocks);
  const savedFeedbacks = await persistFeedbacks(shopId, feedbacks);
  const snapshot = await persistAnalyticsSnapshot(shopId, analytics as unknown as Record<string, unknown>);

  return {
    products: savedProducts,
    feedbacks: savedFeedbacks,
    analytics: snapshot
  };
}
