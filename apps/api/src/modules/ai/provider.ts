import { z } from "zod";
import type { ProductDoctorInput, ProductDoctorOutput, ReviewReplyInput, ReviewReplyOutput, ShopHealthInput, ShopHealthReport } from "@wb/shared";
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
  summary: z.string(),
  risks: z.array(z.string()),
  opportunities: z.array(z.string()),
  recommendedActions: z.array(actionSchema),
  missingData: z.array(z.string()).optional()
});

const reviewReplySchema = z.object({
  reply: z.string().min(2),
  tone: z.string(),
  missingData: z.array(z.string()).optional()
});

const productDoctorSchema = z.object({
  seoScore: z.number().int().min(0).max(100),
  diagnosis: z.array(z.string()),
  suggestions: z.array(z.string()),
  seoTitleRu: z.string().optional(),
  seoBulletsRu: z.array(z.string()).optional(),
  missingData: z.array(z.string()).optional()
});

export class MockAiProvider implements AiProvider {
  async generateShopHealthReport(input: ShopHealthInput): Promise<ShopHealthReport> {
    const lowStockProducts = input.products.slice(0, 2).map((item) => String(item["title"] ?? "SKU"));
    return {
      healthScore: 78,
      summary: "Shop dang on dinh, nhung can uu tien review 3 sao va ton kho thap.",
      risks: [`Ton kho thap o ${lowStockProducts.join(", ")}`, "Can xu ly review duoi 4 sao nhanh hon"],
      opportunities: ["Toi uu mo ta san pham de tang SEO", "Day nhanh draft tra loi review bang tieng Nga"],
      recommendedActions: [
        {
          type: "CREATE_REVIEW_DRAFT",
          title: "Tao draft tra loi review uu tien",
          reason: "Giam tre phan hoi voi review tieu cuc",
          confidence: 0.87,
          requiresApproval: true,
          payload: {}
        },
        {
          type: "UPDATE_STOCK",
          title: "Canh bao bo sung ton kho",
          reason: "Mot so SKU sap het hang",
          confidence: 0.72,
          requiresApproval: true,
          payload: {}
        }
      ],
      missingData: input.competitors.length === 0 ? ["competitors"] : []
    };
  }

  async generateReviewReply(input: ReviewReplyInput): Promise<ReviewReplyOutput> {
    return {
      reply: `Спасибо за ваш отзыв о товаре "${input.productTitle}". Мы учтем замечание и постараемся стать лучше.`,
      tone: "professional-friendly"
    };
  }

  async generateProductDoctor(input: ProductDoctorInput): Promise<ProductDoctorOutput> {
    return {
      seoScore: 74,
      diagnosis: ["Tieu de chua neu ro loi ich chinh", "Thieu mo ta chi tiet chat lieu/kich thuoc"],
      suggestions: ["Bo sung tu khoa theo category", "Them bullet mo ta uu diem su dung"],
      seoTitleRu: "Стильный товар для ежедневного использования",
      seoBulletsRu: ["Уточнить материал и размер", "Добавить выгоду для покупателя"],
      missingData: input.description ? [] : ["description"]
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
        "Bao cao danh cho seller phai bang tieng Viet.",
        "Tra ve JSON hop le, khong markdown, khong giai thich them.",
        "Khong duoc bia so lieu; neu thieu thi ghi vao missingData."
      ].join(" "),
      userPayload: input,
      schema: {
        type: "object",
        properties: {
          healthScore: { type: "integer", minimum: 0, maximum: 100 },
          summary: { type: "string" },
          risks: { type: "array", items: { type: "string" } },
          opportunities: { type: "array", items: { type: "string" } },
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
        required: ["healthScore", "summary", "risks", "opportunities", "recommendedActions"]
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
        "Tra loi cho khach bang tieng Nga.",
        "Tra ve JSON hop le, khong markdown, khong giai thich ben ngoai JSON.",
        "Neu thieu du lieu, ghi vao missingData."
      ].join(" "),
      userPayload: input,
      schema: {
        type: "object",
        properties: {
          reply: { type: "string" },
          tone: { type: "string" },
          missingData: { type: "array", items: { type: "string" } }
        },
        required: ["reply", "tone"]
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
        "Phan tich, chan doan va giai thich bang tieng Viet.",
        "De xuat seoTitleRu va seoBulletsRu bang tieng Nga.",
        "Tra ve JSON hop le, khong markdown, khong chen text ben ngoai JSON.",
        "Khong duoc bia so lieu; neu thieu du lieu, ghi missingData."
      ].join(" "),
      userPayload: input,
      schema: {
        type: "object",
        properties: {
          seoScore: { type: "integer", minimum: 0, maximum: 100 },
          diagnosis: { type: "array", items: { type: "string" } },
          suggestions: { type: "array", items: { type: "string" } },
          seoTitleRu: { type: "string" },
          seoBulletsRu: { type: "array", items: { type: "string" } },
          missingData: { type: "array", items: { type: "string" } }
        },
        required: ["seoScore", "diagnosis", "suggestions"]
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
      throw new Error("Gemini tra ve du lieu khong dung dinh dang JSON mong doi.");
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

      return JSON.parse(match[0]);
    }
  }
}

export function getAiProvider(): AiProvider {
  return env.aiProvider === "gemini" ? new GeminiProvider() : new MockAiProvider();
}
