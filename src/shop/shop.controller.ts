import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  Query,
} from "@nestjs/common";
import { ShopService } from "./shop.service";
import { CreateUpdateShopDto } from "./dto/create-update-shop.dto";
import { SearchNearbyShopDto } from "./dto/search-nearby-shop.dto";
import { JwtAuthGuard } from "../auth/guard/jwt-auth-guard";
import { Request } from "express";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { JwtPayload } from "src/auth/strategies/jwt-strategy";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiConsumes,
  ApiQuery,
  ApiResponse,
} from "@nestjs/swagger";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { Public } from "src/common/decorators/public.decorator";

@ApiTags("Shops")
@ApiBearerAuth("jwt")
@UseGuards(JwtAuthGuard)
@Controller("shops")
export class ShopController {
  constructor(private readonly shopService: ShopService) { }

  @Post("create")
  @ApiOperation({ summary: "Create a new shop" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileFieldsInterceptor([
    { name: "image", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]))
  @ApiBody({ type: CreateUpdateShopDto })
  async createShop(
    @Body() dto: CreateUpdateShopDto,
    @Req() req: Request,
    @UploadedFiles()
    files: {
      image?: Express.Multer.File[];
      banner?: Express.Multer.File[];
    },
  ) {
    const user = req.user as { sub: number };
    if (files?.image && files.image.length > 0) {
      dto.image = files.image[0];
    }
    if (files?.banner && files.banner.length > 0) {
      dto.banner = files.banner[0];
    }
    if (dto.location && typeof dto.location === "string") {
      dto.location = JSON.parse(dto.location);
    }
    return this.shopService.createShop(user.sub, dto);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update existing shop by ID" })
  @ApiParam({ name: "id", type: String })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileFieldsInterceptor([
    { name: "image", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]))
  @ApiBody({ type: CreateUpdateShopDto })
  async updateShop(
    @Param("id") id: string,
    @Body() dto: CreateUpdateShopDto,
    @UploadedFiles()
    files: {
      image?: Express.Multer.File[];
      banner?: Express.Multer.File[];
    },
  ) {
    if (files?.image && files.image.length > 0) {
      dto.image = files.image[0];
    }
    if (files?.banner && files.banner.length > 0) {
      dto.banner = files.banner[0];
    }
    if (dto.location && typeof dto.location === "string") {
      dto.location = JSON.parse(dto.location);
    }
    return this.shopService.updateShop(Number(id), dto);
  }

  @Public()
  @Get("detail/:id")
  @ApiOperation({ summary: "Get shop details by ID" })
  @ApiParam({ name: "id", type: String })
  async getShop(@Param("id") id: string) {
    return this.shopService.getShopById(Number(id));
  }

  @Get("userShops")
  @ApiOperation({ summary: "Get all shops owned by current user" })
  async getMyShops(@CurrentUser() user: JwtPayload) {
    return this.shopService.getAllShopsByUser(user.sub);
  }

  @Public()
  @Get("search/nearby")
  @ApiOperation({ summary: "Search shops near a coordinate within a radius" })
  @ApiQuery({ name: "lat", required: true, type: Number })
  @ApiQuery({ name: "lng", required: true, type: Number })
  @ApiQuery({ name: "radius", required: true, type: Number, description: "Distance in kilometers" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Paginated list of nearby shops" })
  async searchNearbyShops(@Query() query: SearchNearbyShopDto) {
    const coordinates: [number, number] = [query.lng, query.lat];
    const radiusMeters = query.radius * 1000;
    return await this.shopService.findShopsNearLocationPaginated(
      coordinates,
      radiusMeters,
      { page: query.page, limit: query.limit },
    );
  }
}
