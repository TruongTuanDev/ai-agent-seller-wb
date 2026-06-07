import { z } from "zod";
import type {
  ProductDoctorInput,
  ProductDoctorOutput,
  ReviewReplyInput,
  ReviewReplyOutput,
  ShopHealthInput,
  ShopHealthReport
} from "@wb/shared";
import { env } from "../../config/env";

export interface AiProvider {
  generateShopHealthReport(input: ShopHealthInput): Promise<ShopHealthReport>;
  generateReviewReply(input: ReviewReplyInput): Promise<ReviewReplyOutput>;
  generateProductDoctor(input: ProductDoctorInput): Promise<ProductDoctorOutput>;
}

const actionSchema = z.object({
  type: z.enum([
    "CREATE_REVIEW_DRAFT",
    "CREATE_SEO_DRAFT",
    "SEND_TELEGRAM_ALERT",
    "UPDATE_PRICE",
    "UPDATE_STOCK",
    "REPLY_REVIEW",
    "UPDATE_PRODUCT_CONTENT",
    "UPDATE_AD_BID"
  ]),
  title: z.string(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
  requiresApproval: z.boolean(),
  payload: z.record(z.unknown())
});

const shopHealthReportSchema = z.object({
  healthScore: z.number().int().min(0).max(100),
  executiveSummary: z.string().min(20),
  kpiSummary: z.object({
    revenueTrend: z.string(),
    orderTrend: z.string(),
    conversionTrend: z.string(),
    reviewRisk: z.string(),
    inventoryRisk: z.string()
  }),
  criticalIssues: z.array(
    z.object({
      title: z.string(),
      severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      evidence: z.string(),
      recommendation: z.string(),
      relatedSku: z.string().optional()
    })
  ),
  growthOpportunities: z.array(
    z.object({
      title: z.string(),
      expectedImpact: z.string(),
      action: z.string()
    })
  ),
  recommendedActions: z.array(actionSchema),
  missingData: z.array(z.string())
});

const reviewReplySchema = z.object({
  reply: z.string().min(6),
  tone: z.enum(["polite", "friendly", "professional"]),
  detectedSentiment: z.enum(["positive", "neutral", "negative"]),
  missingData: z.array(z.string())
});

const productDoctorSchema = z.object({
  seoScore: z.number().int().min(0).max(100),
  imageScore: z.number().int().min(0).max(100),
  titleScore: z.number().int().min(0).max(100),
  descriptionScore: z.number().int().min(0).max(100),
  attributeCompleteness: z.number().int().min(0).max(100),
  reviewRisk: z.string(),
  returnRisk: z.string(),
  diagnosis: z.array(z.string()),
  suggestions: z.array(z.string()),
  seoTitleRu: z.string(),
  seoDescriptionRu: z.string(),
  seoBulletsRu: z.array(z.string()),
  keywordsRu: z.array(z.string()),
  warnings: z.array(z.string()),
  missingData: z.array(z.string())
});

function formatPercent(value: unknown, fallback: string) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? `${numberValue.toFixed(1)}%` : fallback;
}

function detectReviewSentiment(rating: number) {
  if (rating >= 5) return "positive" as const;
  if (rating <= 3) return "negative" as const;
  return "neutral" as const;
}

