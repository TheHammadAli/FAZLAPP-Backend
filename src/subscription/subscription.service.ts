import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/core/prisma/prisma.service";
import { SubscriptionModel } from "src/generated/prisma/models";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { UpdateSubscriptionDto } from "./dto/update-subscription.dto";

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubscriptionDto): Promise<SubscriptionModel> {
    return this.prisma.subscription.create({ data: dto });
  }

  async findAll(): Promise<SubscriptionModel[]> {
    return this.prisma.subscription.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: number): Promise<SubscriptionModel> {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException("Subscription not found");
    return sub;
  }

  async update(
    id: number,
    dto: UpdateSubscriptionDto,
  ): Promise<SubscriptionModel> {
    try {
      return await this.prisma.subscription.update({
        where: { id },
        data: dto,
      });
    } catch {
      throw new NotFoundException("Subscription not found");
    }
  }

  async delete(id: number): Promise<void> {
    try {
      await this.prisma.subscription.delete({ where: { id } });
    } catch {
      throw new NotFoundException("Subscription not found");
    }
  }
}
