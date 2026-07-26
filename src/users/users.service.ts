import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreateUpdateUserDto } from "./dto/create-update-User.dto";
import { AppError } from "src/common/exceptions/app-error";
import * as bcrypt from "bcryptjs";
import { I18nService } from "nestjs-i18n";
import { PaginatedResponseDto } from "src/common/dto/pagination-response.dto";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { FileUploadService } from "src/common/file-upload/file-upload.service";
import { Inject, forwardRef } from "@nestjs/common";
import { UpdateUserDto } from "./dto/update-user.dto";
import { ClsService } from "nestjs-cls";
import { ShopService } from "src/shop/shop.service";
import { ProductsService } from "src/products/products.service";
import { ServicesService } from "src/services/services.service";
import { PrismaService } from "src/core/prisma/prisma.service";
import { fromGeoJson, toGeoJson } from "src/common/utils/location-formatter";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileUploadService: FileUploadService,
    private readonly i18n: I18nService,
    private readonly cls: ClsService, //
    @Inject(forwardRef(() => ShopService))
    private readonly shopService: ShopService,
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
    @Inject(forwardRef(() => ServicesService))
    private readonly servicesService: ServicesService,
  ) { }

  private get lang(): string {
    return this.cls?.get("lang") ?? "en";
  }

  /** Shapes a raw Prisma User row into the {..., location} shape callers expect. */
  private shape<T extends { latitude: number | null; longitude: number | null }>(
    user: T,
  ) {
    const { latitude, longitude, ...rest } = user as any;
    return { ...rest, location: toGeoJson(latitude, longitude) };
  }

  async createUser(createUserDto: CreateUpdateUserDto) {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: createUserDto.email },
      });
      if (existingUser) {
        throw new ConflictException(
          this.i18n.translate("auth.users.email_already_registered", {
            lang: this.lang,
          }),
        );
      }
      const hashedPassword = await this.hashPassword(createUserDto.password);
      const { location, image, isVerified, roles, ...rest } = createUserDto;
      const coords = fromGeoJson(location as any);

      // The signup form is submitted as multipart/form-data (it carries the
      // profile image), so every field — including booleans and arrays —
      // arrives as a plain string (e.g. isVerified: "true", roles: "buyer").
      // No global transform pipe is registered, so they must be coerced here
      // before reaching Prisma, which requires the real Boolean/enum-array types.
      const isVerifiedBool =
        typeof isVerified === "string" ? isVerified === "true" : !!isVerified;
      const rolesArray = Array.isArray(roles)
        ? roles
        : roles
          ? [roles]
          : ["buyer"];

      let savedUser = await this.prisma.user.create({
        data: {
          ...rest,
          isVerified: isVerifiedBool,
          roles: rolesArray as any,
          image: "default-avatar.png",
          password: hashedPassword,
          ...(coords ?? {}),
        },
      });

      if (image) {
        const imageUrl = await this.fileUploadService.uploadUserImage(
          savedUser.id,
          image,
        );
        savedUser = await this.prisma.user.update({
          where: { id: savedUser.id },
          data: { image: imageUrl },
        });
      }

      return {
        message: this.i18n.translate("auth.users.created_success", {
          lang: this.lang,
        }),
        data: this.shape(savedUser),
      };
    } catch (err) {
      throw err instanceof HttpException
        ? err
        : new AppError(err?.message || "Internal server error");
    }
  }

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt();
    return await bcrypt.hash(password, salt);
  }

  async findUserByEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    return this.shape(user);
  }

  async findByResetToken(resetPasswordToken: string) {
    const user = await this.prisma.user.findFirst({
      where: { resetPasswordToken },
    });
    if (!user) {
      throw new NotFoundException(
        this.i18n.translate("auth.users.user_not_found", { lang: this.lang }),
      );
    }
    return this.shape(user);
  }

  async validateUserForLogin(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return false;
    }

    const isMatch = await bcrypt.compare(password, user.password ?? "");
    if (!isMatch) {
      return false;
    }

    return this.shape(user);
  }

  async updateUser(
    userId: number,
    updateData: Partial<UpdateUserDto>,
  ): Promise<{ message: string; data: any }> {
    try {
      // Remove empty, null, or undefined fields
      Object.keys(updateData).forEach((key) => {
        if (
          updateData[key] === "" ||
          updateData[key] === null ||
          typeof updateData[key] === "undefined"
        ) {
          delete updateData[key];
        }
      });

      // Handle password hashing
      if (updateData.password) {
        const salt = await bcrypt.genSalt();
        updateData.password = await bcrypt.hash(updateData.password, salt);
      }

      const existingUser = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!existingUser) {
        throw new NotFoundException(
          this.i18n.translate("auth.users.user_not_found", { lang: this.lang }),
        );
      }

      // Handle image only if a new one is provided
      let imageUrl = existingUser.image || "default-avatar.png";
      if (
        updateData.image &&
        typeof updateData.image === "object" &&
        "buffer" in updateData.image &&
        "originalname" in updateData.image
      ) {
        // It's a file object (from Multer)
        imageUrl = await this.fileUploadService.uploadUserImage(
          userId,
          updateData.image,
        );
      }

      const { location: newLocation, ...restUpdate } = updateData;
      (restUpdate as any).image = imageUrl;
      const coords = fromGeoJson(newLocation as any);
      if (coords) {
        (restUpdate as any).latitude = coords.latitude;
        (restUpdate as any).longitude = coords.longitude;
      }

      // This endpoint is submitted as multipart/form-data (it carries the
      // profile image), so `roles` can arrive as a bare string (e.g.
      // "buyer") instead of an array — Prisma requires the real Role[] type.
      if (restUpdate.roles !== undefined && !Array.isArray(restUpdate.roles)) {
        (restUpdate as any).roles = [restUpdate.roles];
      }

      // NOTE: intentionally preserves a pre-existing bug — the original
      // Mongoose `findByIdAndUpdate` call here omits `{new: true}`, so it
      // (and this port) returns the PRE-update snapshot, not the saved one.
      const staleSnapshot = this.shape(existingUser);

      await this.prisma.user.update({
        where: { id: userId },
        data: restUpdate as any,
      });

      return {
        message: this.i18n.translate("auth.users.updated_success", {
          lang: this.lang,
        }),
        data: staleSnapshot,
      };
    } catch (err) {
      throw new AppError(err);
    }
  }

  async findByIdWithToken(userId: number, lang: string = "en") {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(
        this.i18n.translate("users.user_not_found", { lang }),
      );
    }

    return this.shape(user);
  }

  async findUserById(userId: number, lang: string = "en") {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(
        this.i18n.translate("auth.users.user_not_found", { lang }),
      );
    }

    return this.shape(user);
  }

  async getAllUsers(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<any>> {
    // page/limit arrive from @Query() as raw strings (no global transform
    // pipe is registered), so they must be coerced before reaching Prisma —
    // passing a string to `take` throws a Prisma validation error.
    const { search } = paginationDto;
    const page = Math.max(1, Number(paginationDto.page) || 1);
    const limit = Math.max(1, Number(paginationDto.limit) || 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search?.trim()) {
      where.name = { contains: search.trim(), mode: "insensitive" };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip, take: limit }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => this.shape(u)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async saveFcmToken(userId: number, token: string) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken: token },
    });
    return this.shape(user);
  }

  async disableAccount(userId: number): Promise<{ message: string; data: any }> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException(
          this.i18n.translate("auth.users.user_not_found", { lang: this.lang }),
        );
      }

      // disable user
      await this.prisma.user.update({
        where: { id: userId },
        data: { isDisabled: true },
      });

      // fetch all shops for user and disable them and their products
      const shops = await this.shopService.getAllShopsByUser(userId);

      if (shops.length > 0) {
        const shopIds = shops.map((shop) => (shop as any)._id ?? (shop as any).id);

        // Bulk disable shops and products in parallel
        await Promise.all([
          this.shopService.setShopsDisabledBulk(shopIds, true),
          this.productsService.setProductsDisabledByShopsBulk(shopIds, true),
        ]);
      }

      await this.productsService.setProductsDisabledByUser(userId, true);

      // disable services owned by user
      await this.servicesService.setDisabledByOwner(userId, true);

      return {
        message: this.i18n.translate("auth.users.account_disabled", {
          lang: this.lang,
        }),
        data: this.shape(user),
      };
    } catch (err) {
      throw err instanceof HttpException ? err : new AppError(err);
    }
  }

  async reactivateAccount(userId: number): Promise<{ message: string; data: any }> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException(
          this.i18n.translate("auth.users.user_not_found", { lang: this.lang }),
        );
      }

      // reactivate user
      await this.prisma.user.update({
        where: { id: userId },
        data: { isDisabled: false },
      });

      // fetch all shops for user and enable them and their products
      const shops = await this.shopService.getAllShopsByUser(userId);

      if (shops.length > 0) {
        const shopIds = shops.map((shop) => (shop as any)._id ?? (shop as any).id);

        // Bulk enable shops and products in parallel
        await Promise.all([
          this.shopService.setShopsDisabledBulk(shopIds, false),
          this.productsService.setProductsDisabledByShopsBulk(shopIds, false),
        ]);
      }

      // enable services owned by user
      await this.servicesService.setDisabledByOwner(userId, false);

      await this.productsService.setProductsDisabledByUser(userId, false);

      return {
        message: this.i18n.translate("auth.users.account_reactivated", {
          lang: this.lang,
        }),
        data: this.shape(user),
      };
    } catch (err) {
      throw err instanceof HttpException
        ? err
        : new AppError(err?.message || "Internal server error");
    }
  }
}
