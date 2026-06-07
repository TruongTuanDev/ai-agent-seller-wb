import type { Feedback, Product } from "@prisma/client";
import type { ProductProblem, TelegramAlertSummary } from "@wb/shared";

const LOW_STOCK_THRESHOLD = 12;

function averagePrice(products: Product[]) {
  if (products.length === 0) {
    return 0;
  }

  return products.reduce((sum, product) => sum + product.price, 0) / products.length;
}

function hasWeakSeoText(product: Product) {
  const title = product.title.trim();
  const description = product.description?.trim() ?? "";
  return title.length < 18 || description.length < 80;
}

function detectReviewWarnings(feedbacks: Feedback[]) {
  const warnings = new Set<string>();
  feedbacks.forEach((feedback) => {
    const text = feedback.text.toLowerCase();
    if (text.includes("size") || text.includes("razmer")) warnings.add("Canh bao size/fit");
    if (text.includes("color") || text.includes("mau") || text.includes("tsvet")) warnings.add("Canh bao mau sac");
    if (text.includes("material") || text.includes("chat lieu") || text.includes("material")) warnings.add("Canh bao chat lieu");
  });
  return Array.from(warnings);
}

export function analyzeProductProblems(products: Product[], feedbacks: Feedback[]): ProductProblem[] {
  const priceBaseline = averagePrice(products);

  return products
    .map<ProductProblem | null>((product) => {
      const productFeedbacks = feedbacks.filter((feedback) => feedback.productId === product.id);
      const unansweredReviews = productFeedbacks.filter((feedback) => feedback.status !== "SENT").length;
      const negativeReviews = productFeedbacks.filter((feedback) => feedback.rating <= 3).length;
      const reasons: string[] = [];

      if (product.rating > 0 && product.rating < 4) {
        reasons.push(`Rating thap (${product.rating.toFixed(1)}/5)`);
      }

      if (negativeReviews >= 2) {
        reasons.push(`${negativeReviews} review tieu cuc chua xu ly`);
      }

      if (product.stock <= LOW_STOCK_THRESHOLD) {
        reasons.push(`Ton kho thap (${product.stock} san pham)`);
      }

      if (priceBaseline > 0 && (product.price > priceBaseline * 1.45 || product.price < priceBaseline * 0.55)) {
        reasons.push("Gia ban lech nhieu so voi mat bang shop");
      }

      if (unansweredReviews >= 2) {
        reasons.push(`${unansweredReviews} review chua reply`);
      }

      if (hasWeakSeoText(product)) {
        reasons.push("Title/mo ta chua toi uu SEO");
      }

      if (reasons.length === 0) {
        return null;
      }

      const severity: ProductProblem["severity"] =
        reasons.length >= 4 || (product.stock <= 5 && negativeReviews >= 1)
          ? "CRITICAL"
          : reasons.length >= 3
            ? "HIGH"
            : reasons.length >= 2
              ? "MEDIUM"
              : "LOW";

      return {
        productId: product.id,
        wbNmId: product.wbNmId,
        title: product.title,
        severity,
        reasons,
        metrics: {
          rating: product.rating,
          reviewCount: product.reviewCount,
          stock: product.stock,
          price: product.price,
          unansweredReviews
        }
      };
    })
    .filter((item): item is ProductProblem => Boolean(item))
    .sort((left, right) => {
      const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return order[right.severity] - order[left.severity];
    });
}

export function formatTelegramSummary(input: {
  healthScore: number;
  topProblems: ProductProblem[];
  pendingReviewCount: number;
  conversionTrend: string;
  growthActions: string[];
}): TelegramAlertSummary {
  const criticalLines = [
    ...input.topProblems.slice(0, 2).map((problem, index) => `${index + 1}. ${problem.wbNmId} - ${problem.reasons[0]}`),
    `${Math.min(3, input.topProblems.length + 1)}. ${input.pendingReviewCount} review chua tra loi`,
    input.conversionTrend ? `${Math.min(3, input.topProblems.length + 2)}. ${input.conversionTrend}` : ""
  ].filter(Boolean).slice(0, 3);

  const suggestedLines = input.growthActions.slice(0, 3);
  const message = [
    `WB Shop Health: ${input.healthScore}/100`,
    "",
    "Van de chinh:",
    ...criticalLines,
    "",
    "Goi y:",
    ...suggestedLines.map((line) => `- ${line}`)
  ].join("\n");

  return {
    healthScore: input.healthScore,
    criticalLines,
    suggestedLines,
    message
  };
}

export function getProductReviewWarnings(feedbacks: Feedback[]) {
  return detectReviewWarnings(feedbacks);
}
