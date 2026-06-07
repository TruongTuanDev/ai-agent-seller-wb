import { Router } from "express";
import { prisma } from "../../database/prisma";
import { requireAuth } from "../../common/auth";
import { getAiProvider } from "../ai/provider";
import { analyzeProductProblems, getProductReviewWarnings } from "./service";

export const productsRouter = Router();
const aiProvider = getAiProvider();

productsRouter.use(requireAuth);

productsRouter.get("/:shopId/problems", async (req, res) => {
  const shopId = String(req.params.shopId);
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      products: { orderBy: { updatedAt: "desc" } },
      feedbacks: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!shop) {
    return res.status(404).json({ message: "Shop not found" });
  }

  const problems = analyzeProductProblems(shop.products, shop.feedbacks);
  return res.json({ problems });
});

productsRouter.post("/:productId/doctor", async (req, res) => {
  const productId = String(req.params.productId);
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      feedbacks: { orderBy: { createdAt: "desc" }, take: 12 }
    }
  });

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  const diagnosis = await aiProvider.generateProductDoctor({
    title: product.title,
    description: product.description ?? undefined,
    category: product.category,
    price: product.price,
    stock: product.stock,
    rating: product.rating,
    attributes: (product.attributesJson as Record<string, unknown> | null) ?? undefined,
    reviewSnippets: product.feedbacks.slice(0, 6).map((feedback) => feedback.text)
  });

  return res.json({
    product,
    diagnosis: {
      ...diagnosis,
      warnings: diagnosis.warnings.length > 0 ? diagnosis.warnings : getProductReviewWarnings(product.feedbacks)
    }
  });
});
