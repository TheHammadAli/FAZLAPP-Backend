import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { I18nService } from "nestjs-i18n";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { PaginatedResponseDto } from "src/common/dto/pagination-response.dto";
import { ShopService } from "src/shop/shop.service";
import { ListingUtilsService } from "src/shared/listing-util-service";
import { UsersService } from "src/users/users.service";
import { SearchAllProductsServiceDto } from "src/search/dto/product-service-search-for.dto";
import { FileUploadService } from "src/common/file-upload/file-upload.service";
import { PromotionService } from "src/promotion/promotion.service";
import { ClsService } from "nestjs-cls";
import { LikeService } from "src/like/like.service";
import { ReviewService } from "src/reviews/reviews.service";
import { PrismaService } from "src/core/prisma/prisma.service";
import { Prisma } from "src/generated/prisma/client";
import {
  GeoJsonPoint,
  fromGeoJson,
  toGeoJson,
} from "src/common/utils/location-formatter";

function buildSearchableTags(
  parameters?: Array<{ name: string; variants: string[] }>,
) {
  if (!Array.isArray(parameters)) {
    return [];
  }

  return [
    ...new Set(
      parameters.flatMap((param) => [
        param.name,
        ...(Array.isArray(param.variants) ? param.variants : []),
      ]),
    ),
  ];
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ShopService))
    private readonly shopService: ShopService,
    private readonly listingUtils: ListingUtilsService,
    @Inject(forwardRef(() => UsersService))
    private readonly userService: UsersService,
    private readonly fileUploadService: FileUploadService,
    private promotionService: PromotionService,
    private readonly i18n: I18nService,
    private readonly cls: ClsService,
    @Inject(forwardRef(() => LikeService))
    private readonly likeService: LikeService,
    private readonly reviewService: ReviewService,
  ) { }

  private get lang(): string {
    return this.cls.get("lang") || "en";
  }

  async create(
    entityId: number,
    type: "shop" | "personal",
    dto: CreateProductDto,
  ): Promise<{ message: string; data: { product: any } }> {
    try {
      let location: GeoJsonPoint;
      let shopId: number | undefined;
      let ownerId: number | undefined;

      if (type === "shop") {
        const shop = await this.shopService.getShopById(entityId);
        if (!shop) {
          throw new NotFoundException(
            this.i18n.translate("auth.products.shop_not_found", {
              lang: this.lang,
            }),
          );
        }

        if (
          !shop.location ||
          !shop.location.coordinates ||
          shop.location.coordinates.length !== 2
        ) {
          throw new BadRequestException(
            this.i18n.translate("auth.products.shop_location_missing", {
              lang: this.lang,
            }),
          );
        }

        shopId = shop.id;
        location = shop.location;
      } else if (type === "personal") {
        const user = await this.userService.findUserById(entityId);
        if (!user) {
          throw new NotFoundException(
            this.i18n.translate("auth.products.user_not_found", {
              lang: this.lang,
            }),
          );
        }
        if (
          !user.location ||
          !user.location.coordinates ||
          user.location.coordinates.length !== 2
        ) {
          throw new BadRequestException(
            this.i18n.translate("auth.products.user_location_missing", {
              lang: this.lang,
            }),
          );
        }

        ownerId = user.id;
        location = { type: "Point", coordinates: user.location.coordinates };
      } else {
        throw new BadRequestException(
          'Invalid type. Must be "shop" or "personal".',
        );
      }

      const searchableTags = buildSearchableTags(dto.parameters as any);
      const coords = fromGeoJson(location)!;

      let product = await this.prisma.product.create({
        data: {
          shopId: shopId ?? null,
          ownerId: ownerId ?? null,
          title: dto.title,
          description: dto.description ?? null,
          price: dto.price,
          categoryId: dto.category,
          type: dto.type,
          images: [],
          video: "",
          parameters: (dto.parameters ?? []) as any,
          searchableTags,
          ...coords,
        },
      });

      let images: string[] = [];
      let video = "";

      if (dto?.images?.length) {
        const uploadedFiles = await this.fileUploadService.uploadProductFiles(
          dto.images,
          type,
          entityId,
          product.id,
          "images",
        );
        images = uploadedFiles.map((file) => file.url);
      }

      if (dto?.video) {
        const uploadedVideo = await this.fileUploadService.uploadProductFiles(
          [dto.video],
          type,
          entityId,
          product.id,
          "video",
        );
        video = uploadedVideo[0].url;
      }

      if (images.length > 0 || video) {
        product = await this.prisma.product.update({
          where: { id: product.id },
          data: {
            ...(images.length > 0 ? { images } : {}),
            ...(video ? { video } : {}),
          },
        });
      }

      const { latitude, longitude, ...rest } = product;

      return {
        message: this.i18n.translate("auth.products.created_success", {
          lang: this.lang,
        }),
        data: {
          product: { ...rest, location: toGeoJson(latitude, longitude) },
        },
      };
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }

  async getAllProductsByShop(
    shopId: number,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<any>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;
    const where = { shopId, isDeleted: false, isDisabled: false };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true, shop: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    const data = items.map((item: any) => {
      const { shop, latitude, longitude, ...rest } = item;
      let shopShaped = shop;
      if (shop) {
        const { latitude: shopLat, longitude: shopLng, ...shopRest } = shop;
        shopShaped = { ...shopRest, location: toGeoJson(shopLat, shopLng) };
      }
      return {
        ...rest,
        shopId: shopShaped,
        location: toGeoJson(latitude, longitude),
      };
    });

    return {
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      data,
    };
  }

  async getAllProductsByUser(
    ownerId: number,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<any>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;
    const where = { ownerId, isDeleted: false, isDisabled: false };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true, owner: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    const data = items.map((item: any) => {
      const { owner, latitude, longitude, ...rest } = item;
      return {
        ...rest,
        ownerId: owner,
        location: toGeoJson(latitude, longitude),
      };
    });

    return {
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      data,
    };
  }

  async getById(id: number, userId?: number): Promise<any> {
    const product = await this.prisma.product.findFirst({
      where: { id, isDeleted: false, isDisabled: false },
      include: {
        category: true,
        shop: {
          include: {
            owner: { select: { id: true, name: true, phone: true } },
          },
        },
        owner: true,
      },
    });

    if (!product)
      throw new NotFoundException(
        this.i18n.translate("auth.products.product_not_found", {
          lang: this.lang,
        }),
      );

    const {
      shop,
      owner,
      shopId,
      ownerId,
      categoryId,
      latitude,
      longitude,
      ...rest
    } = product as any;

    let shopShaped: any = null;
    if (shop) {
      const { owner: shopOwner, latitude: shopLat, longitude: shopLng, ...shopRest } = shop;
      shopShaped = {
        ...shopRest,
        location: toGeoJson(shopLat, shopLng),
        ownerId: shopOwner,
      };
    }

    const shaped = {
      ...rest,
      location: toGeoJson(latitude, longitude),
      shopId: shopShaped,
      ownerId: owner,
    };

    // If there's no logged-in user, return product as-is
    if (!userId) return shaped;

    // Otherwise include whether the user liked / reviewed this product
    const [isLiked, userReview] = await Promise.all([
      this.likeService.isLiked(userId, id, "product"),
      this.reviewService.findOne(userId, id, "product"),
    ]);

    return {
      ...shaped,
      isLiked: !!isLiked,
      isReviewed: userReview || null,
    };
  }

  async update(productId: number, updateDto: UpdateProductDto): Promise<any> {
    if ("shopId" in updateDto) {
      throw new ForbiddenException(
        this.i18n.translate("auth.products.shop_cant_update", {
          lang: this.lang,
        }),
      );
    }

    Object.keys(updateDto).forEach((key) => {
      if (
        updateDto[key] === "" || // empty string
        updateDto[key] === null || // null
        typeof updateDto[key] === "undefined"
      ) {
        delete updateDto[key]; // remove it from updateData
      }
    });

    const existingProduct = await this.prisma.product.findFirst({
      where: { id: productId, isDeleted: false, isDisabled: false },
    });
    if (!existingProduct) {
      throw new NotFoundException(
        this.i18n.translate("auth.products.product_not_found", {
          lang: this.lang,
        }),
      );
    }

    const data: any = { ...updateDto };
    if ((updateDto as any).category) {
      data.categoryId = (updateDto as any).category;
      delete data.category;
    }

    if (updateDto.images && (updateDto.images as any).length > 0) {
      const entityId = existingProduct.shopId ?? existingProduct.ownerId!;
      const uploadedFiles = await this.fileUploadService.uploadProductFiles(
        updateDto.images as any,
        "shop",
        entityId,
        productId,
        "images",
      );
      const newImages = uploadedFiles.map((file) => file.url);
      data.images = [...(existingProduct.images || []), ...newImages];
    }
    if (updateDto.video) {
      const entityId = existingProduct.shopId ?? existingProduct.ownerId!;
      const uploadedVideo = await this.fileUploadService.uploadProductFiles(
        [updateDto.video] as any,
        "shop",
        entityId,
        productId,
        "video",
      );
      data.video = uploadedVideo[0].url;
    }

    if (updateDto.parameters) {
      data.searchableTags = buildSearchableTags(updateDto.parameters as any);
    }

    let updated;
    try {
      updated = await this.prisma.product.update({
        where: { id: productId },
        data,
      });
    } catch {
      throw new NotFoundException(
        this.i18n.translate("auth.products.product_not_found", {
          lang: this.lang,
        }),
      );
    }

    const { latitude, longitude, ...rest } = updated;

    return {
      message: this.i18n.translate("auth.products.updated_success", {
        lang: this.lang,
      }),
      data: {
        product: { ...rest, location: toGeoJson(latitude, longitude) },
      },
    };
  }

  async delete(productId: number, lang: string = "en"): Promise<void> {
    const existingProduct = await this.prisma.product.findFirst({
      where: { id: productId, isDeleted: false, isDisabled: false },
    });
    if (!existingProduct) {
      throw new NotFoundException(
        this.i18n.translate("auth.products.product_not_found", {
          lang: this.lang,
        }),
      );
    }
    const type = existingProduct.shopId ? "shop" : "personal";
    const entityId = existingProduct.shopId ?? existingProduct.ownerId!;
    await this.fileUploadService.deleteEntityProducts(
      type,
      entityId,
      productId,
    );
    await this.prisma.product.update({
      where: { id: productId },
      data: { isDeleted: true, images: [], video: "" },
    });
  }

  async deleteProductMedia(productId: number, media: string[]) {
    const existingProduct = await this.prisma.product.findFirst({
      where: { id: productId, isDeleted: false, isDisabled: false },
    });
    if (!existingProduct) {
      throw new NotFoundException(
        this.i18n.translate("auth.products.product_not_found", {
          lang: this.lang,
        }),
      );
    }
    if (!media || media.length === 0) {
      throw new BadRequestException(
        this.i18n.translate("auth.products.no_media_provided", {
          lang: this.lang,
        }),
      );
    }

    // Remove media files from storage
    await this.fileUploadService.deleteFiles(media);

    // Remove media from product document
    let images = existingProduct.images || [];
    let video = existingProduct.video;

    // Remove any images that match the URLs
    images = images.filter((imgUrl) => !media.includes(imgUrl));

    // Remove video if its URL is in the media array
    if (video && media.includes(video)) {
      video = "";
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: { images, video: video ?? "" },
    });

    return true;
  }

  async searchNearbyWithCategory(
    category: number,
    coordinates: [number, number],
    radius: number,
    pagination: PaginationDto,
  ) {
    return this.listingUtils.findNearbyWithCategory(
      "Product",
      category,
      coordinates,
      radius,
      pagination,
    );
  }

  async findNearbyProductShopOwnerIds(
    categoryId: number,
    coordinates: [number, number],
    radiusInMeters: number,
  ): Promise<number[]> {
    const [lng, lat] = coordinates;
    const rows = await this.prisma.$queryRaw<{ ownerId: number | null }[]>`
      SELECT DISTINCT COALESCE(s."ownerId", p."ownerId") as "ownerId"
      FROM "Product" p
      LEFT JOIN "Shop" s ON s.id = p."shopId"
      WHERE p."categoryId" = ${categoryId}
        AND p."isDeleted" = false
        AND p."isDisabled" = false
        AND (6371000 * acos(LEAST(1.0, GREATEST(-1.0,
              cos(radians(${lat})) * cos(radians(p."latitude")) * cos(radians(p."longitude") - radians(${lng}))
              + sin(radians(${lat})) * sin(radians(p."latitude"))
            )))) <= ${radiusInMeters}
    `;

    return rows.map((r) => r.ownerId).filter((id): id is number => Boolean(id));
  }

  async updateLocationByShopId(shopId: number, location: GeoJsonPoint) {
    const coords = fromGeoJson(location);
    if (!coords) return;
    await this.prisma.product.updateMany({
      where: { shopId },
      data: { latitude: coords.latitude, longitude: coords.longitude },
    });
  }

  async setDisabledByShop(shopId: number, disabled: boolean) {
    await this.prisma.product.updateMany({
      where: { shopId },
      data: { isDisabled: disabled },
    });
  }

  async setProductsDisabledByShopsBulk(shopIds: number[], disabled: boolean) {
    await this.prisma.product.updateMany({
      where: { shopId: { in: shopIds } },
      data: { isDisabled: disabled },
    });
  }

  async setProductsDisabledByUser(userId: number, disabled: boolean) {
    await this.prisma.product.updateMany({
      where: { ownerId: userId },
      data: { isDisabled: disabled },
    });
  }

  async searchProducts(query: SearchAllProductsServiceDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 10);
    const skip = (page - 1) * limit;

    const allPromotedIds = await this.promotionService.getActivePromotionProductIds();

    const baseWhere: Prisma.ProductWhereInput = {
      isDeleted: false,
      isDisabled: false,
    };
    if (query.category) {
      baseWhere.categoryId = query.category;
    }

    const searchTerm = query.name?.trim();

    // === Promoted Products ===
    const promotedProducts = await this.prisma.product.findMany({
      where: { id: { in: allPromotedIds }, ...baseWhere },
      orderBy: { createdAt: "desc" },
    });
    const promotedProductIds = promotedProducts.map((p) => p.id);

    // === Regular Products ===
    const categoryFilter = query.category
      ? Prisma.sql`AND p."categoryId" = ${query.category}`
      : Prisma.empty;
    const excludeFilter =
      promotedProductIds.length > 0
        ? Prisma.sql`AND p.id != ALL(${promotedProductIds})`
        : Prisma.empty;
    const searchFilter = searchTerm
      ? Prisma.sql`AND (
          p.title ILIKE ${"%" + searchTerm + "%"}
          OR p.description ILIKE ${"%" + searchTerm + "%"}
          OR EXISTS (SELECT 1 FROM unnest(p."searchableTags") tag WHERE tag ILIKE ${"%" + searchTerm + "%"})
        )`
      : Prisma.empty;

    const regularRows = await this.prisma.$queryRaw<any[]>`
      SELECT p.*, row_to_json(c.*) as "categoryJson"
      FROM "Product" p
      LEFT JOIN "Category" c ON c.id = p."categoryId"
      WHERE p."isDeleted" = false AND p."isDisabled" = false
        ${categoryFilter}
        ${excludeFilter}
        ${searchFilter}
      ORDER BY p."createdAt" DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    const totalResult = await this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) as total
      FROM "Product" p
      WHERE p."isDeleted" = false AND p."isDisabled" = false
        ${categoryFilter}
        ${excludeFilter}
        ${searchFilter}
    `;
    const total = Number(totalResult[0]?.total ?? 0);

    const regularProducts = regularRows.map((row) => {
      const { categoryJson, categoryId, latitude, longitude, ...rest } = row;
      return { ...rest, location: toGeoJson(latitude, longitude), category: categoryJson };
    });

    const promotedShaped = promotedProducts.map((p: any) => {
      const { latitude, longitude, ...rest } = p;
      return { ...rest, location: toGeoJson(latitude, longitude) };
    });

    const [enrichedPromotions, enrichedRegularProducts] = await Promise.all([
      this.enrichProductsWithReviewStats(promotedShaped),
      this.enrichProductsWithReviewStats(regularProducts),
    ]);

    return {
      data: {
        promotions: enrichedPromotions,
        items: enrichedRegularProducts,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async enrichProductsWithReviewStats(products: any[]) {
    if (!products || products.length === 0) {
      return products;
    }

    const productIds = products.map((product) => product.id);
    const reviewStats = await this.reviewService.getAverageRatingsForItems(
      productIds,
      "product",
    );

    const reviewMap = new Map(
      reviewStats.map((item: any) => [
        item._id,
        {
          avgRating: item.avgRating ?? 0,
          reviewCount: item.count ?? 0,
        },
      ]),
    );

    return products.map((product: any) => {
      const stats = reviewMap.get(product.id);
      return {
        ...product,
        averageRating: stats?.avgRating
          ? Number(stats.avgRating.toFixed(1))
          : 0,
        reviewCount: stats?.reviewCount ?? 0,
      };
    });
  }

  async getProductsWithVideos(
    paginationDto: PaginationDto,
    userId?: number,
    category?: number,
  ): Promise<PaginatedResponseDto<any>> {
    const page = Number(paginationDto.page) || 1;
    const limit = Number(paginationDto.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      AND: [{ video: { not: null } }, { video: { not: "" } }],
      isDeleted: false,
      isDisabled: false,
    };
    if (category) {
      where.categoryId = Number(category);
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          shop: {
            select: {
              id: true,
              title: true,
              image: true,
              address: true,
              description: true,
              ownerId: true,
              banner: true,
              latitude: true,
              longitude: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              image: true,
              address: true,
              phone: true,
              latitude: true,
              longitude: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    let data = items.map((item: any) => {
      const { shop, owner, shopId, ownerId, categoryId, latitude, longitude, ...rest } = item;
      const shopShaped = shop
        ? (() => {
          const { latitude: sLat, longitude: sLng, ...shopRest } = shop;
          return { ...shopRest, location: toGeoJson(sLat, sLng) };
        })()
        : null;
      const ownerShaped = owner
        ? (() => {
          const { latitude: oLat, longitude: oLng, ...ownerRest } = owner;
          return { ...ownerRest, location: toGeoJson(oLat, oLng) };
        })()
        : null;
      return {
        ...rest,
        shopId: shopShaped,
        ownerId: ownerShaped,
        location: toGeoJson(latitude, longitude),
      };
    });

    if (!userId) {
      return {
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        data,
      };
    }

    const user = await this.userService.findUserById(userId);
    if (!user) {
      throw new NotFoundException(
        this.i18n.translate("auth.users.user_not_found", {
          lang: this.lang,
        }),
      );
    }

    const productIds = items.map((item) => item.id);
    const likes = await this.likeService.getLikesByUser(
      userId,
      "product",
      productIds,
    );

    const likedProductIds = new Set(likes.map((like: any) => like.itemId));

    data = data.map((item: any) => ({
      ...item,
      isLiked: likedProductIds.has(item.id),
    }));

    return {
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data,
    };
  }
}
