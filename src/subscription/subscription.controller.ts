import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { SubscriptionService } from "./subscription.service";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { UpdateSubscriptionDto } from "./dto/update-subscription.dto";
import { SubscriptionModel } from "src/generated/prisma/models";

@ApiTags("Subscriptions")
@Controller("subscriptions")
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post()
  @ApiOperation({ summary: "Create a subscription" })
  @ApiResponse({ status: 201, type: Object })
  async create(
    @Body() dto: CreateSubscriptionDto,
  ): Promise<SubscriptionModel> {
    return this.subscriptionService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "Get all subscriptions" })
  @ApiResponse({ status: 200, type: [Object] })
  async findAll(): Promise<SubscriptionModel[]> {
    return this.subscriptionService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get subscription by ID" })
  @ApiParam({ name: "id", description: "Subscription ID" })
  @ApiResponse({ status: 200, type: Object })
  async findById(@Param("id") id: string): Promise<SubscriptionModel> {
    return this.subscriptionService.findById(Number(id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a subscription" })
  @ApiParam({ name: "id", description: "Subscription ID" })
  @ApiResponse({ status: 200, type: Object })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateSubscriptionDto,
  ): Promise<SubscriptionModel> {
    return this.subscriptionService.update(Number(id), dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a subscription" })
  @ApiParam({ name: "id", description: "Subscription ID" })
  @ApiResponse({ status: 204, description: "Subscription deleted" })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id") id: string): Promise<void> {
    return this.subscriptionService.delete(Number(id));
  }
}
