// notifications.controller.ts
import {
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  Post,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { GetNotificationsQueryDto } from "./dto/get-notifications-query.dto";
import { JwtAuthGuard } from "src/auth/guard/jwt-auth-guard";

@ApiTags("Notifications")
@ApiBearerAuth("jwt")
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get(":userId")
  @ApiOperation({ summary: "Get paginated notifications for a user" })
  @ApiParam({ name: "userId", description: "The ID of the user" })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (1-based)",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page",
    example: 10,
  })
  @ApiResponse({ status: 200, description: "Paginated list of notifications" })
  async getUserNotifications(
    @Param("userId") userId: string,
    @Query() query: GetNotificationsQueryDto,
  ) {
    const { page = 1, limit = 10 } = query;
    return this.notificationsService.findByUser(Number(userId), page, limit);
  }

  @Get(":userId/unread-count")
  @ApiOperation({ summary: "Get unread notification count for a user" })
  @ApiParam({ name: "userId", description: "The ID of the user" })
  @ApiResponse({
    status: 200,
    description: "Unread notification count",
    schema: {
      type: "object",
      properties: {
        count: { type: "number", example: 3 },
      },
    },
  })
  async getUnreadNotificationCount(@Param("userId") userId: string) {
    const count = await this.notificationsService.getUnreadCount(Number(userId));
    return { count };
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark a notification as read" })
  @ApiParam({ name: "id", description: "The ID of the notification" })
  @ApiResponse({ status: 200, description: "Notification marked as read" })
  async markAsRead(@Param("id") id: string) {
    return this.notificationsService.markAsRead(Number(id));
  }

  @Patch(":userId/read-all")
  @ApiOperation({ summary: "Mark all notifications as read for a user" })
  @ApiParam({ name: "userId", description: "The ID of the user" })
  @ApiResponse({ status: 200, description: "All notifications marked as read" })
  async markAllAsRead(@Param("userId") userId: string) {
    await this.notificationsService.markAllAsRead(Number(userId));
    return { message: "All notifications marked as read" };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a notification" })
  @ApiParam({ name: "id", description: "The ID of the notification" })
  @ApiResponse({
    status: 200,
    description: "Notification deleted successfully",
  })
  async deleteNotification(@Param("id") id: string) {
    return this.notificationsService.delete(Number(id));
  }
  @Post("test")
  @ApiOperation({ summary: "Send test notification to a user" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        userId: {
          type: "number",
          example: 1,
        },
        message: {
          type: "string",
          example: "Hello from backend 🚀",
        },
      },
      required: ["userId", "message"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "Notification created and sent successfully",
  })
  async testNotification(@Body() body: { userId: number; message: string }) {
    return this.notificationsService.createAndNotify(
      body.userId, // Recipient
      body.message, // Translation Key (e.g., "new_message_received")
      "MESSAGE", // Notification Type
      {
        // Generic Payload (Mandatory)
        senderId: "system_admin",
        sentAt: new Date().toISOString(),
        action: "open_chat",
      },
      {
        // i18n Params (Optional)
        userName: "John Doe",
      },
    );
  }
}
