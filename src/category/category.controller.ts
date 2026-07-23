import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Query,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CategoryService } from "./category.service";
import { CreateUpdateCategoryDto } from "./dto/category-create-update.dto";
import { JwtAuthGuard } from "src/auth/guard/jwt-auth-guard";
import { CreateCategoryRequestDto } from "./dto/category-request.dto";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { JwtPayload } from "src/auth/strategies/jwt-strategy";
import { ReviewCategoryRequestDto } from "./dto/review-category.dto";
import { FileUploadService } from "src/common/file-upload/file-upload.service";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiHeader,
  ApiQuery,
  ApiConsumes,
} from "@nestjs/swagger";
import { Public } from "src/common/decorators/public.decorator";

@ApiTags("Categories")
@ApiBearerAuth("jwt")
@UseGuards(JwtAuthGuard)
@Controller("categories")
export class CategoryController {
  constructor(
    private readonly categoryService: CategoryService,
    private readonly fileUploadService: FileUploadService,
  ) { }

  @Post()
  @ApiOperation({ summary: "Create a new category (admin only)" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("icon"))
  @ApiBody({ type: CreateUpdateCategoryDto })
  @ApiResponse({ status: 201, description: "Category created successfully" })
  async create(
    @Body() dto: CreateUpdateCategoryDto,
    @UploadedFile() icon?: any,
  ) {
    if (typeof dto.name === "string") {
      dto.name = JSON.parse(dto.name);
    }
    if (dto.description && typeof dto.description === "string") {
      dto.description = JSON.parse(dto.description);
    }
    if (icon) {
      dto.icon = await this.fileUploadService.uploadCategoryIcon(icon);
    }
    return this.categoryService.create(dto);
  }

  @Get()
  @Public()
  @ApiHeader({
    name: "Accept-Language",
    required: false,
    description: "Language code",
    example: "en",
  })
  @ApiOperation({ summary: "Get all categories" })
  @ApiQuery({ name: "type", required: false, description: "Filter by category type", enum: ["product", "service"] })
  @ApiResponse({ status: 200, description: "List of categories" })
  findAll(@Query("type") type?: string) {
    return this.categoryService.findAll(type);
  }


  @Get("admin")

  @ApiOperation({ summary: "Get all categories for admin" })
  @ApiResponse({ status: 200, description: "List of categories" })
  findAllAdmin() {
    return this.categoryService.findAllForAdmin();
  }

  @Get("detail/:id")
  @ApiHeader({
    name: "Accept-Language",
    required: false,
    description: "Language code",
    example: "en",
  })
  @ApiOperation({ summary: "Get category by ID" })
  @ApiResponse({ status: 200, description: "Category found" })
  @ApiResponse({ status: 404, description: "Category not found" })
  findById(@Param("id") id: string) {
    return this.categoryService.findById(Number(id));
  }

  @Put(":id")
  @ApiOperation({ summary: "Update an existing category (admin only)" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("icon"))
  @ApiBody({ type: CreateUpdateCategoryDto })
  async update(
    @Param("id") id: string,
    @Body() dto: CreateUpdateCategoryDto,
    @UploadedFile() icon?: any,
  ) {
    if (typeof dto.name === "string") {
      dto.name = JSON.parse(dto.name);
    }
    if (dto.description && typeof dto.description === "string") {
      dto.description = JSON.parse(dto.description);
    }
    if (icon) {
      dto.icon = await this.fileUploadService.uploadCategoryIcon(icon);
    }
    return this.categoryService.update(Number(id), dto);
  }

  // @Delete(":id")
  // @ApiOperation({ summary: "Delete a category by ID (admin only)" })
  // delete(@Param("id") id: string) {
  //   return this.categoryService.delete(id);
  // }

  @Post("request")
  @ApiOperation({ summary: "Request a new category (user)" })
  @ApiBody({ type: CreateCategoryRequestDto })
  async createRequest(
    @Body() dto: CreateCategoryRequestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.categoryService.createRequest(dto, user.sub);
  }

  @Get("pending")
  @ApiOperation({ summary: "Get all pending category requests (admin only)" })
  async getPendingRequests() {
    return this.categoryService.getPendingRequests();
  }

  @Put("review/:id")
  @ApiOperation({ summary: "Review a pending category request (admin only)" })
  @ApiBody({ type: ReviewCategoryRequestDto })
  async reviewRequest(
    @Param("id") id: string,
    @Body() dto: ReviewCategoryRequestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.categoryService.reviewRequestById(Number(id), dto, user.sub);
  }
}
