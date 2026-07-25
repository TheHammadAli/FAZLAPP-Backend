import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Req,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { Request } from "express";

import { BroadcastService } from "./broadcast.service";
import { CreateBroadcastDto } from "./dto/create-broadcast.dto";
import { SendBroadcastMessageDto } from "./dto/send-broadcast.dto";
import { PaginationDto } from "src/common/dto/pagination.dto";

// ✅ import your guard
import { JwtAuthGuard } from "../auth/guard/jwt-auth-guard";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { FileUploadService } from "src/common/file-upload/file-upload.service";

@ApiTags("Broadcast")
@ApiBearerAuth("jwt")
@UseGuards(JwtAuthGuard) // 🔥 protects ALL routes in controller
@Controller("broadcast")
export class BroadcastController {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly fileUploadService: FileUploadService,
  ) { }

  // 🚀 Create broadcast
  @Post("/create")
  @ApiOperation({ summary: "Create broadcast and dispatch sellers" })
  @ApiConsumes("application/json", "multipart/form-data")
  @ApiBody({ type: CreateBroadcastDto })
  @UseInterceptors(FilesInterceptor("files", 5))
  async createBroadcast(
    @Body() dto: CreateBroadcastDto,
    @Req() req: Request,
    @UploadedFiles() files?: Express.Multer.File[], // Grab the file
  ) {
    const user = req.user as {
      sub: number;
      location: { type: "Point"; coordinates: [number, number] };
    };

    const buyerId = user.sub;
    let location = user.location;
    if (dto.location) {
      location = typeof dto.location === "string"
        ? JSON.parse(dto.location)
        : dto.location;
    }

    dto.categoryId = Number(dto.categoryId);
    dto.radius = Number(dto.radius);
    if (Number.isNaN(dto.categoryId) || Number.isNaN(dto.radius)) {
      throw new BadRequestException("categoryId and radius must be valid numbers");
    }


    let imageUrls: string[] = [];

    console.log("Received files for broadcast:", files);
    // Upload to S3 if a file exists
    if (files?.length) {
      imageUrls = await Promise.all(
        files.map((file) =>
          this.fileUploadService.uploadBroadcastImage(buyerId, file),
        ),
      );
    }

    console.log("Final image URLs for broadcast:", imageUrls);
    // Pass imageUrl to your service
    return this.broadcastService.createBroadcastAndDispatch(
      dto,
      buyerId,
      location,
      imageUrls, // Ensure your service method is updated to accept this
    );
  }

  // 💬 Send message in broadcast thread
  @Post("/message/:id")
  @ApiOperation({ summary: "Send message in broadcast thread" })
  @ApiParam({ name: "id", description: "Broadcast ID" })
  @ApiConsumes("application/json", "multipart/form-data") // Allow file upload in Swagger
  @UseInterceptors(FileInterceptor("file"))
  async sendMessage(
    @Param("id") broadcastId: string,
    @Body() dto: SendBroadcastMessageDto,
    @Req() req: Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const user = req.user as { sub: number };
    const senderId = user.sub;
    const lang = (req.headers["accept-language"] || "en").split(",")[0];

    dto.receiverId = Number(dto.receiverId);
    dto.threadId = Number(dto.threadId);
    if (Number.isNaN(dto.receiverId) || Number.isNaN(dto.threadId)) {
      throw new BadRequestException("receiverId and threadId must be valid numbers");
    }

    let imageUrl: string | undefined;

    if (file) {
      // We use the threadId from the DTO to organize the file path
      imageUrl = await this.fileUploadService.uploadBroadcastThreadImage(
        dto.threadId,
        file,
      );
    }

    return this.broadcastService.sendBroadcastMessage(
      Number(broadcastId),
      senderId,
      dto.receiverId,
      dto.threadId,
      dto.message,
      imageUrl, // Pass the new URL to your service
    );
  }

  // 📥 Get all threads
  @Get("threads/:id")
  @ApiOperation({ summary: "Get all threads for a broadcast" })
  async getThreads(@Param("id") broadcastId: string) {
    return this.broadcastService.getBroadcastThreads(Number(broadcastId));
  }

  // 💬 Get messages in thread
  @Get(":id/threads/:threadId")
  @ApiOperation({ summary: "Get messages for a thread" })
  async getThreadMessages(
    @Param("id") broadcastId: string,
    @Param("threadId") threadId: string,
  ) {
    return this.broadcastService.getThreadMessages(Number(threadId));
  }
  // 📤 Buyer broadcasts
  @Get("/my/broadcasts")
  @ApiOperation({ summary: "Get broadcasts created by logged-in user (buyer)" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "Paginated broadcasts created by buyer",
  })
  async getMyBroadcasts(
    @Req() req: Request,
    @Query() paginationDto: PaginationDto,
  ) {
    const user = req.user as { sub: number };
    return this.broadcastService.getBroadcastsByBuyer(
      user.sub,
      paginationDto.page,
      paginationDto.limit,
    );
  }

  // Seller broadcasts
  @Get("/my/received")
  @ApiOperation({ summary: "Get broadcasts where logged-in user is a seller" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "Paginated broadcasts where user is seller",
  })
  async getReceivedBroadcasts(
    @Req() req: Request,
    @Query() paginationDto: PaginationDto,
  ) {
    const user = req.user as { sub: number };
    return this.broadcastService.getBroadcastsForSeller(
      user.sub,
      paginationDto.page,
      paginationDto.limit,
    );
  }
}
