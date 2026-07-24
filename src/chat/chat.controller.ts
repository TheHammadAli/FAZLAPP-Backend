import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { ChatService } from "./chat.service";
import { PaginationDto } from "src/common/dto/pagination.dto";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiConsumes,
} from "@nestjs/swagger";
import { CreateMessageDto } from "./dto/create-message.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { FileUploadService } from "src/common/file-upload/file-upload.service";

@ApiTags("Chat")
@Controller("chat")
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  @Post("conversation")
  @ApiOperation({
    summary: "Get or create a conversation between buyer and seller",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        buyerId: { type: "string", example: "6645f1d8a8c02c2b8f5a9df0" },
        sellerId: { type: "string", example: "6645f1d8a8c02c2b8f5a9df1" },
      },
    },
  })
  async getOrCreateConversation(
    @Body() body: { buyerId: number; sellerId: number },
  ) {
    const buyerId = Number(body.buyerId);
    const sellerId = Number(body.sellerId);
    if (Number.isNaN(buyerId) || Number.isNaN(sellerId)) {
      throw new BadRequestException("buyerId and sellerId must be valid user ids");
    }
    return this.chatService.getOrCreateConversation(buyerId, sellerId);
  }

  @Post("message")
  @ApiOperation({ summary: "Send a message in a conversation" })
  @ApiConsumes("application/json", "multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        conversationId: { type: "string" },
        senderId: { type: "string" },
        receiverId: { type: "string" },
        text: { type: "string" },
        file: {
          type: "string",
          format: "binary",
          nullable: true,
        },
      },
    },
  }) // Required for Swagger to show file upload
  @UseInterceptors(FileInterceptor("file")) // 'file' is the key in form-data
  async sendMessage(
    @Body() body: CreateMessageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const conversationId = Number(body.conversationId);
    const senderId = Number(body.senderId);
    const receiverId = Number(body.receiverId);
    if (
      Number.isNaN(conversationId) ||
      Number.isNaN(senderId) ||
      Number.isNaN(receiverId)
    ) {
      throw new BadRequestException(
        "conversationId, senderId and receiverId must be valid ids",
      );
    }

    // If a file is provided, upload it first
    let imageUrl: string | undefined;

    if (file && file.size > 0) {
      imageUrl = await this.fileUploadService.uploadChatMessage(
        conversationId,
        file,
      );
    }

    return this.chatService.sendMessage(
      conversationId,
      senderId,
      receiverId,
      body.text,
      imageUrl,
    );
  }

  @Get("messages/:conversationId")
  @ApiOperation({ summary: "Get paginated messages for a conversation" })
  async getMessages(
    @Param("conversationId") conversationId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.chatService.getMessages(Number(conversationId), paginationDto);
  }

  @Patch("messages/mark-read")
  @ApiOperation({
    summary: "Mark all messages as read for a user in a conversation",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        conversationId: { type: "string", example: "665f6d9a3ef12a0c4c122d23" },
        userId: { type: "string", example: "6645f1d8a8c02c2b8f5a9df2" },
      },
    },
  })
  async markAsRead(@Body() body: { conversationId: number; userId: number }) {
    const conversationId = Number(body.conversationId);
    const userId = Number(body.userId);
    if (Number.isNaN(conversationId) || Number.isNaN(userId)) {
      throw new BadRequestException("conversationId and userId must be valid ids");
    }
    return this.chatService.markAsRead(conversationId, userId);
  }

  @Get("messages/unread/:userId")
  @ApiOperation({ summary: "Get count of unread conversations for a user" })
  async getUnreadCount(@Param("userId") userId: string) {
    return this.chatService.getUnreadConversations(Number(userId));
  }

  @Get("conversations/:userId")
  @ApiOperation({
    summary: "Get all conversations for a user with pagination",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of conversations for the user",
    schema: {
      type: "object",
      properties: {
        meta: {
          type: "object",
          properties: {
            total: { type: "number", example: 10 },
            page: { type: "number", example: 1 },
            limit: { type: "number", example: 10 },
            totalPages: { type: "number", example: 1 },
          },
        },
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              _id: { type: "string" },
              buyer: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  name: { type: "string" },
                  email: { type: "string" },
                  profilePicture: { type: "string" },
                },
              },
              seller: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  name: { type: "string" },
                  email: { type: "string" },
                  profilePicture: { type: "string" },
                },
              },
              status: { type: "string", enum: ["open", "closed"] },
              lastMessageAt: { type: "string", format: "date-time" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
  })
  async getConversationsByUserId(
    @Param("userId") userId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.chatService.getConversationsByUserId(Number(userId), paginationDto);
  }
}
