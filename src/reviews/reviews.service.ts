// src/reviews/review.service.ts

import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { I18nService } from "nestjs-i18n";
import { ClsService } from "nestjs-cls";
import { PrismaService } from "src/core/prisma/prisma.service";
import { CreateReviewDto } from "./dto/create-review.dto";
import { QueryReviewDto } from "./dto/query-review.dto";

const REVIEW_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly cls: ClsService,
  ) {}

  private get lang(): string {
    return this.cls.get("lang") || "en";
  }

  /**
   * Create a new review. Ensures only one review per user per item.
   */
  async createReview(dto: CreateReviewDto) {
    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException("Rating must be between 1 and 5");
    }

    const existing = await this.prisma.review.findFirst({
      where: { userId: dto.userId, itemId: dto.itemId, itemType: dto.itemType },
    });

    if (existing) {
      throw new BadRequestException(
        this.i18n.translate("auth.reviews.duplicate_review", {
          lang: this.lang,
        }),
      );
    }

    const result = await this.prisma.review.create({
      data: {
        userId: dto.userId,
        itemId: dto.itemId,
        itemType: dto.itemType,
        rating: dto.rating,
        comment: dto.comment,
      },
    });

    return {
      message: this.i18n.translate("auth.reviews.created_success", {
        lang: this.lang,
      }),
      data: { review: result },
    };
  }

  /**
   * Paginated review list for a given item (product or service)
   */
  async getReviews(query: QueryReviewDto) {
    const itemId = Number(query.itemId);
    const { itemType } = query;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { itemId, itemType },
        include: { user: { select: REVIEW_USER_SELECT } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where: { itemId, itemType } }),
    ]);

    return {
      data: {
        reviews: reviews.map(this.populateUser),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * All reviews created by a specific user
   */
  async getUserReviews(userId: number, page: number = 1, limit: number = 10) {
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { userId },
        include: { user: { select: REVIEW_USER_SELECT } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where: { userId } }),
    ]);

    return {
      data: {
        reviews: reviews.map(this.populateUser),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Flag a review (e.g., for moderation)
   */
  async flagReview(id: number) {
    try {
      return await this.prisma.review.update({
        where: { id },
        data: { isFlagged: true },
      });
    } catch {
      throw new NotFoundException("Review not found");
    }
  }

  /**
   * Get average rating for a specific item
   */
  async getAverageRating(itemId: number, itemType: "product" | "service") {
    const result = await this.prisma.review.aggregate({
      where: { itemId, itemType },
      _avg: { rating: true },
      _count: { _all: true },
    });

    return {
      avgRating: result._avg.rating ?? 0,
      count: result._count._all ?? 0,
    };
  }

  async getAverageRatingsForItems(
    itemIds: number[],
    itemType: "product" | "service",
  ) {
    if (!itemIds || itemIds.length === 0) {
      return [];
    }

    const grouped = await this.prisma.review.groupBy({
      by: ["itemId"],
      where: { itemId: { in: itemIds }, itemType },
      _avg: { rating: true },
      _count: { _all: true },
    });

    return grouped.map((g) => ({
      _id: g.itemId,
      avgRating: g._avg.rating,
      count: g._count._all,
    }));
  }

  async findOne(userId: number, itemId: number, itemType: "product" | "service") {
    return this.prisma.review.findFirst({
      where: { userId, itemId, itemType },
    });
  }

  /**
   * Mirrors Mongoose's `.populate("userId", "name email image")`, which
   * replaces the `userId` field's value in place with the populated user.
   */
  private populateUser<T extends { userId: number; user: unknown }>(
    review: T,
  ) {
    const { user, ...rest } = review;
    return { ...rest, userId: user };
  }
}
