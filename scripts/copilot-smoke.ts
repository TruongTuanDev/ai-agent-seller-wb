import assert from "node:assert/strict";
import { __copilotTestUtils } from "../apps/api/src/modules/copilot/service";

const { classifyIntent, createActionPlanner, buildDeterministicAnswer } = __copilotTestUtils;

function main() {
  const salesIntent = classifyIntent("Tai sao don hang giam?", {});
  assert.equal(salesIntent.intent, "SALES_DROP_ANALYSIS");

  const reviewIntent = classifyIntent("Co review nao chua tra loi khong?", {});
  assert.equal(reviewIntent.intent, "REVIEW_MANAGEMENT");

  const inventoryIntent = classifyIntent("SKU nao sap het hang?", {});
  assert.equal(inventoryIntent.intent, "INVENTORY_RISK");

  const followUpContext = {
    activeSku: "SKU-123",
    activeIntent: "PRODUCT_DOCTOR" as const
  };
  const followUpIntent = classifyIntent("Toi uu giup toi", followUpContext);
  assert.equal(followUpIntent.intent, "PRODUCT_DOCTOR");

  const planner = createActionPlanner({
    intent: followUpIntent,
    message: "Toi uu giup toi",
    mode: "ASSISTANT",
    context: followUpContext
  });
  assert.ok(planner.requiredTools.includes("runProductDoctor"));
  assert.ok(planner.requiredTools.includes("getProducts"));

  const blockedActionPlanner = createActionPlanner({
    intent: classifyIntent("Gui review nay di", {}),
    message: "Gui review nay di",
    mode: "MANAGER",
    context: {}
  });
  assert.ok(!blockedActionPlanner.requiredTools.includes("createReviewDraft"));

  const missingDataAnswer = buildDeterministicAnswer({
    intent: "GENERAL_HELP",
    planner: {
      intent: "GENERAL_HELP",
      confidence: 0.3,
      requiredTools: [],
      plan: []
    },
    insights: [],
    missingData: [],
    results: [],
    clarificationQuestion: "Toi can ro hon: ban muon xem health shop, review, ton kho hay toi uu SKU nao?"
  });
  assert.match(missingDataAnswer, /Toi can ro hon/);

  console.log("Copilot smoke checks passed.");
}

main();
