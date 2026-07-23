import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { ReviewService } from "./reviews.service";
import { CreateReviewDto } from "./dto/create-review.dto";
import { QueryReviewDto } from "./dto/query-review.dto";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { JwtAuthGuard } from "src/auth/guard/jwt-auth-guard";
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from "@nestjs/swagger";

@ApiTags("Reviews")
@Controller("reviews")
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) { }

  /**
   * Create a review for a product or service
   */
  @Post()
  @ApiOperation({ summary: "Create a review" })
  @ApiBody({ type: CreateReviewDto })
  async createReview(@Body() dto: CreateReviewDto) {
    return this.reviewService.createReview(dto);
  }

  /**
   * Get paginated reviews for a specific item
   */
  @Get()
  @ApiOperation({ summary: "Get paginated reviews for a product or service" })
  @ApiQuery({ name: "itemId", required: true })
  @ApiQuery({ name: "itemType", enum: ["product", "service"], required: true })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  async getReviewsByItem(@Query() query: QueryReviewDto) {
    return this.reviewService.getReviews(query);
  }

  @Get("/check")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("jwt")
  @ApiOperation({ summary: "Check if current user has reviewed an item" })
  @ApiQuery({ name: "itemId", required: true })
  @ApiQuery({ name: "itemType", enum: ["product", "service"], required: true })
  async checkUserReview(
    @CurrentUser("sub") userId: number,
    @Query("itemId") itemId: string,
    @Query("itemType") itemType: "product" | "service",
  ) {
    const review = await this.reviewService.findOne(userId, Number(itemId), itemType);
    if (!review) {
      return { hasReviewed: false };
    }
    return { hasReviewed: true };
  }

  /**
   * Get all reviews made by a user
   */
  @Get("/user/:userId")
  @ApiOperation({ summary: "Get all reviews by a user" })
  @ApiParam({ name: "userId", required: true })
  async getUserReviews(@Param("userId") userId: string) {
    return this.reviewService.getUserReviews(Number(userId));
  }

  /**
   * Flag a review by ID (soft moderation)
   */
  @Patch("/:id/flag")
  @ApiOperation({ summary: "Flag a review for moderation" })
  @ApiParam({ name: "id", required: true })
  async flagReview(@Param("id") id: string) {
    return this.reviewService.flagReview(Number(id));
  }

  /**
   * Get average rating and count for a specific item
   */
  @Get("/average/:itemType/:itemId")
  @ApiOperation({ summary: "Get average rating and total review count" })
  @ApiParam({ name: "itemType", enum: ["product", "service"] })
  @ApiParam({ name: "itemId" })
  async getAverageRating(
    @Param("itemType") itemType: "product" | "service",
    @Param("itemId") itemId: string,
  ) {
    return this.reviewService.getAverageRating(Number(itemId), itemType);
  }
}
