import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Delete,
  Query,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  Put,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { PaginatedResponseDto } from "src/common/dto/pagination-response.dto";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "src/auth/guard/jwt-auth-guard";
import { FileUploadService } from "src/common/file-upload/file-upload.service";
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { Request } from "express";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { Public } from "src/common/decorators/public.decorator";
import { GetWithVideosDto } from "src/services/dto/video-with-dto";

@ApiTags("Products")
@ApiBearerAuth("jwt")
@UseGuards(JwtAuthGuard)
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @Post(":entityId/:type")
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "images", maxCount: 5 },
      { name: "video", maxCount: 1 },
    ]),
  )
  @ApiOperation({ summary: "Create a new product (shop or personal listing)" })
  @ApiConsumes("multipart/form-data")
  @ApiParam({
    name: "entityId",
    required: true,
    description: "Shop ID or User ID depending on type",
  })
  @ApiParam({
    name: "type",
    required: true,
    description: `'shop' for business listings, 'personal' for user-created listings`,
    enum: ["shop", "personal"],
  })
  @ApiBody({
    description: "Product data with optional image upload",
    type: CreateProductDto,
  })
  async createProduct(
    @Param("entityId") entityId: string,
    @Param("type") type: "shop" | "personal",
    @Req() req: Request,
    @Body() createProductDto: CreateProductDto,
    @UploadedFiles()
    files: {
      images?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ): Promise<{ message: string; data: { product: any } }> {
    if (files?.images && files.images.length > 0) {
      createProductDto.images = files.images;
    } else {
      createProductDto.images = [];
    }
    if (files?.video && files.video.length > 0) {
      createProductDto.video = files.video[0];
    } else {
      createProductDto.video = null; // Set to null if no video is uploaded
    }
    createProductDto.parameters = JSON.parse(
      createProductDto.parameters?.toString() || "[]",
    );
    createProductDto.price = Number(createProductDto.price);
    createProductDto.category = Number(createProductDto.category);

    if (Number.isNaN(createProductDto.price)) {
      throw new BadRequestException("price must be a valid number");
    }
    if (Number.isNaN(createProductDto.category)) {
      throw new BadRequestException("category must be a valid category id");
    }

    return this.productsService.create(Number(entityId), type, createProductDto);
  }

  @Public()
  @Get("shop/:shopId")
  @ApiOperation({ summary: "Get all products for a shop" })
  @ApiParam({ name: "shopId", required: true })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  async getAllByShop(
    @Param("shopId") shopId: string,
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<any>> {
    return this.productsService.getAllProductsByShop(Number(shopId), paginationDto);
  }

  @Delete(":id/media")
  @ApiOperation({ summary: "Delete selected media files for a product" })
  @ApiParam({ name: "id", description: "Product ID" })
  @ApiBody({
    schema: {
      properties: {
        media: {
          type: "array",
          items: { type: "string" },
          description: "Array of media file URLs to delete",
        },
      },
      required: ["media"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Selected product media deleted successfully",
  })
  @ApiResponse({ status: 404, description: "Product not found" })
  @ApiResponse({
    status: 400,
    description: "No media files provided for deletion",
  })
  @HttpCode(HttpStatus.OK)
  async deleteProductMedia(
    @Param("id") productId: string,
    @Body("media") media: string[],
  ) {
    if (!Array.isArray(media) || media.length === 0) {
      throw new BadRequestException("No media files provided for deletion");
    }
    await this.productsService.deleteProductMedia(Number(productId), media);
    return { message: "Selected product media deleted successfully" };
  }

  @Get("user/:userId")
  @Public()
  @ApiOperation({ summary: "Get all products for a User" })
  @ApiParam({ name: "userId", required: true })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  async getAllProductsByUser(
    @Param("userId") userId: string,
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<any>> {
    return this.productsService.getAllProductsByUser(Number(userId), paginationDto);
  }

  @Get("with-videos/all")
  @Public()
  @ApiOperation({ summary: "Get all products with videos (paginated)" })
  @ApiResponse({
    status: 200,
    description: "Paginated list of products with videos",
  })
  async getProductsWithVideos(
    @Query() query: GetWithVideosDto,
  ): Promise<PaginatedResponseDto<any>> {
    return this.productsService.getProductsWithVideos(query, query?.userId, query.category);
  }

  @Get("detail/:id")
  @Public()
  @ApiOperation({ summary: "Get product details by ID" })
  @ApiParam({ name: "id", required: true })
  @ApiQuery({ name: "userId", required: false })
  async getById(
    @Param("id") id: string,
    @Query("userId") userId?: string,
  ): Promise<any> {
    return this.productsService.getById(Number(id), userId ? Number(userId) : undefined);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update product by ID" })
  @ApiConsumes("multipart/form-data")
  @ApiParam({ name: "id", required: true })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "images", maxCount: 5 },
      { name: "video", maxCount: 1 },
    ]),
  )
  @ApiBody({ type: UpdateProductDto })
  async update(
    @Param("id") id: string,
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFiles()
    files: {
      images?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ): Promise<any> {
    if (files?.images && files.images.length > 0) {
      updateProductDto.images = files.images;
    }
    if (files?.video && files.video.length > 0) {
      updateProductDto.video = files.video[0];
    }
    if (updateProductDto.parameters !== undefined) {
      updateProductDto.parameters = JSON.parse(
        updateProductDto.parameters?.toString() || "[]",
      );
    }
    if (updateProductDto.price !== undefined) {
      updateProductDto.price = Number(updateProductDto.price);
      if (Number.isNaN(updateProductDto.price)) {
        throw new BadRequestException("price must be a valid number");
      }
    }
    if (updateProductDto.category !== undefined) {
      updateProductDto.category = Number(updateProductDto.category);
      if (Number.isNaN(updateProductDto.category)) {
        throw new BadRequestException("category must be a valid category id");
      }
    }

    return this.productsService.update(Number(id), updateProductDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete product by ID" })
  @ApiParam({ name: "id", required: true })
  async delete(@Param("id") id: string): Promise<{ message: string }> {
    await this.productsService.delete(Number(id));
    return { message: "Product deleted successfully" };
  }
}
