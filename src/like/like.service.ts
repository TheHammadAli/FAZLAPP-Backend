import {
  Injectable,
  NotFoundException,
  ConflictException,
  forwardRef,
  Inject,
} from "@nestjs/common";
import { PrismaService } from "src/core/prisma/prisma.service";
import { CreateLikeDto, RemoveLikeDto } from "./dto/like.dto";
import { ProductsService } from "src/products/products.service";
import { ServicesService } from "src/services/services.service";
import { I18nService } from "nestjs-i18n";
import { ClsService } from "nestjs-cls";

export interface LikeItem {
  id: number;
  itemId: number;
  itemType: "product" | "service";
  ownerModel: "Shop" | "User";
  createdAt: Date;
}

export interface PopulatedLikeItem extends LikeItem {
  itemDetails?: any;
}

@Injectable()
export class LikeService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
    @Inject(forwardRef(() => ServicesService))
    private readonly servicesService: ServicesService,
    private readonly i18n: I18nService,
    private readonly cls: ClsService,
  ) { }

  private get lang(): string {
    return this.cls.get("lang") || "en";
  }

  /**
   * Add a like/favorite
   */
  async addLike(
    userId: number,
    dto: CreateLikeDto,
  ): Promise<{ message: string; data: any }> {
    await this.validateItemExists(dto.itemId, dto.itemType);

    const existingLike = await this.prisma.like.findUnique({
      where: {
        userId_itemId_itemType: {
          userId,
          itemId: dto.itemId,
          itemType: dto.itemType,
        },
      },
    });

    if (existingLike) {
      throw new ConflictException(
        this.i18n.translate("auth.like.already_liked", { lang: this.lang }),
      );
    }

    const results = await this.prisma.like.create({
      data: {
        userId,
        itemId: dto.itemId,
        itemType: dto.itemType,
        ownerModel: dto.ownerModel,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));
    return {
      message: this.i18n.translate("auth.like.created_success", {
        lang: this.lang,
      }),
      data: results,
    };
  }

  /**
   * Remove like
   */
  async removeLike(
    userId: number,
    dto: RemoveLikeDto,
  ): Promise<{ message: string }> {
    try {
      await this.prisma.like.delete({
        where: {
          userId_itemId_itemType: {
            userId,
            itemId: dto.itemId,
            itemType: dto.itemType,
          },
        },
      });
    } catch {
      throw new NotFoundException(
        this.i18n.translate("auth.like.not_found", { lang: this.lang }),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return {
      message: this.i18n.translate("auth.like.removed", { lang: this.lang }),
    };
  }

  /**
   * Get likes for a user
   */
  async getLikesByUser(
    userId: number,
    itemType?: "product" | "service",
    ids?: number[],
  ): Promise<PopulatedLikeItem[]> {
    if (!userId) {
      return [];
    }

    const where: any = { userId };
    if (itemType) where.itemType = itemType;
    if (ids && ids.length > 0) where.itemId = { in: ids };

    const likes = await this.prisma.like.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const populatedLikes = await Promise.all(
      likes.map(async (like) => {
        if (!like.itemId) return null;

        let itemDetails: any = null;

        try {
          if (like.itemType === "product") {
            itemDetails = await this.productsService.getById(like.itemId);
          } else if (like.itemType === "service") {
            itemDetails = await this.servicesService.getById(like.itemId);
          }
        } catch (error) {
          // optional logging
          // console.warn('Item not found:', like.itemId);
        }

        if (!itemDetails) return null;

        return {
          ...like,
          itemDetails,
        };
      }),
    );

    return populatedLikes.filter(Boolean) as PopulatedLikeItem[];
  }

  /**
   * Check if liked
   */
  async isLiked(
    userId: number,
    itemId: number,
    itemType: "product" | "service",
  ): Promise<boolean> {
    const exists = await this.prisma.like.findFirst({
      where: { userId, itemId, itemType },
      select: { id: true },
    });

    return !!exists;
  }

  /**
   * Count likes
   */
  async getLikeCount(
    itemId: number,
    itemType: "product" | "service",
  ): Promise<number> {
    return this.prisma.like.count({ where: { itemId, itemType } });
  }

  /**
   * Validate item exists
   */
  private async validateItemExists(
    itemId: number,
    itemType: "product" | "service",
  ): Promise<void> {
    if (itemType === "product") {
      const product = await this.productsService.getById(itemId);

      if (!product) {
        throw new NotFoundException(
          this.i18n.translate("auth.like.product_not_found", {
            lang: this.lang,
          }),
        );
      }
    }

    if (itemType === "service") {
      const service = await this.servicesService.getById(itemId);

      if (!service) {
        throw new NotFoundException(
          this.i18n.translate("auth.like.service_not_found", {
            lang: this.lang,
          }),
        );
      }
    }
  }
}
