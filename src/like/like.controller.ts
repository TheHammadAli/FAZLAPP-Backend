import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { LikeService } from "./like.service";
import { CreateLikeDto, RemoveLikeDto } from "./dto/like.dto";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guard/jwt-auth-guard";
import { CurrentUser } from "src/common/decorators/current-user.decorator";

@ApiTags("Likes")
@ApiBearerAuth("jwt")
@UseGuards(JwtAuthGuard)
@Controller("likes")
export class LikeController {
  constructor(private readonly likeService: LikeService) {}

  @Post()
  @ApiOperation({ summary: "Like a product or service" })
  @ApiResponse({ status: 201, description: "Item liked" })
  async addLike(
    @CurrentUser("sub") userId: number,
    @Body() dto: CreateLikeDto,
  ) {
    return this.likeService.addLike(userId, dto);
  }

  @Delete()
  @ApiOperation({ summary: "Unlike a product or service" })
  @ApiResponse({ status: 200, description: "Item unliked" })
  async removeLike(
    @CurrentUser("sub") userId: number,
    @Body() dto: RemoveLikeDto,
  ) {
    return this.likeService.removeLike(userId, dto);
  }

  @Get("user/:userId")
  @ApiOperation({ summary: "Get liked items by user" })
  @ApiQuery({ name: "itemType", required: false, enum: ["product", "service"] })
  async getLikesByUser(
    @Param("userId") userId: string,
    @Query("itemType") itemType?: "product" | "service",
  ) {
    return this.likeService.getLikesByUser(Number(userId), itemType);
  }
}
