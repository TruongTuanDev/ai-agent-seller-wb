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
      tokenScopes: ["content", "analytics", "feedbacks"],
      status: ShopStatus.ACTIVE
    }
  });

  await prisma.product.deleteMany({ where: { shopId: shop.id } });
  await prisma.feedback.deleteMany({ where: { shopId: shop.id } });
  await prisma.shopSnapshot.deleteMany({ where: { shopId: shop.id } });
  await prisma.action.deleteMany({ where: { shopId: shop.id } });
  await prisma.aiReport.deleteMany({ where: { shopId: shop.id } });
  await prisma.telegramIntegration.deleteMany({ where: { shopId: shop.id } });

  const products = await Promise.all(
    Array.from({ length: 5 }).map((_, index) =>
      prisma.product.create({
        data: {
          shopId: shop.id,
          wbNmId: `10000${index + 1}`,
          vendorCode: `WB-DEMO-00${index + 1}`,
          barcode: `46000000000${index + 1}`,
          title: `Товар демо ${index + 1}`,
          brand: "Demo Brand",
          category: index % 2 === 0 ? "Fashion" : "Home",
          price: 900 + index * 250,
          discount: 5 + index,
          stock: 10 + index * 7,
          rating: 4.1 - index * 0.1,
          reviewCount: 12 + index * 3
        }
      })
    )
  );

  const feedbackTexts = [
    "Качество хорошее, но размер маломерит.",
    "Доставка быстрая, упаковка аккуратная.",
    "Цвет немного отличается от фото.",
    "Спасибо, товар понравился.",
    "Хотелось бы лучше описание состава.",
    "Повторно закажу, все отлично.",
    "Есть небольшой запах после распаковки.",
    "Материал приятный, рекомендую.",
    "Не подошел фасон, но качество нормальное.",
    "За такую цену очень достойно.",
    "Размерная сетка могла бы быть точнее.",
    "Порадовало качество швов.",
    "Возврат не делала, оставила себе.",
    "Продавец быстро ответил на вопрос.",
    "На фото выглядит чуть плотнее.",
    "Заказ пришел вовремя.",
    "Все соответствует описанию.",
    "Ткань тоньше, чем ожидалось.",
    "В целом довольна покупкой.",
    "Хороший вариант на каждый день."
  ];

  await Promise.all(
    feedbackTexts.map((text, index) =>
      prisma.feedback.create({
        data: {
          shopId: shop.id,
          wbFeedbackId: `fb-demo-${index + 1}`,
          productId: products[index % products.length].id,
          rating: index % 5 === 0 ? 3 : 4 + (index % 2),
          text,
          aiReplyDraft: index % 3 === 0 ? "Спасибо за отзыв! Мы учтем ваши замечания." : null,
          status: index % 3 === 0 ? FeedbackStatus.DRAFTED : FeedbackStatus.NEW
        }
      })
    )
  );

  for (let day = 0; day < 7; day += 1) {
    await prisma.shopSnapshot.create({
      data: {
        shopId: shop.id,
        date: new Date(Date.now() - day * 24 * 60 * 60 * 1000),
        revenue: 150000 + day * 5000,
        ordersCount: 45 + day,
        addToCartConversion: 12.5 + day * 0.2,
        cartToOrderConversion: 31.1 - day * 0.3,
        buyoutPercent: 83.5 - day * 0.4,
        rawJson: {
          source: "seed",
          dayOffset: day
        }
      }
    });
  }

  const aiReport = await prisma.aiReport.create({
    data: {
      shopId: shop.id,
      healthScore: 78,
      summary: "Shop dang van hanh on, nhung co canh bao ve ton kho va mot so review 3 sao can xu ly nhanh.",
      risksJson: ["Ton kho cua 2 SKU dang giam nhanh", "Ti le review 3 sao tang trong 7 ngay"],
      opportunitiesJson: ["Tang chat luong mo ta san pham", "Tra loi review bang tieng Nga nhanh hon"],
      actionsJson: [
        { type: "CREATE_REVIEW_DRAFT", title: "Tao draft cho review 3 sao" },
        { type: "UPDATE_STOCK", title: "Cap nhat ton kho SKU 100003" }
      ]
    }
  });

  const actionSeeds = [
    { type: ActionType.CREATE_REVIEW_DRAFT, title: "Draft reply cho review can xu ly", payloadJson: { feedbackId: "fb-demo-1" } },
    { type: ActionType.CREATE_SEO_DRAFT, title: "Goi y SEO cho SKU 100001", payloadJson: { productNmId: "100001" } },
    { type: ActionType.SEND_TELEGRAM_ALERT, title: "Canh bao ton kho thap", payloadJson: { message: "SKU 100003 ton kho con 10" } },
    { type: ActionType.UPDATE_PRICE, title: "De xuat giam gia SKU 100004", payloadJson: { productNmId: "100004", newPrice: 1390 } },
    { type: ActionType.REPLY_REVIEW, title: "Gui reply review Nga", payloadJson: { feedbackId: "fb-demo-3" } }
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
      status: TelegramStatus.DISCONNECTED
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
