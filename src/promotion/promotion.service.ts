import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { I18nService } from "nestjs-i18n";
import { PrismaService } from "src/core/prisma/prisma.service";
import { PromotionModel } from "src/generated/prisma/models";
import { CreatePromotionDto } from "./dto/create-promotion.dto";
import { UpdatePromotionDto } from "./dto/update-promotion.dto";

@Injectable()
export class PromotionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async create(
    dto: CreatePromotionDto,
    lang: string = "en",
  ): Promise<PromotionModel> {
    // Validate targetType
    if (!["Product", "Shop"].includes(dto.targetType)) {
      throw new BadRequestException(
        this.i18n.translate("promotion.invalid_target_type", { lang }),
      );
    }
    return this.prisma.promotion.create({ data: dto });
  }

  async findAll(): Promise<PromotionModel[]> {
    return this.prisma.promotion.findMany({ orderBy: { createdAt: "desc" } });
  }

  async findById(id: number, lang: string = "en"): Promise<PromotionModel> {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo)
      throw new NotFoundException(
        this.i18n.translate("promotion.promotion_not_found", { lang }),
      );
    return promo;
  }

  async update(
    id: number,
    dto: UpdatePromotionDto,
    lang: string = "en",
  ): Promise<PromotionModel> {
    try {
      return await this.prisma.promotion.update({ where: { id }, data: dto });
    } catch {
      throw new NotFoundException(
        this.i18n.translate("promotion.promotion_not_found", { lang }),
      );
    }
  }

  async delete(id: number, lang: string = "en"): Promise<void> {
    try {
      await this.prisma.promotion.delete({ where: { id } });
    } catch {
      throw new NotFoundException(
        this.i18n.translate("promotion.promotion_not_found", { lang }),
      );
    }
  }

  async getFeedPromotions(): Promise<PromotionModel[]> {
    return this.prisma.promotion.findMany({
      where: { isInFeed: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getActivePromotionProductIds(): Promise<number[]> {
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const promotions = await this.prisma.promotion.findMany({
      where: {
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay },
      },
    });

    return promotions.map((p) => p.targetId);
  }
}
