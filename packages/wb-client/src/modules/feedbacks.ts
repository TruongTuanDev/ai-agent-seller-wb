import type { WbHttpClient } from "../core";
import type { WbFeedback } from "../types";

const MOCK_FEEDBACKS: WbFeedback[] = [
  {
    id: "fb-1",
    productNmId: "100001",
    rating: 3,
    text: "Размер немного меньше, чем ожидала.",
    answered: false
  },
  {
    id: "fb-2",
    productNmId: "100002",
    rating: 5,
    text: "Очень быстрая доставка, спасибо.",
    answered: true
  }
];

export class FeedbacksModule {
  constructor(private readonly http: WbHttpClient) {}

  async list(): Promise<WbFeedback[]> {
    if (this.http.getMode() === "mock") {
      return MOCK_FEEDBACKS;
    }

    const unanswered = await this.http.request<{ data?: { feedbacks?: Array<Record<string, unknown>> } }>({
      url: "https://feedbacks-api.wildberries.ru/api/v1/feedbacks",
      query: {
        isAnswered: false,
        take: 100,
        skip: 0,
        order: "dateDesc"
      }
    });

    const answered = await this.http.request<{ data?: { feedbacks?: Array<Record<string, unknown>> } }>({
      url: "https://feedbacks-api.wildberries.ru/api/v1/feedbacks",
      query: {
        isAnswered: true,
        take: 100,
        skip: 0,
        order: "dateDesc"
      }
    });

    return [...(unanswered.data?.feedbacks ?? []), ...(answered.data?.feedbacks ?? [])].map((item) => ({
      id: String(item.id ?? item.feedbackId ?? ""),
      productNmId: String(item.nmId ?? ""),
      rating: Number(item.productValuation ?? item.valuation ?? 0),
      text: String(item.text ?? ""),
      createdAt: typeof item.createdDate === "string" ? item.createdDate : undefined,
      answered: typeof item.answer === "string" ? item.answer.length > 0 : Boolean(item.answer)
    }));
  }

  async reply(input: { feedbackId: string; text: string }) {
    if (this.http.getMode() === "mock") {
      return {
        success: true,
        reply: input,
        mode: "mock"
      };
    }

    throw this.http.createError(
      "TODO: real feedback reply stays disabled until execution flow is fully approved and audited end-to-end.",
      { code: "WB_TODO_WRITE_ENDPOINT" }
    );
  }
}
