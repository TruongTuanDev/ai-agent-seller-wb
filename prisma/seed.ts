import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { PrismaClient, ActionStatus, ActionType, FeedbackStatus, ShopStatus, TelegramStatus, UserRole } from "@prisma/client";

dotenv.config({ path: resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

function encryptSeedToken(text: string, secret: string) {
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

async function main() {
  const passwordHash = await bcrypt.hash("Demo123456!", 10);
  const encryptedDemoToken = encryptSeedToken("demo-wb-token", process.env.ENCRYPTION_KEY ?? "32-byte-demo-key-change-me-now!!!");

  const user = await prisma.user.upsert({
    where: { email: "demo@wb-agent.local" },
    update: { passwordHash },
    create: {
      email: "demo@wb-agent.local",
      passwordHash,
      name: "Demo Seller",
      role: UserRole.ADMIN
    }
  });

  const shop = await prisma.shop.upsert({
    where: { id: "shop-demo-1" },
    update: {},
    create: {
      id: "shop-demo-1",
      userId: user.id,
      name: "Demo Wildberries Shop",
      wbSellerId: "wb-seller-demo",
      encryptedWbToken: encryptedDemoToken,
      tokenScopes: ["general", "products", "feedbacks", "analytics"],
      status: ShopStatus.ACTIVE
    }
  });

  await prisma.product.deleteMany({ where: { shopId: shop.id } });
  await prisma.feedback.deleteMany({ where: { shopId: shop.id } });
  await prisma.shopSnapshot.deleteMany({ where: { shopId: shop.id } });
  await prisma.action.deleteMany({ where: { shopId: shop.id } });
  await prisma.aiReport.deleteMany({ where: { shopId: shop.id } });
  await prisma.telegramIntegration.deleteMany({ where: { shopId: shop.id } });

  const productSeeds = [
    {
      wbNmId: "100001",
      vendorCode: "WB-DEMO-001",
      barcode: "460000000001",
      title: "Men basic cotton T-shirt",
      description: "Basic cotton T-shirt for everyday wear. Soft fabric, regular fit and easy styling for casual outfits.",
      brand: "Demo Brand",
      category: "Fashion",
      price: 990,
      discount: 7,
      stock: 8,
      rating: 3.9,
      reviewCount: 21,
      attributesJson: { material: "cotton", fit: "regular", color: "black" }
    },
    {
      wbNmId: "100002",
      vendorCode: "WB-DEMO-002",
      barcode: "460000000002",
      title: "Women lounge pants relaxed fit",
      description: "Relaxed fit lounge pants with soft feel and simple silhouette for daily comfort.",
      brand: "Demo Brand",
      category: "Fashion",
      price: 1490,
      discount: 9,
      stock: 26,
      rating: 4.6,
      reviewCount: 34,
      attributesJson: { material: "polyester", fit: "relaxed", color: "beige" }
    },
    {
      wbNmId: "100003",
      vendorCode: "WB-DEMO-003",
      barcode: "460000000003",
      title: "Kitchen storage organizer box",
      description: "Compact organizer box for pantry and kitchen shelves with clear visibility and easy stackability.",
      brand: "Demo Home",
      category: "Home",
      price: 790,
      discount: 4,
      stock: 5,
      rating: 4.1,
      reviewCount: 17,
      attributesJson: { material: "plastic", color: "transparent", size: "M" }
    },
    {
      wbNmId: "100004",
      vendorCode: "WB-DEMO-004",
      barcode: "460000000004",
      title: "Lightweight hoodie everyday style",
      description: "Lightweight hoodie for daily use with soft inner feel and neutral design.",
      brand: "Demo Brand",
      category: "Fashion",
      price: 1890,
      discount: 12,
      stock: 14,
      rating: 3.8,
      reviewCount: 28,
      attributesJson: { material: "blend", color: "gray", season: "all-season" }
    },
    {
      wbNmId: "100005",
      vendorCode: "WB-DEMO-005",
      barcode: "460000000005",
      title: "Minimal desk organizer tray",
      description: "Simple tray for desk items, stationery and accessories. Helps keep workspace cleaner.",
      brand: "Demo Home",
      category: "Home",
      price: 690,
      discount: 3,
      stock: 32,
      rating: 4.7,
      reviewCount: 12,
      attributesJson: { material: "plastic", color: "white", size: "compact" }
    }
  ];

  const products = await Promise.all(
    productSeeds.map((product) =>
      prisma.product.create({
        data: {
          shopId: shop.id,
          ...product
        }
      })
    )
  );

  const feedbackSeeds = [
    { productIndex: 0, rating: 3, text: "Size runs a bit small and the fabric feels thinner than expected.", status: FeedbackStatus.NEW },
    { productIndex: 0, rating: 2, text: "Color looks darker than the listing photo.", status: FeedbackStatus.NEW },
    { productIndex: 1, rating: 5, text: "Very comfortable, good quality and fast delivery.", status: FeedbackStatus.REPLIED },
    { productIndex: 2, rating: 4, text: "Useful organizer, but I wish it came in a larger size.", status: FeedbackStatus.NEW },
    { productIndex: 3, rating: 3, text: "Good style, but the size chart should be clearer.", status: FeedbackStatus.DRAFTED, aiReplyDraft: "Здравствуйте! Спасибо за отзыв. Нам жаль, что размерная сетка оказалась недостаточно понятной. Мы уточним описание и будем рады помочь вам в чате магазина." },
    { productIndex: 3, rating: 4, text: "Nice hoodie overall, but material could be described better.", status: FeedbackStatus.NEW },
    { productIndex: 4, rating: 5, text: "Clean design, very practical for desk accessories.", status: FeedbackStatus.REPLIED }
  ];

  const createdFeedbacks = await Promise.all(
    feedbackSeeds.map((feedback, index) =>
      prisma.feedback.create({
        data: {
          shopId: shop.id,
          wbFeedbackId: `fb-demo-${index + 1}`,
          productId: products[feedback.productIndex].id,
          rating: feedback.rating,
          text: feedback.text,
          status: feedback.status,
          aiReplyDraft: feedback.aiReplyDraft ?? null
        }
      })
    )
  );

  for (let day = 0; day < 7; day += 1) {
    await prisma.shopSnapshot.create({
      data: {
        shopId: shop.id,
        date: new Date(Date.now() - day * 24 * 60 * 60 * 1000),
        revenue: 145000 + day * 4200,
        ordersCount: 38 + day,
        addToCartConversion: 11.8 + day * 0.25,
        cartToOrderConversion: 27.4 - day * 0.2,
        buyoutPercent: 81.5 - day * 0.35,
        rawJson: {
          source: "seed",
          dayOffset: day,
          analyticsWarning: day === 0 ? "Analytics se fallback mock neu WB tra 400." : null
        }
      }
    });
  }

  const aiReport = await prisma.aiReport.create({
    data: {
      shopId: shop.id,
      healthScore: 78,
      summary: "Shop dang van hanh on, nhung can uu tien ton kho thap, review ton dong va toi uu SEO cho mot so SKU.",
      risksJson: [
        {
          title: "SKU 100003 ton kho thap",
          severity: "HIGH",
          evidence: "Ton kho con 5 san pham",
          recommendation: "Bo sung kho trong 48 gio",
          relatedSku: "100003"
        }
      ],
      opportunitiesJson: [
        {
          title: "Bat review queue",
          expectedImpact: "Tang trust va review handling speed",
          action: "Tao AI draft tieng Nga cho review moi"
        }
      ],
      actionsJson: [
        {
          type: "CREATE_REVIEW_DRAFT",
          title: "Tao draft cho review ton dong",
          reason: "Rut ngan thoi gian phan hoi review",
          confidence: 0.87,
          requiresApproval: true,
          payload: {}
        }
      ],
      detailsJson: {
        healthScore: 78,
        executiveSummary: "Shop can xu ly ngay SKU ton kho thap, review chua tra loi va mot so listing co title/mo ta chua toi uu.",
        kpiSummary: {
          revenueTrend: "Doanh thu 7 ngay gan day van on dinh.",
          orderTrend: "So don dang tang nhe theo snapshot seed.",
          conversionTrend: "Cart-to-order giam nhe so voi snapshot truoc.",
          reviewRisk: "Con review 2-3 sao va review chua tra loi.",
          inventoryRisk: "SKU 100001 va 100003 sap can bo sung kho."
        },
        criticalIssues: [
          {
            title: "SKU 100003 ton kho thap",
            severity: "HIGH",
            evidence: "Ton kho con 5 san pham",
            recommendation: "Bo sung kho trong 48 gio",
            relatedSku: "100003"
          },
          {
            title: "Review tieu cuc ton dong",
            severity: "HIGH",
            evidence: "Nhieu review nhac toi size va mau sac",
            recommendation: "Tao draft va gui reply sau approval"
          }
        ],
        growthOpportunities: [
          {
            title: "Toi uu SEO cho listing fashion",
            expectedImpact: "Tang kha nang click va chuyen doi",
            action: "Mo Product Doctor cho SKU 100001 va 100004"
          },
          {
            title: "Bat Telegram alert",
            expectedImpact: "Seller nhan canh bao luc dau ngay",
            action: "Gui daily summary luc 9h"
          }
        ],
        recommendedActions: [
          {
            type: "CREATE_REVIEW_DRAFT",
            title: "Tao draft cho review ton dong",
            reason: "Can giam backlog review",
            confidence: 0.87,
            requiresApproval: true,
            payload: {}
          },
          {
            type: "SEND_TELEGRAM_ALERT",
            title: "Gui health summary buoi sang",
            reason: "Seller nam duoc canh bao som",
            confidence: 0.72,
            requiresApproval: true,
            payload: {}
          }
        ],
        missingData: []
      }
    }
  });

  const actionSeeds = [
    { type: ActionType.CREATE_REVIEW_DRAFT, title: "Draft reply cho review can xu ly", payloadJson: { feedbackId: createdFeedbacks[0].id } },
    { type: ActionType.CREATE_SEO_DRAFT, title: "Goi y SEO cho SKU 100001", payloadJson: { productNmId: "100001" } },
    { type: ActionType.SEND_TELEGRAM_ALERT, title: "Gui daily health summary", payloadJson: { shopId: shop.id } },
    { type: ActionType.UPDATE_STOCK, title: "De xuat bo sung ton kho SKU 100003", payloadJson: { productNmId: "100003", suggestedStock: 40 } },
    {
      type: ActionType.REPLY_REVIEW,
      title: "Gui reply review cho hoodie",
      payloadJson: {
        feedbackId: createdFeedbacks[4].id,
        wbFeedbackId: createdFeedbacks[4].wbFeedbackId,
        draftReply: "Здравствуйте! Спасибо за отзыв. Мы уточним размерную сетку и описание материала, чтобы выбрать товар было проще."
      }
    }
  ];

  await Promise.all(
    actionSeeds.map((action) =>
      prisma.action.create({
        data: {
          shopId: shop.id,
          createdByAiReportId: aiReport.id,
          status: ActionStatus.PENDING,
          ...action
        }
      })
    )
  );

  await prisma.telegramIntegration.create({
    data: {
      shopId: shop.id,
      chatId: "@wb_demo_alerts",
      status: TelegramStatus.CONNECTED,
      dailyAlertsEnabled: true,
      alertHour: 9
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
