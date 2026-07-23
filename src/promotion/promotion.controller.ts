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
import { PromotionService } from "./promotion.service";
import { CreatePromotionDto } from "./dto/create-promotion.dto";
import { UpdatePromotionDto } from "./dto/update-promotion.dto";
import { PromotionModel } from "src/generated/prisma/models";

@ApiTags("Promotions")
@Controller("promotions")
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Post()
  @ApiOperation({ summary: "Create a promotion" })
  @ApiResponse({ status: 201, type: Object })
  async create(@Body() dto: CreatePromotionDto): Promise<PromotionModel> {
    return this.promotionService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "Get all promotions" })
  @ApiResponse({ status: 200, type: [Object] })
  async findAll(): Promise<PromotionModel[]> {
    return this.promotionService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get promotion by ID" })
  @ApiParam({ name: "id", description: "Promotion ID" })
  @ApiResponse({ status: 200, type: Object })
  async findById(@Param("id") id: string): Promise<PromotionModel> {
    return this.promotionService.findById(Number(id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a promotion" })
  @ApiParam({ name: "id", description: "Promotion ID" })
  @ApiResponse({ status: 200, type: Object })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdatePromotionDto,
  ): Promise<PromotionModel> {
    return this.promotionService.update(Number(id), dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a promotion" })
  @ApiParam({ name: "id", description: "Promotion ID" })
  @ApiResponse({ status: 204, description: "Promotion deleted" })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id") id: string): Promise<void> {
    return this.promotionService.delete(Number(id));
  }

  @Get("feed")
  @ApiOperation({
    summary: "Get feed promotions",
    description: "Fetches all promotions where isInFeed is true.",
  })
  @ApiResponse({
    status: 200,
    description: "Feed promotions found.",
    type: [Object],
  })
  async getFeedPromotions(): Promise<PromotionModel[]> {
    return this.promotionService.getFeedPromotions();
  }
}