export class MockAiProvider implements AiProvider {
  async generateShopHealthReport(input: ShopHealthInput): Promise<ShopHealthReport> {
    const productProblems = input.productProblems ?? [];
    const criticalProducts = productProblems.slice(0, 3);
    const feedbacks = input.feedbacks;
    const negativeReviewCount = feedbacks.filter((item) => Number(item["rating"] ?? 0) <= 3).length;
    const pendingReviewCount = feedbacks.filter((item) => String(item["status"] ?? "NEW") !== "SENT").length;
    const lowStockCount = Number(input.inventory["lowStockCount"] ?? criticalProducts.length);
    const score = Math.max(42, 88 - criticalProducts.length * 8 - Math.min(negativeReviewCount * 2, 16) - Math.min(lowStockCount, 10));

    return {
      healthScore: score,
      executiveSummary:
        criticalProducts.length > 0
          ? `Shop dang co ${criticalProducts.length} SKU can uu tien xu ly ngay, tap trung vao ton kho, review va SEO listing de tranh mat doanh thu.`
          : "Shop dang van hanh kha on, nhung van nen duy tri nhat quan viec tra loi review va toi uu listing de tang chuyen doi.",
      kpiSummary: {
        revenueTrend: `Doanh thu snapshot gan nhat dat ${Number(input.kpis["revenue"] ?? 0).toLocaleString("en-US")} RUB.`,
        orderTrend: `So don hien tai la ${Number(input.kpis["ordersCount"] ?? input.kpis["orders"] ?? 0)} don.`,
        conversionTrend: `Ty le add-to-cart ${formatPercent(input.kpis["addToCartConversion"], "chua co du lieu")} va cart-to-order ${formatPercent(input.kpis["cartToOrderConversion"], "chua co du lieu")}.`,
        reviewRisk: pendingReviewCount > 0 ? `${pendingReviewCount} review chua duoc xu ly, trong do co ${negativeReviewCount} review tieu cuc.` : "Review risk dang thap va khong co ton dong lon.",
        inventoryRisk: lowStockCount > 0 ? `${lowStockCount} SKU dang ton kho thap hoac co nguy co het hang.` : "Ton kho hien chua co canh bao lon."
      },
      criticalIssues: criticalProducts.map((problem) => ({
        title: `${problem.wbNmId} - ${problem.title}`,
        severity: problem.severity,
        evidence: problem.reasons.join("; "),
        recommendation: problem.reasons.some((reason) => reason.includes("review"))
          ? "Tao draft reply, duyet va gui cho review ton dong trong ngay."
          : problem.reasons.some((reason) => reason.includes("Ton kho"))
            ? "Bo sung kho va theo doi toc do ban trong 48 gio toi."
            : "Cap nhat title/mo ta va theo doi bien dong rating.",
        relatedSku: problem.wbNmId
      })),
      growthOpportunities: [
        {
          title: "Tang toc do tra loi review",
          expectedImpact: "Giam review risk va tang tin cay listing",
          action: "Dung AI draft tieng Nga cho review moi roi dua vao approval queue"
        },
        {
          title: "Toi uu title va mo ta",
          expectedImpact: "Tang kha nang tim thay va click vao listing",
          action: "Mo Product Doctor cho nhung SKU co title/mo ta yeu SEO"
        },
        {
          title: "Kich hoat canh bao Telegram hang ngay",
          expectedImpact: "Seller nam duoc canh bao som vao dau ngay",
          action: "Bat Telegram daily alert luc 9h server time"
        }
      ],
      recommendedActions: [
        {
          type: "CREATE_REVIEW_DRAFT",
          title: "Tao draft cho review ton dong",
          reason: "Can rut ngan thoi gian phan hoi review tieu cuc va review chua tra loi",
          confidence: 0.9,
          requiresApproval: true,
          payload: {}
        },
        {
          type: "CREATE_SEO_DRAFT",
          title: "Tao Product Doctor draft cho SKU uu tien",
          reason: "Mot so SKU co dau hieu title/mo ta chua toi uu SEO",
          confidence: 0.84,
          requiresApproval: true,
          payload: { productId: criticalProducts[0]?.productId }
        },
        {
          type: "SEND_TELEGRAM_ALERT",
          title: "Gui daily health summary",
          reason: "Canh bao seller som truoc gio lam viec",
          confidence: 0.75,
          requiresApproval: true,
          payload: {}
        }
      ],
      missingData: [
        ...(input.competitors.length === 0 ? ["competitors"] : []),
        ...(productProblems.some((problem) => problem.reasons.some((reason) => reason.includes("SEO"))) ? ["full_product_description"] : [])
      ]
    };
  }

  async generateReviewReply(input: ReviewReplyInput): Promise<ReviewReplyOutput> {
    const tone = input.tone ?? "professional";
    const sentiment = detectReviewSentiment(input.rating);
    const reply =
      sentiment === "negative"
        ? "Здравствуйте! Спасибо за отзыв. Нам жаль, что товар не полностью оправдал ваши ожидания. Мы уже передали замечание команде и будем рады помочь вам через чат магазина."
        : sentiment === "positive"
          ? "Спасибо за ваш отзыв! Очень рады, что товар вам понравился. Будем ждать вас снова."
          : "Спасибо за ваш отзыв! Мы ценим ваше мнение и учтем замечания, чтобы сделать товар еще лучше.";

    return {
      reply,
      tone,
      detectedSentiment: sentiment,
      missingData: []
    };
  }

