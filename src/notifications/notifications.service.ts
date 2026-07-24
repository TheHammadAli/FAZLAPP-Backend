// src/notifications/notifications.service.ts
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { I18nService } from "nestjs-i18n";
import { UsersService } from "src/users/users.service";
import { Server } from "socket.io";
import { FirebaseService } from "./firebase.service";
import { ClsService } from "nestjs-cls";
import { PrismaService } from "src/core/prisma/prisma.service";

@Injectable()
export class NotificationsService {
  private server!: Server;
  private readonly defaultSoundPaths = {
    sound1: "/media/AUD-20260708-WA0029.mp3",
    sound2: "/media/AUD-20260708-WA0030.mp3",
  };

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly firebaseService: FirebaseService,
    private readonly i18n: I18nService,
    private readonly cls: ClsService,
  ) { }

  private get lang(): string {
    return this.cls.get("lang") || "en";
  }

  setServer(server: Server) {
    this.server = server;
  }

  private buildNotificationPayload<T = Record<string, any>>(payload: T) {
    return {
      ...(payload as Record<string, any>),
      sound1: this.defaultSoundPaths.sound1,
      sound2: this.defaultSoundPaths.sound2,
    } as Record<string, any>;
  }

  async create<T = Record<string, any>>(
    userId: number,
    message: string,
    type: "ORDER" | "MESSAGE" | "PROMOTION" | "SERVICE_REQUEST" = "MESSAGE",
    payload: T,
  ) {
    const user = await this.usersService.findUserById(userId);
    if (!user) {
      throw new BadRequestException(
        this.i18n.translate("auth.notifications.user_not_found", {
          lang: this.lang,
        }),
      );
    }

    const notifPayload = this.buildNotificationPayload(payload);

    return this.prisma.notification.create({
      data: {
        userId,
        message,
        type,
        payload: notifPayload,
        read: false,
      },
    });
  }

  async createAndNotify<T = Record<string, any>>(
    userId: number,
    messageKey: string,
    type: "ORDER" | "MESSAGE" | "PROMOTION" | "SERVICE_REQUEST",
    payload: T,
    i18nArgs: Record<string, any> = {},
  ) {
    const user = await this.usersService.findUserById(userId);

    if (!user) {
      throw new BadRequestException(
        this.i18n.translate("auth.notifications.user_not_found", {
          lang: this.lang,
        }),
      );
    }

    const fullKey = messageKey.includes(".")
      ? `auth.${messageKey}`
      : `auth.notifications.${messageKey}`;

    const translatedMessage = this.i18n.translate(fullKey, {
      lang: this.lang,
      args: i18nArgs,
    }) as string;

    const notifPayload = this.buildNotificationPayload(payload);

    const notif =
      type !== "MESSAGE"
        ? await this.create<T>(userId, translatedMessage, type, notifPayload as T)
        : null;

    if (type !== "MESSAGE" && this.server && notif) {
      this.server.to(userId.toString()).emit("notification", notif);
    }

    if (user?.fcmToken) {
      const notificationId = notif?.id ? String(notif.id) : "";

      await this.firebaseService.sendNotification(
        user.fcmToken,
        this.i18n.translate("auth.notifications.new_title", {
          lang: this.lang,
        }),
        translatedMessage,
        {
          type,
          ...notifPayload,
          ...(notificationId ? { notificationId } : {}),
        },
      );
    }

    return notif;
  }

  async findByUser(userId: number, page: number = 1, limit: number = 10) {
    const user = await this.usersService.findUserById(userId);

    if (!user) {
      throw new BadRequestException(
        this.i18n.translate("auth.notifications.user_not_found", {
          lang: this.lang,
        }),
      );
    }

    page = Number(page) || 1;
    limit = Number(limit) || 10;
    const skip = (page - 1) * limit;

    const total = await this.prisma.notification.count({ where: { userId } });

    const data = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    return {
      data: {
        notifications: data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(id: number) {
    try {
      return await this.prisma.notification.update({
        where: { id },
        data: { read: true },
      });
    } catch {
      throw new NotFoundException(
        this.i18n.translate("auth.notifications.notification_not_found", {
          lang: this.lang,
        }),
      );
    }
  }

  async delete(id: number) {
    try {
      await this.prisma.notification.delete({ where: { id } });
    } catch {
      throw new NotFoundException(
        this.i18n.translate("auth.notifications.notification_not_found", {
          lang: this.lang,
        }),
      );
    }

    return { deleted: true };
  }

  async getUnreadCount(userId: number) {
    const user = await this.usersService.findUserById(userId);

    if (!user) {
      throw new BadRequestException(
        this.i18n.translate("auth.notifications.user_not_found", {
          lang: this.lang,
        }),
      );
    }

    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }
}
