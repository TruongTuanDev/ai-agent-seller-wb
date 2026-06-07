import type { WbHttpClient } from "../core";
import type { WbFeedback, WbReplyFeedbackResult } from "../types";

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

  async reply(input: { feedbackId: string; text: string }): Promise<WbReplyFeedbackResult> {
    if (this.http.getWriteMode() === "mock") {
      return {
        ok: true,
        mode: "mock",
        dryRun: false,
        feedbackId: input.feedbackId,
        response: {
          statusCode: 200,
          message: "Mock feedback reply completed."
        }
      };
    }

    if (this.http.getWriteMode() === "dry_run") {
      return {
        ok: true,
        mode: "dry_run",
        dryRun: true,
        feedbackId: input.feedbackId,
        response: {
          statusCode: 200,
          message: "Dry-run skipped real Wildberries feedback reply."
        }
      };
    }

    const startedAt = Date.now();
    const endpoint = "https://feedbacks-api.wildberries.ru/api/v1/feedbacks/answer";
    let attempt = 0;

    while (attempt < 3) {
      attempt += 1;
      try {
        await this.http.request<string>({
          url: endpoint,
          method: "POST",
          body: {
            id: input.feedbackId,
            text: input.text
          },
          timeoutMs: 10_000
        });

        const durationMs = Date.now() - startedAt;
        console.info("WB feedback reply succeeded", {
          endpoint,
          feedbackId: input.feedbackId,
          statusCode: 204,
          durationMs
        });

        return {
          ok: true,
          mode: "real_write",
          dryRun: false,
          statusCode: 204,
          feedbackId: input.feedbackId,
          response: {
            statusCode: 204,
            message: "No Content"
          }
        };
      } catch (error) {
        const statusCode =
          error instanceof Error && "statusCode" in error ? (error as { statusCode?: number }).statusCode
          : error instanceof Error && "status" in error ? (error as { status?: number }).status
          : undefined;
        const retryable =
          error instanceof Error && "retryable" in error ? Boolean((error as { retryable?: boolean }).retryable) : false;

        if (!retryable || attempt >= 3 || !statusCode || (statusCode < 500 && statusCode !== 429)) {
          const durationMs = Date.now() - startedAt;
          console.error("WB feedback reply failed", {
            endpoint,
            feedbackId: input.feedbackId,
            statusCode,
            durationMs
          });
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }

    throw this.http.createError("Wildberries feedback reply failed after retries", {
      code: "WB_REPLY_RETRY_EXHAUSTED",
      retryable: true
    });
  }
}