  async generateProductDoctor(input: ProductDoctorInput): Promise<ProductDoctorOutput> {
    const missingData = input.description ? [] : ["description"];
    const titleScore = Math.max(45, Math.min(92, (input.title.length >= 50 ? 78 : 62) + (input.category ? 8 : 0)));
    const descriptionScore = input.description ? Math.min(88, Math.max(52, Math.floor(input.description.length / 4))) : 34;
    const attributeCompleteness = input.attributes ? 72 : 38;
    const seoScore = Math.round((titleScore + descriptionScore + attributeCompleteness) / 3);

    return {
      seoScore,
      imageScore: 55,
      titleScore,
      descriptionScore,
      attributeCompleteness,
      reviewRisk: (input.rating ?? 5) < 4 ? "Can theo doi sat review tieu cuc va size/material complaints." : "Review risk dang trung binh-thap.",
      returnRisk: "Placeholder: can bo sung du lieu tra hang/ly do return tu WB.",
      diagnosis: [
        "Title chua nhan manh loi ich va tu khoa chinh theo nhu cau tim kiem.",
        input.description ? "Mo ta co the chi tiet hon ve size, chat lieu va tinh huong su dung." : "Chua co mo ta day du de toi uu SEO listing.",
        "Can bo sung canh bao tu review neu co van de ve size, mau hoac chat lieu."
      ],
      suggestions: [
        "Viet lai title theo cau truc: loai san pham + doi tuong + loi ich + chat lieu.",
        "Them 4-6 bullet points ngắn, tap trung vao tinh nang va niem tin mua hang.",
        "Bo sung keyword dong nghia va context su dung bang tieng Nga."
      ],
      seoTitleRu: "Стильный товар для Wildberries: удобный крой, актуальный дизайн, базовый гардероб",
      seoDescriptionRu:
        "Практичный товар на каждый день с акцентом на комфорт, посадку и понятное описание характеристик. Подходит для повседневного использования и легко сочетается с базовым гардеробом.",
      seoBulletsRu: [
        "Уточнить материал и плотность ткани",
        "Добавить информацию о посадке и размере",
        "Подчеркнуть удобство для повседневной носки",
        "Показать ключевую выгоду для покупателя"
      ],
      keywordsRu: ["wildberries", "удобный", "базовый", "повседневный", "качественный"],
      warnings: ["Kiem tra lai size chart va mo ta chat lieu neu review da nhac toi van de nay."],
      missingData
    };
  }
}

export class GeminiProvider implements AiProvider {
  private readonly fallback = new MockAiProvider();

