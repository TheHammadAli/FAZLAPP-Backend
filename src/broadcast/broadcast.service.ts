import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { I18nService } from "nestjs-i18n";

import { CreateBroadcastDto } from "./dto/create-broadcast.dto";
import { PaginatedResponseDto } from "src/common/dto/pagination-response.dto";

import { ShopService } from "../shop/shop.service";
import { UsersService } from "src/users/users.service";
import { CategoryService } from "src/category/category.service";
import { ServicesService } from "src/services/services.service";
import { ProductsService } from "src/products/products.service";
import { NotificationsService } from "src/notifications/notifications.service";
import { ClsService } from "nestjs-cls";
import { BroadcastGateway } from "./broadcast.gateway";
import { PrismaService } from "src/core/prisma/prisma.service";
import { GeoJsonPoint, fromGeoJson } from "src/common/utils/location-formatter";

@Injectable()
export class BroadcastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shopService: ShopService,
    private readonly categoryService: CategoryService,
    private readonly userService: UsersService,
    private readonly servicesService: ServicesService,
    private readonly productsService: ProductsService,
    private readonly notificationsService: NotificationsService,
    private readonly i18n: I18nService,
    private readonly cls: ClsService,
    private readonly broadcastGateway: BroadcastGateway,
  ) { }

  private get lang(): string {
    return this.cls.get("lang") || "en";
  }

  // -----------------------------
  // CREATE BROADCAST
  // -----------------------------
  private async createBroadcast(
    dto: CreateBroadcastDto,
    buyerId: number,
    location: GeoJsonPoint,
  ) {
    // Check if broadcast already exists for this buyer and category
    const results = await this.userService.findUserById(buyerId);
    if (!results) {
      throw new NotFoundException(
        this.i18n.translate("auth.broadcast.user_not_found", {
          lang: this.lang,
        }),
      );
    }

    const coords = fromGeoJson(location)!;

    return this.prisma.broadcast.create({
      data: {
        buyerId,
        message: dto.message,
        address: dto.address ?? null,
        purpose: dto.purpose,
        categoryId: dto.categoryId,
        radius: dto.radius,
        type: dto.type,
        ...coords,
      },
    });
  }

  // -----------------------------
  // FIND NEARBY SELLERS
  // -----------------------------
  private async findNearbySellers(
    location: { type: string; coordinates: [number, number] },
    radiusKm: number,
    categoryId: number,
  ) {
    const radiusMeters = radiusKm * 1000;

    const sellerIds = await this.productsService.findNearbyProductShopOwnerIds(
      categoryId,
      location.coordinates,
      radiusMeters,
    );
    return sellerIds;
  }

  // -----------------------------
  // FIND NEARBY SERVICE PROVIDERS
  // -----------------------------
  private async findNearbyServiceProviders(
    location: { type: string; coordinates: [number, number] },
    radiusKm: number,
    categoryId: number,
  ): Promise<number[]> {
    const radiusMeters = radiusKm * 1000;

    const ownerIds = await this.servicesService.findNearbyServiceProviderIds(
      location.coordinates,
      radiusMeters,
      categoryId,
    );

    return ownerIds;
  }

  // -----------------------------
  // CATEGORY CHECK
  // -----------------------------
  private async findCategorybyId(categoryId: number) {
    return this.categoryService.findById(categoryId);
  }

  // -----------------------------
  // CREATE THREADS (NEW CORE LOGIC)
  // -----------------------------
  private async createBroadcastThreads(
    broadcastId: number,
    sellerIds: number[],
    buyerId: number,
  ) {
    const threads = await Promise.all(
      sellerIds.map((sellerId) =>
        this.prisma.broadcastThread.upsert({
          where: { broadcastId_sellerId: { broadcastId, sellerId } },
          update: {},
          create: { broadcastId, buyerId, sellerId },
        }),
      ),
    );

    return threads;
  }

  // -----------------------------
  // MAIN: CREATE + DISPATCH
  // -----------------------------
  async createBroadcastAndDispatch(
    dto: CreateBroadcastDto,
    buyerId: number,
    location: GeoJsonPoint,
    imageUrls?: string[],
  ) {
    const isCategoryValid = await this.findCategorybyId(dto.categoryId);

    if (!isCategoryValid) {
      throw new BadRequestException(
        this.i18n.translate("auth.broadcast.category_invalid", {
          lang: this.lang,
        }),
      );
    }

    if (dto.type !== "product" && dto.type !== "service") {
      throw new BadRequestException(
        this.i18n.translate("auth.broadcast.type_invalid", { lang: this.lang }),
      );
    }

    let sellerIds: number[] = [];

    // Determine recipient IDs based on broadcast type
    if (dto.type === "product") {
      sellerIds = await this.findNearbySellers(
        location,
        dto.radius,
        dto.categoryId,
      );
    } else if (dto.type === "service") {
      sellerIds = await this.findNearbyServiceProviders(
        location,
        dto.radius,
        dto.categoryId,
      );
    }

    sellerIds = [...new Set(sellerIds)];
    sellerIds = sellerIds.filter((id) => id !== buyerId);

    if (!sellerIds.length) {
      throw new BadRequestException(
        this.i18n.translate(dto.purpose === "Buying" ? "auth.broadcast.no_sellers_found" : "auth.broadcast.no_buyers_found", {
          lang: this.lang,
        }),
      );
    }

    const broadcast = await this.createBroadcast(dto, buyerId, location);

    // 1. CREATE THREADS
    const threads = await this.createBroadcastThreads(
      broadcast.id,
      sellerIds,
      buyerId,
    );

    const uniqueThreads = Array.from(
      new Map(threads.map((thread) => [thread.id, thread])).values(),
    );

    // 2. CREATE INITIAL MESSAGES
    const initialMessages = uniqueThreads.map((thread) => ({
      broadcastId: broadcast.id,
      threadId: thread.id,
      senderId: buyerId,
      receiverId: thread.sellerId,
      message: dto.message || "📢 New broadcast request",
      imageUrls: imageUrls ?? [],
    }));

    await new Promise(resolve => setTimeout(resolve, 2000));

    await this.prisma.broadcastMessage.createMany({ data: initialMessages });

    // 3. GET BUYER AND CATEGORY INFO FOR NOTIFICATIONS
    const buyer = await this.userService.findUserById(buyerId);

    // 4. SEND NOTIFICATIONS TO ALL SELLERS
    const notificationPromises = sellerIds.map((sellerId) =>
      this.notificationsService.createAndNotify(
        sellerId,
        "broadcast_created",
        "PROMOTION",
        {
          broadcastId: broadcast.id,
          buyerId,
          message: dto.message || "📢 New broadcast request",
          purpose: dto.purpose,
          broadcastType: dto.type,
          category: dto.categoryId,
          radius: dto.radius,
          address: dto.address,
          imageUrls: imageUrls || [],
        },
        {
          broadcastType: dto.type === "product" ? "Product" : "Service",
          buyer: buyer?.name,
          categoryName: (isCategoryValid as any)?.name?.[this.lang] || "Unknown Category",
          purpose: dto.purpose,
        },
      ),
    );

    await Promise.allSettled(notificationPromises);

    return {
      message: this.i18n.translate("auth.broadcast.created_success", {
        lang: this.lang,
      }),
      data: {
        id: broadcast.id,
      }
    };
  }

  // -----------------------------
  // SEND MESSAGE (THREAD SAFE)
  // -----------------------------
  async sendBroadcastMessage(
    broadcastId: number,
    senderId: number,
    receiverId: number,
    threadId: number,
    message: string,
    imageUrl?: string,
  ) {
    // 1. Validate broadcast
    const broadcast = await this.prisma.broadcast.findUnique({ where: { id: broadcastId } });
    if (!broadcast) {
      throw new NotFoundException(
        this.i18n.translate("auth.broadcast.broadcast_not_found", {
          lang: this.lang,
        }),
      );
    }

    // 2. Validate users
    const [sender, receiver] = await Promise.all([
      this.userService.findUserById(senderId),
      this.userService.findUserById(receiverId),
    ]);

    if (!sender || !receiver) {
      throw new NotFoundException(
        this.i18n.translate("auth.products.user_not_found", {
          lang: this.lang,
        }),
      );
    }

    // 3. Validate thread (SOURCE OF TRUTH)
    const thread = await this.prisma.broadcastThread.findUnique({ where: { id: threadId } });

    if (!thread) {
      throw new NotFoundException(
        this.i18n.translate("auth.broadcast.thread_not_found", {
          lang: this.lang,
        }),
      );
    }

    // 4. Ensure thread belongs to broadcast
    if (thread.broadcastId !== broadcastId) {
      throw new BadRequestException(
        this.i18n.translate("auth.broadcast.thread_invalid", {
          lang: this.lang,
        }),
      );
    }

    // 5. Validate sender is participant
    const isParticipant =
      thread.buyerId === senderId || thread.sellerId === senderId;

    if (!isParticipant) {
      throw new BadRequestException(
        this.i18n.translate("auth.broadcast.sender_not_in_thread", {
          lang: this.lang,
        }),
      );
    }

    // 6. Validate receiver is participant
    const isValidReceiver =
      thread.buyerId === receiverId || thread.sellerId === receiverId;

    if (!isValidReceiver) {
      throw new BadRequestException(
        this.i18n.translate("auth.broadcast.receiver_invalid", {
          lang: this.lang,
        }),
      );
    }

    // 7. Create message
    const messageResults = await this.prisma.broadcastMessage.create({
      data: {
        broadcastId,
        threadId,
        senderId,
        receiverId,
        message,
        imageUrls: imageUrl ? [imageUrl] : [], // Save the S3 URL here
      },
    });

    this.broadcastGateway.server
      .to(String(threadId))
      .emit("receiveMessage", {
        message: messageResults,
        sender,
        thread,
      });


    return {
      data: {
        message: messageResults,
        sender,
        thread: {
          id: threadId,
          buyer: thread.buyerId,
          seller: thread.sellerId,
          broadcast: thread.broadcastId,
        },
      }
    }
  }

  // -----------------------------
  // GET THREADS
  // -----------------------------
  async getBroadcastThreads(broadcastId: number) {
    return this.prisma.$queryRaw<any[]>`
      SELECT
        t.id, t."broadcastId", t."buyerId", t."sellerId", t."lastMessageAt", t."createdAt", t."updatedAt",
        jsonb_build_object('_id', b.id, 'name', b.name, 'image', b.image) as buyer,
        jsonb_build_object('_id', s.id, 'name', s.name, 'image', s.image) as seller,
        lm.latest_message as "latestMessage"
      FROM "BroadcastThread" t
      JOIN "User" b ON b.id = t."buyerId"
      JOIN "User" s ON s.id = t."sellerId"
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object(
          'message', bm.message,
          'createdAt', bm."createdAt",
          'sender', jsonb_build_object('_id', mu.id, 'name', mu.name)
        ) as latest_message
        FROM "BroadcastMessage" bm
        JOIN "User" mu ON mu.id = bm."senderId"
        WHERE bm."threadId" = t.id
        ORDER BY bm."createdAt" DESC
        LIMIT 1
      ) lm ON true
      WHERE t."broadcastId" = ${broadcastId}
      ORDER BY COALESCE((lm.latest_message->>'createdAt')::timestamptz, t."createdAt") DESC
    `;
  }

  // -----------------------------
  // GET THREAD MESSAGES
  // -----------------------------
  async getThreadMessages(threadId: number) {
    const messages = await this.prisma.broadcastMessage.findMany({
      where: { threadId },
      include: {
        sender: { select: { name: true } },
        receiver: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return messages.map(({ senderId, receiverId, ...rest }: any) => rest);
  }

  // -----------------------------
  // GET BROADCASTS CREATED BY BUYER
  // -----------------------------
  async getBroadcastsByBuyer(
    userId: number,
    page = 1,
    limit = 10,
  ) {
    const pageNum = Number(page);
    const limitNum = Number(limit);

    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new BadRequestException(
        this.i18n.translate("common.invalid_pagination", { lang: this.lang }),
      );
    }

    const skip = (pageNum - 1) * limitNum;

    const broadcasts = await this.prisma.$queryRaw<any[]>`
      SELECT
        br.id, br.message, br.address, br.purpose, br.radius, br.type, br."createdAt", br."updatedAt",
        COALESCE(tc.thread_count, 0)::int as "threadCount",
        row_to_json(c.*) as category,
        lm.latest_message as "latestMessage",
        COALESCE(lm.latest_message->'imageUrls', '[]'::jsonb) as "imageUrls"
      FROM "Broadcast" br
      LEFT JOIN "Category" c ON c.id = br."categoryId"
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as thread_count FROM "BroadcastThread" bt WHERE bt."broadcastId" = br.id
      ) tc ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object(
          'message', bm.message,
          'createdAt', bm."createdAt",
          'imageUrls', bm."imageUrls",
          'sender', jsonb_build_object('_id', mu.id, 'name', mu.name, 'image', mu.image)
        ) as latest_message
        FROM "BroadcastMessage" bm
        JOIN "User" mu ON mu.id = bm."senderId"
        WHERE bm."broadcastId" = br.id
        ORDER BY bm."createdAt" DESC
        LIMIT 1
      ) lm ON true
      WHERE br."buyerId" = ${userId}
      ORDER BY br."createdAt" DESC
      LIMIT ${limitNum} OFFSET ${skip}
    `;

    const total = await this.prisma.broadcast.count({ where: { buyerId: userId } });

    return {
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      data: broadcasts,
    };
  }
  // -----------------------------
  // GET BROADCASTS WHERE USER IS SELLER
  // -----------------------------
  async getBroadcastsForSeller(
    userId: number,
    page = 1,
    limit = 10,
  ): Promise<PaginatedResponseDto<any>> {
    const skip = (page - 1) * limit;

    const [threads, total] = await Promise.all([
      this.prisma.broadcastThread.findMany({
        where: { sellerId: userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: { id: true, broadcastId: true },
      }),
      this.prisma.broadcastThread.count({ where: { sellerId: userId } }),
    ]);

    const broadcastIds = threads.map((thread) => thread.broadcastId);
    const threadMap = new Map(
      threads.map((thread) => [thread.broadcastId, thread.id]),
    );

    const data = await this.prisma.broadcast.findMany({
      where: { id: { in: broadcastIds } },
      include: { category: true },
    });

    // Maintain order and add threadId
    const broadcastIdOrder = threads.map((thread) => thread.broadcastId);
    const dataMap = new Map(data.map((b) => [b.id, b]));
    const orderedData = broadcastIdOrder
      .map((id) => dataMap.get(id))
      .filter((b): b is NonNullable<typeof b> => b != null)
      .map((broadcast: any) => ({
        ...broadcast,
        threadId: threadMap.get(broadcast.id),
      }));

    return {
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data: orderedData,
    };
  }
}
