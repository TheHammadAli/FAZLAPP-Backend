// src/categories/category.service.ts
import { Injectable, NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import { I18nService } from "nestjs-i18n";
import { ClsService } from "nestjs-cls";
import { PrismaService } from "src/core/prisma/prisma.service";
import { Prisma } from "src/generated/prisma/client";
import { CreateUpdateCategoryDto } from "./dto/category-create-update.dto";
import { CreateCategoryRequestDto } from "./dto/category-request.dto";
import { ReviewCategoryRequestDto } from "./dto/review-category.dto";

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly cls: ClsService,
  ) { }

  private getLocalizedValue = (
    field: Record<string, string> | undefined,
    lang = "en",
  ) => {
    return field?.[lang] || field?.["en"] || "";
  };

  private get lang(): string {
    return this.cls?.get("lang") ?? "en";
  }

  /**
   * Safely handles both string (JSON) and object for parameters field
   */
  private normalizeParameters(parameters: any): any {
    if (!parameters) return {};

    if (typeof parameters === "object" && parameters !== null && !Array.isArray(parameters)) {
      return parameters;
    }

    if (typeof parameters === "string") {
      try {
        const parsed = JSON.parse(parameters);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        throw new BadRequestException(
          this.i18n.translate("category.invalid_parameters_format", { lang: this.lang })
        );
      }
    }

    throw new BadRequestException(
      this.i18n.translate("category.invalid_parameters_format", { lang: this.lang })
    );
  }

  /**
   * Check duplicate name (supports both string and object)
   */
  private async checkDuplicateName(nameInput: any, excludeId?: number) {
    let nameEn: string | undefined;
    let nameUr: string | undefined;

    // Handle object format (from Category)
    if (typeof nameInput === "object" && nameInput !== null) {
      nameEn = nameInput.en?.trim();
      nameUr = nameInput.ur?.trim();
    }
    // Handle string format (from CategoryRequest)
    else if (typeof nameInput === "string") {
      nameEn = nameInput.trim();
    }

    if (!nameEn && !nameUr) return;

    const baseWhere: Prisma.CategoryWhereInput = { isDisabled: false };

    if (excludeId) {
      baseWhere.id = { not: excludeId };
    }

    // Check English name
    if (nameEn) {
      const existingEn = await this.prisma.category.findFirst({
        where: { ...baseWhere, name: { path: ["en"], equals: nameEn } },
      });
      if (existingEn) {
        throw new ConflictException(
          this.i18n.translate("auth.category.name_already_exists", { lang: this.lang })
        );
      }
    }

    // Check Urdu name (only if available)
    if (nameUr) {
      const existingUr = await this.prisma.category.findFirst({
        where: { ...baseWhere, name: { path: ["ur"], equals: nameUr } },
      });
      if (existingUr) {
        throw new ConflictException(
          this.i18n.translate("auth.category.urdu_name_already_exists", { lang: this.lang })
        );
      }
    }
  }

  async create(dto: CreateUpdateCategoryDto) {
    try {
      await this.checkDuplicateName(dto.name);

      const normalizedDto = {
        ...dto,
        parameters: this.normalizeParameters(dto.parameters),
      };

      return await this.prisma.category.create({ data: normalizedDto as any });
    } catch (error: any) {
      if (error instanceof ConflictException) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientValidationError ||
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      ) {
        throw new BadRequestException(
          this.i18n.translate("category.validation_failed", { lang: this.lang })
        );
      }

      throw error;
    }
  }

  async update(id: number, dto: CreateUpdateCategoryDto) {
    try {
      await this.checkDuplicateName(dto.name, id);

      const normalizedDto = {
        ...dto,
        parameters: this.normalizeParameters(dto.parameters),
      };

      try {
        return await this.prisma.category.update({
          where: { id },
          data: normalizedDto as any,
        });
      } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          throw new NotFoundException(
            this.i18n.translate("auth.category.category_not_found", { lang: this.lang })
          );
        }
        throw error;
      }
    } catch (error: any) {
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientValidationError) {
        throw new BadRequestException(
          this.i18n.translate("auth.category.validation_failed", { lang: this.lang })
        );
      }

      throw error;
    }
  }

  async findAllForAdmin() {
    return this.prisma.category.findMany({ orderBy: { sortNumber: "asc" } });
  }

  async findAll(type?: string) {
    const where: Prisma.CategoryWhereInput = { isDisabled: false };
    if (type) {
      where.type = type as any;
    }

    const categories = await this.prisma.category.findMany({
      where,
      orderBy: { sortNumber: "asc" },
    });

    return {
      data: categories.map((cat) => ({
        ...cat,
        name: this.getLocalizedValue(cat?.name as any, this.lang),
        description: this.getLocalizedValue(cat?.description as any, this.lang),
      })),
      message: this.i18n.translate("category.fetched_success", { lang: this.lang }),
    };
  }

  async findById(id: number, lang: string = "en") {
    const category = await this.prisma.category.findFirst({
      where: { id, isDisabled: false },
    });

    if (!category)
      throw new NotFoundException(
        this.i18n.translate("auth.category.category_not_found", { lang }),
      );

    return category;
  }

  async delete(id: number): Promise<void> {
    const result = await this.prisma.category.findUnique({ where: { id } });
    if (!result)
      throw new NotFoundException(
        this.i18n.translate("auth.category.category_not_found", { lang: this.lang }),
      );

    await this.prisma.category.update({ where: { id }, data: { isDisabled: true } });
  }

  async createRequest(createDto: CreateCategoryRequestDto, userId: number) {
    return this.prisma.categoryRequest.create({
      data: {
        name: createDto.name,
        description: createDto.description,
        requestedById: userId,
      },
    });
  }

  async getPendingRequests() {
    try {
      const results = await this.prisma.categoryRequest.findMany({
        where: { status: "pending" },
        include: { requestedBy: { select: { id: true, name: true, email: true } } },
      });

      return results.map(({ requestedById, ...rest }) => rest);
    } catch (err) {
      console.error("Error populating category requests:", err);
      throw err;
    }
  }

  async reviewRequestById(
    id: number,
    reviewDto: ReviewCategoryRequestDto,
    adminId: number,
  ) {
    const request = await this.prisma.categoryRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException(this.i18n.translate("auth.category.request_not_found", { lang: this.lang }));

    const updated = await this.prisma.categoryRequest.update({
      where: { id },
      data: {
        status: reviewDto.status,
        adminComment: reviewDto.adminComment || "",
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });

    if (reviewDto.status === "approved") {
      // Fixed: Now safely handles string name from CategoryRequest
      await this.checkDuplicateName(updated.name);

      await this.prisma.category.create({
        data: {
          name: { en: updated.name },
          description: updated.description ? { en: updated.description } : undefined,
          type: "product",
        },
      });
    }

    return updated;
  }

  async getUserRequests(userId: number) {
    return this.prisma.categoryRequest.findMany({ where: { requestedById: userId } });
  }
}
