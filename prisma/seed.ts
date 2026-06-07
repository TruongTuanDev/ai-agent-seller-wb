import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { PrismaClient, ActionStatus, ActionType, FeedbackStatus, SellerOperatingMode, ShopStatus, TelegramStatus, UserRole, UserPlan } from "@prisma/client";

dotenv.config({ path: resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

function encryptSeedToken(text: string, secret: string) {
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

async function resetShopData(shopId: string) {
  await prisma.feedback.deleteMany({ where: { shopId } });
  await prisma.product.deleteMany({ where: { shopId } });
  await prisma.shopSnapshot.deleteMany({ where: { shopId } });
  await prisma.action.deleteMany({ where: { shopId } });
  await prisma.aiReport.deleteMany({ where: { shopId } });
  await prisma.telegramIntegration.deleteMany({ where: { shopId } });
  await prisma.conversationMessage.deleteMany({
    where: {
      conversation: {
        shopId
      }
    }
  });
  await prisma.conversation.deleteMany({ where: { shopId } });
}

async function main() {
  const passwordHash = await bcrypt.hash("Demo123456!", 10);
  const encryptedDemoToken = encryptSeedToken("demo-wb-token", process.env.ENCRYPTION_KEY ?? "32-byte-demo-key-change-me-now!!!");

  const adminUser = await prisma.user.upsert({
    where: { email: "demo@wb-agent.local" },
    update: { passwordHash, plan: UserPlan.AGENCY, copilotMode: SellerOperatingMode.MANAGER, usageResetAt: new Date() },
    create: {
      email: "demo@wb-agent.local",
      passwordHash,
      name: "Demo Seller",
      role: UserRole.ADMIN,
      plan: UserPlan.AGENCY,
      copilotMode: SellerOperatingMode.MANAGER,
      usageResetAt: new Date()
    }
  });

  const sellerUser = await prisma.user.upsert({
    where: { email: "seller@wb-agent.local" },
    update: { passwordHash, plan: UserPlan.FREE, copilotMode: SellerOperatingMode.ASSISTANT, usageResetAt: new Date() },
    create: {
      email: "seller@wb-agent.local",
      passwordHash,
      name: "Seller Free",
      role: UserRole.SELLER,
      plan: UserPlan.FREE,
      copilotMode: SellerOperatingMode.ASSISTANT,
      usageResetAt: new Date()
    }
  });

  const demoShop = await prisma.shop.upsert({
    where: { id: "shop-demo-1" },
    update: {
      userId: adminUser.id,
      encryptedWbToken: encryptedDemoToken,
      tokenScopes: ["general", "products", "Feedbacks and Questions", "analytics"],
      allowRealReplyTest: false
    },
    create: {
      id: "shop-demo-1",
      userId: adminUser.id,
      name: "Demo Wildberries Shop",
      wbSellerId: "wb-seller-demo",
      encryptedWbToken: encryptedDemoToken,
      tokenScopes: ["general", "products", "Feedbacks and Questions", "analytics"],
      status: ShopStatus.ACTIVE,
      allowRealReplyTest: false
    }
  });

  const freeShop = await prisma.shop.upsert({
    where: { id: "shop-seller-free-1" },
    update: {
      userId: sellerUser.id,
      encryptedWbToken: encryptedDemoToken,
      tokenScopes: ["general", "products", "Feedbacks and Questions", "analytics"],
      allowRealReplyTest: false
    },
    create: {
      id: "shop-seller-free-1",
      userId: sellerUser.id,
      name: "Seller Free Demo Shop",
      wbSellerId: "wb-seller-free-demo",
      encryptedWbToken: encryptedDemoToken,
      tokenScopes: ["general", "products", "Feedbacks and Questions", "analytics"],
      status: ShopStatus.ACTIVE,
      allowRealReplyTest: false
    }
  });

  await resetShopData(freeShop.id);
  await resetShopData(demoShop.id);

  const freeProduct = await prisma.product.create({
    data: {
      shopId: freeShop.id,
      wbNmId: "200001",
      vendorCode: "WB-FREE-001",
      barcode: "460000000101",
      title: "Free plan demo T-shirt",
      description: "Demo product for FREE plan quota smoke tests.",
      brand: "Demo Brand",
      category: "Fashion",
      price: 590,
      discount: 5,
      stock: 12,
      rating: 4.1,
      reviewCount: 5,
      attributesJson: { material: "cotton", color: "white" }
    }
  });

  await prisma.feedback.create({
    data: {
      shopId: freeShop.id,
      wbFeedbackId: "fb-free-1",
      productId: freeProduct.id,
      rating: 3,
      text: "Размер немного маломерит, но в целом футболка нормальная.",
      status: FeedbackStatus.NEW
    }
  });

  const productSeeds = [
    {
      wbNmId: "100001",
      vendorCode: "WB-DEMO-001",
      barcode: "460000000001",
      title: "Men cotton T-shirt bestseller",
      description: "Best-selling basic cotton T-shirt for everyday wear with regular fit and soft fabric for repeat purchases.",
      brand: "North River",
      category: "Fashion",
      price: 990,
      discount: 7,
      stock: 6,
      rating: 3.9,
      reviewCount: 46,
      attributesJson: { material: "cotton", fit: "regular", color: "black" }
    },
    {
      wbNmId: "100002",
      vendorCode: "WB-DEMO-002",
      barcode: "460000000002",
      title: "Women lounge pants relaxed fit",
      description: "Relaxed fit lounge pants with soft feel, bestseller in repeat orders and strong conversion from catalog traffic.",
      brand: "North River",
      category: "Fashion",
      price: 1490,
      discount: 9,
      stock: 42,
      rating: 4.7,
      reviewCount: 58,
      attributesJson: { material: "viscose", fit: "relaxed", color: "beige" }
    },
    {
      wbNmId: "100003",
      vendorCode: "WB-DEMO-003",
      barcode: "460000000003",
      title: "Kitchen storage organizer box",
      description: "Compact pantry organizer for shelves and storage systems.",
      brand: "Home Axis",
      category: "Home",
      price: 790,
      discount: 4,
      stock: 4,
      rating: 4.0,
      reviewCount: 22,
      attributesJson: { material: "plastic", color: "transparent", size: "M" }
    },
    {
      wbNmId: "100004",
      vendorCode: "WB-DEMO-004",
      barcode: "460000000004",
      title: "Lightweight hoodie everyday style",
      description: "Lightweight hoodie with soft inside finish and urban silhouette.",
      brand: "North River",
      category: "Fashion",
      price: 1890,
      discount: 12,
      stock: 11,
      rating: 3.8,
      reviewCount: 34,
      attributesJson: { material: "blend", color: "gray", season: "all-season" }
    },
    {
      wbNmId: "100005",
      vendorCode: "WB-DEMO-005",
      barcode: "460000000005",
      title: "Minimal desk organizer tray",
      description: "Minimalist tray for desk accessories and stationery.",
      brand: "Home Axis",
      category: "Home",
      price: 690,
      discount: 3,
      stock: 28,
      rating: 4.8,
      reviewCount: 19,
      attributesJson: { material: "plastic", color: "white", size: "compact" }
    },
    {
      wbNmId: "100006",
      vendorCode: "WB-DEMO-006",
      barcode: "460000000006",
      title: "Men oversize summer shirt",
      description: "Oversize shirt with breathable fabric for warm weather styling.",
      brand: "North River",
      category: "Fashion",
      price: 1690,
      discount: 11,
      stock: 9,
      rating: 3.7,
      reviewCount: 27,
      attributesJson: { material: "linen blend", fit: "oversize", color: "blue" }
    },
    {
      wbNmId: "100007",
      vendorCode: "WB-DEMO-007",
      barcode: "460000000007",
      title: "Women seamless leggings active",
      description: "Seamless active leggings with stretch fabric and strong repeat sales.",
      brand: "Move Pulse",
      category: "Sport",
      price: 1590,
      discount: 8,
      stock: 18,
      rating: 4.6,
      reviewCount: 41,
      attributesJson: { material: "nylon", fit: "slim", color: "graphite" }
    },
    {
      wbNmId: "100008",
      vendorCode: "WB-DEMO-008",
      barcode: "460000000008",
      title: "Kids pajama cotton set",
      description: "Soft cotton pajama set for kids with seasonal prints.",
      brand: "Mini Cloud",
      category: "Kids",
      price: 1190,
      discount: 5,
      stock: 7,
      rating: 4.1,
      reviewCount: 26,
      attributesJson: { material: "cotton", color: "mint", age: "6-8" }
    },
    {
      wbNmId: "100009",
      vendorCode: "WB-DEMO-009",
      barcode: "460000000009",
      title: "Travel cosmetic bag organizer",
      description: "Compact travel bag for cosmetics and small items.",
      brand: "Home Axis",
      category: "Accessories",
      price: 840,
      discount: 6,
      stock: 16,
      rating: 4.4,
      reviewCount: 24,
      attributesJson: { material: "polyester", color: "pink" }
    },
    {
      wbNmId: "100010",
      vendorCode: "WB-DEMO-010",
      barcode: "460000000010",
      title: "Vacuum storage bags set",
      description: "Storage bags for home organization and seasonal clothes.",
      brand: "Home Axis",
      category: "Home",
      price: 990,
      discount: 10,
      stock: 13,
      rating: 4.3,
      reviewCount: 21,
      attributesJson: { material: "PE", color: "clear", pieces: 6 }
    },
    {
      wbNmId: "100011",
      vendorCode: "WB-DEMO-011",
      barcode: "460000000011",
      title: "Basic women tank top",
      description: "Basic tank top with stretch cotton and everyday styling.",
      brand: "North River",
      category: "Fashion",
      price: 790,
      discount: 4,
      stock: 5,
      rating: 3.6,
      reviewCount: 18,
      attributesJson: { material: "cotton", color: "white", fit: "slim" }
    },
    {
      wbNmId: "100012",
      vendorCode: "WB-DEMO-012",
      barcode: "460000000012",
      title: "Laptop stand foldable",
      description: "Foldable laptop stand for home office setup.",
      brand: "Desk Flow",
      category: "Electronics",
      price: 1890,
      discount: 7,
      stock: 21,
      rating: 4.5,
      reviewCount: 15,
      attributesJson: { material: "aluminum", color: "silver" }
    }
  ];

  const products = await Promise.all(
    productSeeds.map((product) =>
      prisma.product.create({
        data: {
          shopId: demoShop.id,
          ...product
        }
      })
    )
  );

  const feedbackTemplates: Array<{ productIndex: number; rating: number; text: string; status: FeedbackStatus; aiReplyDraft?: string | null }> = [
    { productIndex: 0, rating: 2, text: "Футболка маломерит, размерная сетка не совпадает.", status: FeedbackStatus.NEW },
    { productIndex: 0, rating: 2, text: "Цвет темнее, чем на фото, ожидала другое.", status: FeedbackStatus.NEW },
    { productIndex: 0, rating: 3, text: "Материал тонкий, после стирки выглядит хуже.", status: FeedbackStatus.NEW },
    { productIndex: 0, rating: 5, text: "Хорошая базовая футболка, пришла быстро.", status: FeedbackStatus.SENT },
    { productIndex: 0, rating: 4, text: "Нормально за свою цену, но хотелось плотнее ткань.", status: FeedbackStatus.NEW },

    { productIndex: 1, rating: 5, text: "Очень удобные брюки, беру уже второй раз.", status: FeedbackStatus.SENT },
    { productIndex: 1, rating: 5, text: "Ткань мягкая, посадка отличная.", status: FeedbackStatus.SENT },
    { productIndex: 1, rating: 4, text: "Все понравилось, но хотелось больше цветов.", status: FeedbackStatus.NEW },

    { productIndex: 2, rating: 3, text: "Органайзер хороший, но пришел с царапиной.", status: FeedbackStatus.NEW },
    { productIndex: 2, rating: 4, text: "Удобно хранить крупы, но размер немного меньше ожиданий.", status: FeedbackStatus.NEW },
    { productIndex: 2, rating: 2, text: "Крышка держится слабо, материал тонкий.", status: FeedbackStatus.NEW },

    { productIndex: 3, rating: 2, text: "Толстовка красивая, но размер маломерит.", status: FeedbackStatus.DRAFTED, aiReplyDraft: "Здравствуйте! Спасибо за отзыв. Нам жаль, что размер оказался неудобным. Мы уточним размерную сетку и описание, чтобы следующий выбор был проще." },
    { productIndex: 3, rating: 3, text: "Материал вживую проще, чем ожидала по фото.", status: FeedbackStatus.NEW },
    { productIndex: 3, rating: 4, text: "Фасон хороший, доставка быстрая.", status: FeedbackStatus.NEW },
    { productIndex: 3, rating: 2, text: "Цвет серый, а на фото казался светлее.", status: FeedbackStatus.NEW },

    { productIndex: 4, rating: 5, text: "Очень удобно для мелочей на столе.", status: FeedbackStatus.SENT },
    { productIndex: 4, rating: 5, text: "Красивый и практичный органайзер.", status: FeedbackStatus.SENT },

    { productIndex: 5, rating: 2, text: "Рубашка широкая, но рукава короткие.", status: FeedbackStatus.NEW },
    { productIndex: 5, rating: 3, text: "Ткань мнется сильнее, чем ожидала.", status: FeedbackStatus.NEW },
    { productIndex: 5, rating: 4, text: "Стильно смотрится, размер подошел.", status: FeedbackStatus.NEW },

    { productIndex: 6, rating: 5, text: "Леггинсы супер, удобные и плотные.", status: FeedbackStatus.SENT },
    { productIndex: 6, rating: 4, text: "Хорошо сидят, но хотелось бы длиннее.", status: FeedbackStatus.NEW },
    { productIndex: 6, rating: 5, text: "Отличный товар для тренировок.", status: FeedbackStatus.SENT },

    { productIndex: 7, rating: 3, text: "Пижама приятная, но цвет отличается от фото.", status: FeedbackStatus.NEW },
    { productIndex: 7, rating: 4, text: "Ребенку понравилась, ткань мягкая.", status: FeedbackStatus.NEW },
    { productIndex: 7, rating: 2, text: "После стирки ткань стала жестче.", status: FeedbackStatus.NEW },

    { productIndex: 8, rating: 5, text: "Очень удобная косметичка, беру в поездки.", status: FeedbackStatus.SENT },
    { productIndex: 8, rating: 4, text: "В целом хорошо, молния могла бы быть крепче.", status: FeedbackStatus.NEW },

    { productIndex: 9, rating: 4, text: "Хорошие пакеты, но инструкция не очень понятная.", status: FeedbackStatus.NEW },
    { productIndex: 9, rating: 3, text: "Один пакет пришел с маленькой дыркой.", status: FeedbackStatus.NEW },

    { productIndex: 10, rating: 2, text: "Майка просвечивает и размер меньше заявленного.", status: FeedbackStatus.NEW },
    { productIndex: 10, rating: 3, text: "Материал приятный, но швы неаккуратные.", status: FeedbackStatus.NEW },
    { productIndex: 10, rating: 4, text: "Нормальная базовая майка за свою цену.", status: FeedbackStatus.NEW },

    { productIndex: 11, rating: 5, text: "Подставка устойчивая, ноутбук не греется.", status: FeedbackStatus.SENT },
    { productIndex: 11, rating: 4, text: "Полезная вещь, но хотелось бы мягкие накладки.", status: FeedbackStatus.NEW },
    { productIndex: 11, rating: 5, text: "Качественный металл и удобный угол наклона.", status: FeedbackStatus.SENT }
  ];

  const createdFeedbacks = await Promise.all(
    feedbackTemplates.map((feedback, index) =>
      prisma.feedback.create({
        data: {
          shopId: demoShop.id,
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

  const snapshots = [
    { dayOffset: 13, revenue: 198000, ordersCount: 58, addToCartConversion: 14.3, cartToOrderConversion: 31.2, buyoutPercent: 84.4 },
    { dayOffset: 12, revenue: 194500, ordersCount: 56, addToCartConversion: 14.1, cartToOrderConversion: 30.7, buyoutPercent: 84.1 },
    { dayOffset: 11, revenue: 191000, ordersCount: 55, addToCartConversion: 13.9, cartToOrderConversion: 30.3, buyoutPercent: 83.8 },
    { dayOffset: 10, revenue: 186800, ordersCount: 54, addToCartConversion: 13.7, cartToOrderConversion: 29.8, buyoutPercent: 83.4 },
    { dayOffset: 9, revenue: 182200, ordersCount: 52, addToCartConversion: 13.4, cartToOrderConversion: 29.1, buyoutPercent: 83.0 },
    { dayOffset: 8, revenue: 177900, ordersCount: 50, addToCartConversion: 13.1, cartToOrderConversion: 28.6, buyoutPercent: 82.6 },
    { dayOffset: 7, revenue: 173500, ordersCount: 49, addToCartConversion: 12.9, cartToOrderConversion: 28.1, buyoutPercent: 82.2 },
    { dayOffset: 6, revenue: 168400, ordersCount: 47, addToCartConversion: 12.7, cartToOrderConversion: 27.6, buyoutPercent: 81.8 },
    { dayOffset: 5, revenue: 163000, ordersCount: 45, addToCartConversion: 12.4, cartToOrderConversion: 27.0, buyoutPercent: 81.5 },
    { dayOffset: 4, revenue: 157200, ordersCount: 43, addToCartConversion: 12.1, cartToOrderConversion: 26.4, buyoutPercent: 81.1 },
    { dayOffset: 3, revenue: 151800, ordersCount: 41, addToCartConversion: 11.8, cartToOrderConversion: 25.8, buyoutPercent: 80.8 },
    { dayOffset: 2, revenue: 145900, ordersCount: 39, addToCartConversion: 11.5, cartToOrderConversion: 25.1, buyoutPercent: 80.2 },
    { dayOffset: 1, revenue: 139400, ordersCount: 37, addToCartConversion: 11.2, cartToOrderConversion: 24.4, buyoutPercent: 79.8 },
    { dayOffset: 0, revenue: 132800, ordersCount: 34, addToCartConversion: 10.9, cartToOrderConversion: 23.6, buyoutPercent: 79.1 }
  ];

  for (const snapshot of snapshots) {
    await prisma.shopSnapshot.create({
      data: {
        shopId: demoShop.id,
        date: new Date(Date.now() - snapshot.dayOffset * 24 * 60 * 60 * 1000),
        revenue: snapshot.revenue,
        ordersCount: snapshot.ordersCount,
        addToCartConversion: snapshot.addToCartConversion,
        cartToOrderConversion: snapshot.cartToOrderConversion,
        buyoutPercent: snapshot.buyoutPercent,
        rawJson: {
          source: "seed",
          dayOffset: snapshot.dayOffset,
          bestSellerSku: "100001",
          lowStockSkus: ["100001", "100003", "100011"],
          analyticsWarning: snapshot.dayOffset === 0 ? "Analytics se fallback mock neu WB tra 400." : null
        }
      }
    });
  }

  const aiReport = await prisma.aiReport.create({
    data: {
      shopId: demoShop.id,
      healthScore: 64,
      summary: "Shop dang giam doanh thu do conversion di xuong, review ton dong va best-seller sap het hang.",
      risksJson: [
        {
          title: "SKU 100001 sap het hang",
          severity: "CRITICAL",
          evidence: "Best-seller chi con 6 san pham",
          recommendation: "Bo sung kho trong 24-48 gio",
          relatedSku: "100001"
        },
        {
          title: "Review tieu cuc ton dong",
          severity: "HIGH",
          evidence: "Nhieu review nhac toi size, mau va chat lieu",
          recommendation: "Tao draft Nga va day vao approval queue"
        },
        {
          title: "Conversion giam 7 ngay lien tiep",
          severity: "HIGH",
          evidence: "Cart-to-order giam tu 28.1% xuong 23.6%",
          recommendation: "Kiem tra lai listing ban chay va backlog review"
        }
      ],
      opportunitiesJson: [
        {
          title: "Xu ly review backlog trong ngay",
          expectedImpact: "Tang trust va giam mat conversion",
          action: "Draft reply cho review 1-3 sao truoc"
        },
        {
          title: "Mo Product Doctor cho 100001 va 100011",
          expectedImpact: "Tang click va ho tro conversion",
          action: "Toi uu title, mo ta va canh bao size"
        },
        {
          title: "Bat Telegram alert 9h sang",
          expectedImpact: "Seller nhan canh bao van hanh som moi ngay",
          action: "Gui tom tat health score va SKU nguy hiem"
        }
      ],
      actionsJson: [
        {
          type: "CREATE_REVIEW_DRAFT",
          title: "Tao draft cho review ton dong",
          reason: "Can giam backlog review anh huong conversion",
          confidence: 0.92,
          requiresApproval: true,
          payload: {}
        },
        {
          type: "CREATE_SEO_DRAFT",
          title: "Toi uu Product Doctor cho SKU 100001",
          reason: "Best-seller dang co review risk va ton kho thap",
          confidence: 0.84,
          requiresApproval: true,
          payload: { productId: products[0].id }
        }
      ],
      detailsJson: {
        healthScore: 64,
        executiveSummary: "Don hang giam chu yeu do conversion di xuong, backlog review tieu cuc va SKU ban chay sap het hang. Demo data nay duoc seed de seller co the thay ro logic phan tich cua Copilot trong 3 phut.",
        kpiSummary: {
          revenueTrend: "Doanh thu 14 ngay giam tu 198,000 RUB xuong 132,800 RUB.",
          orderTrend: "So don giam tu 58 xuong 34 don trong 14 ngay.",
          conversionTrend: "Cart-to-order giam tu 31.2% xuong 23.6% va add-to-cart giam dan.",
          reviewRisk: "Con nhieu review tieu cuc ve size, mau, chat lieu va giao hang chua duoc tra loi.",
          inventoryRisk: "Best-seller 100001 chi con 6 san pham, 100003 con 4 va 100011 con 5."
        },
        criticalIssues: [
          {
            title: "Best-seller 100001 sap het hang",
            severity: "CRITICAL",
            evidence: "SKU 100001 chi con 6 san pham nhung van la SKU co nhieu review va nhu cau cao",
            recommendation: "Bo sung ton kho som va theo doi lai sau sync",
            relatedSku: "100001"
          },
          {
            title: "Review backlog tieu cuc",
            severity: "HIGH",
            evidence: "Co nhieu review nhac den size, mau va chat lieu chua duoc xu ly",
            recommendation: "Tao AI draft Nga va dua vao approval queue"
          },
          {
            title: "Conversion dang giam",
            severity: "HIGH",
            evidence: "Cart-to-order giam 7 diem trong 14 ngay",
            recommendation: "Mo Product Doctor cho listing ban chay va xu ly review ton dong"
          }
        ],
        growthOpportunities: [
          {
            title: "Tra loi review trong ngay",
            expectedImpact: "Tang trust va giam mat don do review tieu cuc",
            action: "Mo review queue va draft review 1-3 sao truoc"
          },
          {
            title: "Product Doctor cho SKU ban chay",
            expectedImpact: "Tang click-through va conversion",
            action: "Toi uu title/mo ta Nga cho 100001 va 100011"
          },
          {
            title: "Telegram daily alert",
            expectedImpact: "Seller ra quyet dinh nhanh dau ngay",
            action: "Gui health summary luc 9h sang"
          }
        ],
        recommendedActions: [
          {
            type: "CREATE_REVIEW_DRAFT",
            title: "Tao draft cho review ton dong",
            reason: "Backlog review dang gay giam trust",
            confidence: 0.92,
            requiresApproval: true,
            payload: {}
          },
          {
            type: "CREATE_SEO_DRAFT",
            title: "Mo Product Doctor cho 100001",
            reason: "Best-seller can toi uu va dang co review risk",
            confidence: 0.84,
            requiresApproval: true,
            payload: { productId: products[0].id }
          },
          {
            type: "SEND_TELEGRAM_ALERT",
            title: "Gui tom tat buoi sang",
            reason: "Seller can thay inventory/review risk ngay dau ngay",
            confidence: 0.75,
            requiresApproval: true,
            payload: {}
          }
        ],
        missingData: []
      }
    }
  });

  const actionSeeds = [
    {
      type: ActionType.CREATE_REVIEW_DRAFT,
      title: "Tao draft cho review backlog 1-3 sao",
      status: ActionStatus.PENDING,
      payloadJson: { shopId: demoShop.id }
    },
    {
      type: ActionType.CREATE_SEO_DRAFT,
      title: "Product Doctor cho SKU 100001",
      status: ActionStatus.PENDING,
      payloadJson: { productId: products[0].id, productNmId: "100001" }
    },
    {
      type: ActionType.SEND_TELEGRAM_ALERT,
      title: "Gui daily health summary 9h sang",
      status: ActionStatus.PENDING,
      payloadJson: { shopId: demoShop.id }
    },
    {
      type: ActionType.UPDATE_STOCK,
      title: "De xuat bo sung ton kho cho SKU 100001 va 100003",
      status: ActionStatus.APPROVED,
      payloadJson: { skus: ["100001", "100003"], suggestedStock: 50 }
    },
    {
      type: ActionType.REPLY_REVIEW,
      title: "Gui reply review tieu cuc cho T-shirt bestseller",
      status: ActionStatus.PENDING,
      payloadJson: {
        feedbackId: createdFeedbacks[0].id,
        wbFeedbackId: createdFeedbacks[0].wbFeedbackId,
        productId: products[0].id,
        draftReply: "Здравствуйте! Спасибо за отзыв. Нам жаль, что размер оказался неудобным. Мы уже передали замечание команде и уточним размерную сетку в карточке товара.",
        replyText: "Здравствуйте! Спасибо за отзыв. Нам жаль, что размер оказался неудобным. Мы уже передали замечание команде и уточним размерную сетку в карточке товара."
      }
    }
  ];

  await Promise.all(
    actionSeeds.map((action) =>
      prisma.action.create({
        data: {
          shopId: demoShop.id,
          createdByAiReportId: aiReport.id,
          ...action
        }
      })
    )
  );

  await prisma.telegramIntegration.create({
    data: {
      shopId: demoShop.id,
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
