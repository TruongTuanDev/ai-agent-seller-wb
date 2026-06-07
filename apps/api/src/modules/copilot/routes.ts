import { Router } from "express";
import { copilotChatSchema } from "@wb/shared";
import { requireAuth, type AuthenticatedRequest } from "../../common/auth";
import { getCopilotConversation, listCopilotConversations, runCopilotChat } from "./service";

export const copilotRouter = Router();

copilotRouter.use(requireAuth);

copilotRouter.get("/conversations", async (req: AuthenticatedRequest, res) => {
  const shopId = String(req.query.shopId ?? "");
  if (!shopId) {
    return res.status(400).json({ message: "shopId la bat buoc." });
  }

  const conversations = await listCopilotConversations(shopId, req.user!.id);
  return res.json({ conversations });
});

copilotRouter.get("/conversations/:conversationId", async (req: AuthenticatedRequest, res) => {
  const conversation = await getCopilotConversation(String(req.params.conversationId), req.user!.id);
  if (!conversation) {
    return res.status(404).json({ message: "Conversation not found" });
  }

  return res.json(conversation);
});

copilotRouter.post("/chat", async (req: AuthenticatedRequest, res) => {
  const parsed = copilotChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  try {
    const result = await runCopilotChat({
      shopId: parsed.data.shopId,
      userId: req.user!.id,
      message: parsed.data.message,
      conversationId: parsed.data.conversationId
    });

    return res.json(result);
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : "Khong the xu ly copilot chat luc nay."
    });
  }
});
