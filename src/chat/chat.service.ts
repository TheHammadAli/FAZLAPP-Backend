import { Injectable, NotFoundException } from "@nestjs/common";
import { I18nService } from "nestjs-i18n";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { PaginatedResponseDto } from "src/common/dto/pagination-response.dto";
import { UsersService } from "src/users/users.service";
import { ShopService } from "src/shop/shop.service";
import { ClsService } from "nestjs-cls";
import { NotificationsService } from "src/notifications/notifications.service";
import { ChatGateway } from "./chat.gateway";
import { PrismaService } from "src/core/prisma/prisma.service";

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UsersService,
    private readonly shopService: ShopService,
    private readonly i18n: I18nService,
    private readonly cls: ClsService,
    private readonly notificationsService: NotificationsService,
    private readonly chatGateway: ChatGateway
  ) { }

  /** Dynamic getter to retrieve the current request language safely */
  private get lang(): string {
    return this.cls.get("lang") || "en";
  }

  async getOrCreateConversation(buyerId: number, sellerId: number) {
    const buyer = await this.userService.findUserById(buyerId);
    const seller = await this.userService.findUserById(sellerId);

    if (!buyer || !seller) {
      throw new NotFoundException(
        this.i18n.translate("auth.chat.user_not_found", { lang: this.lang }),
      );
    }

    // Canonical ordering (string comparison is format-agnostic, so this
    // still works unchanged with cuid ids) so the same pair always maps to
    // the same (buyerId, sellerId) row regardless of who initiated it.
    const [user1, user2] =
      buyerId < sellerId ? [buyerId, sellerId] : [sellerId, buyerId];

    await new Promise(resolve => setTimeout(resolve, 2000));

    return this.prisma.conversation.upsert({
      where: { buyerId_sellerId: { buyerId: user1, sellerId: user2 } },
      update: {},
      create: { buyerId: user1, sellerId: user2, status: "open" },
    });
  }

  async sendMessage(
    conversationId: number,
    senderId: number,
    receiverId: number,
    text: string,
    imageUrl?: string,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException(
        this.i18n.translate("auth.chat.conversation_not_found", {
          lang: this.lang,
        }),
      );
    }

    if (
      senderId !== conversation.buyerId &&
      senderId !== conversation.sellerId
    ) {
      throw new NotFoundException(
        this.i18n.translate("auth.chat.user_not_in_conversation", {
          lang: this.lang,
        }),
      );
    }

    if (
      receiverId !== conversation.buyerId &&
      receiverId !== conversation.sellerId
    ) {
      throw new NotFoundException(
        this.i18n.translate("auth.chat.user_not_in_conversation", {
          lang: this.lang,
        }),
      );
    }

    const [sender, receiver] = await Promise.all([
      this.userService.findUserById(senderId),
      this.userService.findUserById(receiverId),
    ]);

    if (!sender || !receiver) {
      throw new NotFoundException(
        this.i18n.translate("auth.chat.user_not_found", { lang: this.lang }),
      );
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        receiverId,
        text,
        imageUrl,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    await this.notificationsService.createAndNotify(
      receiverId,
      "chat.new_message",
      "MESSAGE",
      {
        conversation: {
          id: conversation.id,
          buyer: conversation.buyerId,
          seller: conversation.sellerId,
          status: conversation.status,
        },
        message: {
          id: message.id,
          text: message.text,
          imageUrl: message.imageUrl,
          createdAt: message.createdAt,
        },
        sender: {
          id: sender.id,
          name: sender.name,
          image: sender.image,
        },
      },
      { senderName: sender.name },
    );

    this.chatGateway.server
      .to(String(conversationId))
      .emit("receiveMessage", {
        message,
        sender,
        conversation,
      });

    return {
      data: {
        message,
        sender,
        conversation,
      },
    };
  }
  async getMessages(
    conversationId: number,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<any>> {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!convo) {
      throw new NotFoundException(
        this.i18n.translate("auth.chat.conversation_not_found", {
          lang: this.lang,
        }),
      );
    }

    const page = Number(paginationDto.page) || 1;
    const limit = Number(paginationDto.limit) || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(conversationId: number, userId: number) {
    await this.userService.findUserById(userId);

    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!convo) {
      throw new NotFoundException(
        this.i18n.translate("auth.chat.conversation_not_found", {
          lang: this.lang,
        }),
      );
    }

    await this.prisma.message.updateMany({
      where: { conversationId, receiverId: userId, read: false },
      data: { read: true },
    });
  }

  async getUnreadConversations(userId: number) {
    await this.userService.findUserById(userId);

    const grouped = await this.prisma.message.groupBy({
      by: ["conversationId"],
      where: { receiverId: userId, read: false },
      _count: { _all: true },
      _max: { createdAt: true },
    });

    return grouped
      .map((g) => ({
        _id: g.conversationId,
        unreadCount: g._count._all,
        lastMessageAt: g._max.createdAt,
      }))
      .sort(
        (a, b) =>
          (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0),
      );
  }

  async getConversationsByUserId(
    userId: number,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<any>> {
    await this.userService.findUserById(userId);

    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const data = await this.prisma.$queryRaw<any[]>`
      SELECT
        c.id, c."buyerId", c."sellerId", c.status, c."lastMessageAt", c."createdAt", c."updatedAt",
        jsonb_build_object('_id', b.id, 'name', b.name, 'email', b.email, 'image', b.image) as buyer,
        jsonb_build_object('_id', s.id, 'name', s.name, 'email', s.email, 'image', s.image) as seller,
        lm.latest_message as "latestMessage",
        COALESCE(uc.unread_count, 0)::int as "unreadCount"
      FROM "Conversation" c
      JOIN "User" b ON b.id = c."buyerId"
      JOIN "User" s ON s.id = c."sellerId"
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object(
          'text', m.text,
          'read', m.read,
          'createdAt', m."createdAt",
          'sender', jsonb_build_object('_id', mu.id, 'name', mu.name)
        ) as latest_message
        FROM "Message" m
        JOIN "User" mu ON mu.id = m."senderId"
        WHERE m."conversationId" = c.id
        ORDER BY m."createdAt" DESC
        LIMIT 1
      ) lm ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as unread_count
        FROM "Message" um
        WHERE um."conversationId" = c.id AND um."receiverId" = ${userId} AND um.read = false
      ) uc ON true
      WHERE c."buyerId" = ${userId} OR c."sellerId" = ${userId}
      ORDER BY COALESCE((lm.latest_message->>'createdAt')::timestamptz, c."lastMessageAt") DESC NULLS LAST
      LIMIT ${limit} OFFSET ${skip}
    `;

    const totalResult = await this.prisma.conversation.count({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    });

    return {
      data,
      meta: {
        total: totalResult,
        page,
        limit,
        totalPages: Math.ceil(totalResult / limit),
      },
    };
  }
}