  async generateShopHealthReport(input: ShopHealthInput): Promise<ShopHealthReport> {
    if (!env.geminiApiKey) {
      return this.fallback.generateShopHealthReport(input);
    }

    return this.generateStructuredJson({
      instruction: [
        "Ban la AI Operations Manager cho seller Wildberries.",
        "Bao cao phai viet bang tieng Viet, ro rang, ngắn gon, uu tien tinh hanh dong.",
        "Bat buoc tra ve JSON hop le theo schema.",
        "Health Score la so nguyen 0-100.",
        "criticalIssues va growthOpportunities nen co toi da 3 muc quan trong nhat.",
        "recommendedActions chi de xuat action co gia tri demo va an toan."
      ].join(" "),
      userPayload: input,
      schema: {
        type: "object",
        properties: {
          healthScore: { type: "integer", minimum: 0, maximum: 100 },
          executiveSummary: { type: "string" },
          kpiSummary: {
            type: "object",
            properties: {
              revenueTrend: { type: "string" },
              orderTrend: { type: "string" },
              conversionTrend: { type: "string" },
              reviewRisk: { type: "string" },
              inventoryRisk: { type: "string" }
            },
            required: ["revenueTrend", "orderTrend", "conversionTrend", "reviewRisk", "inventoryRisk"]
          },
          criticalIssues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
                evidence: { type: "string" },
                recommendation: { type: "string" },
                relatedSku: { type: "string" }
              },
              required: ["title", "severity", "evidence", "recommendation"]
            }
          },
          growthOpportunities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                expectedImpact: { type: "string" },
                action: { type: "string" }
              },
              required: ["title", "expectedImpact", "action"]
            }
          },
          recommendedActions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: [
                    "CREATE_REVIEW_DRAFT",
                    "CREATE_SEO_DRAFT",
                    "SEND_TELEGRAM_ALERT",
                    "UPDATE_PRICE",
                    "UPDATE_STOCK",
                    "REPLY_REVIEW",
                    "UPDATE_PRODUCT_CONTENT",
                    "UPDATE_AD_BID"
                  ]
                },
                title: { type: "string" },
                reason: { type: "string" },
                confidence: { type: "number" },
                requiresApproval: { type: "boolean" },
                payload: { type: "object", additionalProperties: true }
              },
              required: ["type", "title", "reason", "confidence", "requiresApproval", "payload"]
            }
          },
          missingData: { type: "array", items: { type: "string" } }
        },
        required: ["healthScore", "executiveSummary", "kpiSummary", "criticalIssues", "growthOpportunities", "recommendedActions", "missingData"]
      },
      validator: shopHealthReportSchema
    });
  }

  async generateReviewReply(input: ReviewReplyInput): Promise<ReviewReplyOutput> {
    if (!env.geminiApiKey) {
      return this.fallback.generateReviewReply(input);
    }

    return this.generateStructuredJson({
      instruction: [
        "Ban la tro ly cham soc khach hang cho seller Wildberries.",
        "Tra loi khach hang bang tieng Nga tu nhien, ngan gon, lich su, khong robot.",
        "Tone chi duoc la polite, friendly hoac professional.",
        "Neu review tieu cuc thi xin loi va de nghi ho tro, khong tu y hua hoan tien neu allowRefundPromise = false.",
        "Neu review tich cuc thi cam on ngan gon.",
        "Chi tra ve JSON hop le."
      ].join(" "),
      userPayload: input,
      schema: {
        type: "object",
        properties: {
          reply: { type: "string" },
          tone: { type: "string", enum: ["polite", "friendly", "professional"] },
          detectedSentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
          missingData: { type: "array", items: { type: "string" } }
        },
        required: ["reply", "tone", "detectedSentiment", "missingData"]
      },
      validator: reviewReplySchema
    });
  }

  async generateProductDoctor(input: ProductDoctorInput): Promise<ProductDoctorOutput> {
    if (!env.geminiApiKey) {
      return this.fallback.generateProductDoctor(input);
    }

    return this.generateStructuredJson({
      instruction: [
        "Ban la Product Doctor cho Wildberries seller.",
        "Chan doan va giai thich bang tieng Viet.",
        "seoTitleRu, seoDescriptionRu, seoBulletsRu va keywordsRu phai bang tieng Nga tu nhien.",
        "Canh bao neu review cho thay van de ve size, mau, chat lieu.",
        "Tra ve JSON hop le va khong chen markdown."
      ].join(" "),
      userPayload: input,
      schema: {
        type: "object",
        properties: {
          seoScore: { type: "integer", minimum: 0, maximum: 100 },
          imageScore: { type: "integer", minimum: 0, maximum: 100 },
          titleScore: { type: "integer", minimum: 0, maximum: 100 },
          descriptionScore: { type: "integer", minimum: 0, maximum: 100 },
          attributeCompleteness: { type: "integer", minimum: 0, maximum: 100 },
          reviewRisk: { type: "string" },
          returnRisk: { type: "string" },
          diagnosis: { type: "array", items: { type: "string" } },
          suggestions: { type: "array", items: { type: "string" } },
          seoTitleRu: { type: "string" },
          seoDescriptionRu: { type: "string" },
          seoBulletsRu: { type: "array", items: { type: "string" } },
          keywordsRu: { type: "array", items: { type: "string" } },
          warnings: { type: "array", items: { type: "string" } },
          missingData: { type: "array", items: { type: "string" } }
        },
        required: [
          "seoScore",
          "imageScore",
          "titleScore",
          "descriptionScore",
          "attributeCompleteness",
          "reviewRisk",
          "returnRisk",
          "diagnosis",
          "suggestions",
          "seoTitleRu",
          "seoDescriptionRu",
          "seoBulletsRu",
          "keywordsRu",
          "warnings",
          "missingData"
        ]
      },
      validator: productDoctorSchema
    });
  }

  private async generateStructuredJson<T>(input: {
    instruction: string;
    userPayload: unknown;
    schema: Record<string, unknown>;
    validator: z.ZodType<T>;
  }): Promise<T> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${input.instruction}\n\nDu lieu dau vao:\n${JSON.stringify(input.userPayload)}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: input.schema
        }
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("Gemini request failed", {
        status: response.status,
        body: payload
      });
      throw new Error("Khong the tao phan tich AI tu Gemini luc nay.");
    }

    const text = this.extractGeminiText(payload);
    const parsed = this.parseJsonSafely(text);
    const validated = input.validator.safeParse(parsed);

    if (!validated.success) {
      console.error("Gemini schema validation failed", {
        issues: validated.error.issues,
        rawText: text
      });
      throw new Error("Gemini tra ve du lieu khong dung schema JSON mong doi.");
    }

    return validated.data;
  }

  private extractGeminiText(payload: unknown) {
    if (!payload || typeof payload !== "object") {
      throw new Error("Gemini khong tra ve payload hop le.");
    }

    const text = (payload as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    }).candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();

    if (!text) {
      throw new Error("Gemini khong tra ve noi dung text de phan tich.");
    }

    return text;
  }

  private parseJsonSafely(text: string) {
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!match) {
        throw new Error("Gemini khong tra ve JSON hop le.");
      }

      try {
        return JSON.parse(match[0]);
      } catch {
        throw new Error("Gemini tra ve text loi, khong parse duoc JSON.");
      }
    }
  }
}

export function getAiProvider(): AiProvider {
  return env.aiProvider === "gemini" ? new GeminiProvider() : new MockAiProvider();
}
