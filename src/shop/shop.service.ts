import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { PaginatedResponseDto } from "src/common/dto/pagination-response.dto";
import { I18nService } from "nestjs-i18n";
import { PrismaService } from "src/core/prisma/prisma.service";
import { CreateUpdateShopDto } from "./dto/create-update-shop.dto";
import { ProductsService } from "src/products/products.service";
import { UsersService } from "src/users/users.service";
import { FileUploadService } from "src/common/file-upload/file-upload.service";
import { ClsService } from "nestjs-cls";
import { OrdersService } from "src/orders/orders.service";
import { fromGeoJson, toGeoJson } from "src/common/utils/location-formatter";

@Injectable()
export class ShopService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly fileUploadService: FileUploadService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly i18n: I18nService,
    private readonly cls: ClsService,
  ) { }
  private get lang(): string {
    return this.cls?.get("lang") ?? "en";
  }

  private shape<T extends { latitude: number; longitude: number }>(shop: T) {
    const { latitude, longitude, ...rest } = shop as any;
    return { ...rest, location: toGeoJson(latitude, longitude) };
  }

  async createShop(ownerId: number, dto: CreateUpdateShopDto) {
    const existingUser = await this.usersService.findUserById(ownerId);
    if (!existingUser) {
      throw new NotFoundException(
        this.i18n.translate("auth.shop.user_not_found", { lang: this.lang }),
      );
    }
    const {
      image: imageFile,
      banner: bannerFile,
      location,
      ...shopDto
    } = dto as any;
    const coords = fromGeoJson(location);

    let shop = await this.prisma.shop.create({
      data: { ...shopDto, ownerId, ...(coords ?? {}) },
    });

    const updatePayload: Record<string, any> = {};

    if (imageFile) {
      updatePayload.image = await this.fileUploadService.uploadShopImage(
        shop.id,
        imageFile,
      );
    }

    if (bannerFile) {
      updatePayload.banner = await this.fileUploadService.uploadShopBanner(
        shop.id,
        bannerFile,
      );
    }

    if (Object.keys(updatePayload).length > 0) {
      shop = await this.prisma.shop.update({
        where: { id: shop.id },
        data: updatePayload,
      });
    }

    return {
      message: this.i18n.translate("auth.shop.created_success", {
        lang: this.lang,
      }),
      data: this.shape(shop),
    };
  }

  async updateShop(
    shopId: number,
    dto: CreateUpdateShopDto,
  ): Promise<{ message: string; data: any }> {
    const { location, ...safeDto } = dto as any;
    const existingShop = await this.prisma.shop.findUnique({
      where: { id: shopId },
    });
    if (!existingShop) {
      throw new NotFoundException(
        this.i18n.translate("auth.shop.shop_not_found", { lang: this.lang }),
      );
    }

    if (dto.image) {
      safeDto.image = await this.fileUploadService.uploadShopImage(
        shopId,
        dto.image,
      );
    }
    if (dto.banner) {
      safeDto.banner = await this.fileUploadService.uploadShopBanner(
        shopId,
        dto.banner,
      );
    }

    const coords = fromGeoJson(location);
    if (coords) {
      safeDto.latitude = coords.latitude;
      safeDto.longitude = coords.longitude;
    }

    const updated = await this.prisma.shop.update({
      where: { id: shopId },
      data: safeDto,
    });

    if (coords) {
      this.productsService.updateLocationByShopId(shopId, location);
    }

    return {
      message: this.i18n.translate("auth.shop.updated_success", {
        lang: this.lang,
      }),
      data: this.shape(updated),
    };
  }

  async getShopById(shopId: number) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      include: { owner: { select: { id: true, name: true, email: true } } },
    });

    if (!shop) {
      throw new NotFoundException(
        this.i18n.translate("auth.shop.shop_not_found", { lang: this.lang }),
      );
    }

    const productsCount = await this.productsService.getAllProductsByShop(
      shopId,
      { page: 1, limit: 1 },
    );
    const ordersCount = await this.ordersService.getOrdersByOwner(
      shopId,
      "Shop",
      1,
      1,
    );

    const { ownerId, owner, latitude, longitude, ...rest } = shop as any;

    return {
      ...rest,
      ownerId: owner,
      location: toGeoJson(latitude, longitude),
      productsCount: productsCount.meta.total,
      ordersCount: ordersCount.meta.total,
    };
  }

  async getAllShopsByUser(userId: number) {
    const shops = await this.prisma.shop.findMany({ where: { ownerId: userId } });
    return shops.map((s) => this.shape(s));
  }

  async setShopDisabled(shopId: number, disabled: boolean) {
    await this.prisma.shop.update({
      where: { id: shopId },
      data: { isDisabled: disabled },
    });
  }

  async setShopsDisabledBulk(shopIds: number[], disabled: boolean) {
    await this.prisma.shop.updateMany({
      where: { id: { in: shopIds } },
      data: { isDisabled: disabled },
    });
  }

  // Original simple near-query kept for backward compatibility
  async findShopsNearLocation(location: [number, number], radiusInMeters: number) {
    const [lng, lat] = location;
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT *
      FROM "Shop"
      WHERE "isDisabled" = false
        AND (6371000 * acos(LEAST(1.0, GREATEST(-1.0,
              cos(radians(${lat})) * cos(radians("latitude")) * cos(radians("longitude") - radians(${lng}))
              + sin(radians(${lat})) * sin(radians("latitude"))
            )))) <= ${radiusInMeters}
    `;
    return rows.map((row) => this.shape(row));
  }

  // New paginated geo search that returns meta and data
  async findShopsNearLocationPaginated(
    location: [number, number],
    radiusInMeters: number,
    pagination?: PaginationDto,
  ): Promise<PaginatedResponseDto<any>> {
    const { page = 1, limit = 10 } = pagination || {};
    const skip = (page - 1) * limit;
    const [lng, lat] = location;

    // NOTE: the original Mongo query filtered on `isDeleted`, a field that
    // was never defined on the Shop schema — meaning this endpoint always
    // returned zero results in production. Fixed per decision: the phantom
    // filter is dropped here rather than replicated.
    const data = await this.prisma.$queryRaw<any[]>`
      SELECT *
      FROM "Shop"
      WHERE (6371000 * acos(LEAST(1.0, GREATEST(-1.0,
              cos(radians(${lat})) * cos(radians("latitude")) * cos(radians("longitude") - radians(${lng}))
              + sin(radians(${lat})) * sin(radians("latitude"))
            )))) <= ${radiusInMeters}
      ORDER BY "createdAt" DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    const countResult = await this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) as total
      FROM "Shop"
      WHERE (6371000 * acos(LEAST(1.0, GREATEST(-1.0,
              cos(radians(${lat})) * cos(radians("latitude")) * cos(radians("longitude") - radians(${lng}))
              + sin(radians(${lat})) * sin(radians("latitude"))
            )))) <= ${radiusInMeters}
    `;

    const total = Number(countResult[0]?.total ?? 0);

    return {
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      data: data.map((row) => this.shape(row)),
    };
  }
}
