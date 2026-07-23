import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
  Patch,
  Req,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from "@nestjs/common";
import { ServicesService } from "./services.service";
import { CreateServiceDto } from "./dto/create-service.dto";
import { UpdateServiceDto } from "./dto/update-service.dto";
import { PaginatedResponseDto } from "src/common/dto/pagination-response.dto";
import { JwtAuthGuard } from "src/auth/guard/jwt-auth-guard";
import { Request } from "express";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiConsumes,
} from "@nestjs/swagger";
import { CreateRequestDto } from "./dto/create-request-dto";
import { UpdateRequestStatusDto } from "./dto/update-request-dto";
import { UpdateJobStatusDto } from "./dto/update-job-dto";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { Public } from "src/common/decorators/public.decorator";
import { GetWithVideosDto } from "./dto/video-with-dto";
import { PaginationDto } from "src/orders/dto/Get-paginated-dto";
import { SearchNearbyServiceDto } from "./dto/search-nearby-service.dto";

@ApiTags("Services")
@ApiBearerAuth("jwt")
@UseGuards(JwtAuthGuard)
@Controller("services")
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) { }

  @Post("create-request")
  @ApiOperation({ summary: "Create a new service request" })
  @ApiBody({ type: CreateRequestDto })
  createRequest(@Body() dto: CreateRequestDto) {
    return this.servicesService.createServiceRequest(dto);
  }

  
  @Patch("status")
  @ApiOperation({
    summary:
      "Update the status of a request (accept, reject, cancel, confirm, propose)",
  })
  @ApiBody({ type: UpdateRequestStatusDto })
  updateStatus(@Body() dto: UpdateRequestStatusDto) {
    return this.servicesService.updateRequestStatus(dto);
  }

  @Patch("job-status")
  @ApiOperation({
    summary: "Update the job status of a request (start_job, complete_job)",
  })
  @ApiBody({ type: UpdateJobStatusDto })
  updateJobStatus(@Body() dto: UpdateJobStatusDto) {
    return this.servicesService.updateJobStatus(dto);
  }

  @Post("create")
  @ApiOperation({ summary: "Create a new service for a user" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "images", maxCount: 5 },
      { name: "video", maxCount: 1 },
    ]),
  )
  @ApiBody({ type: CreateServiceDto })
  @ApiResponse({ status: 201, description: "Service created successfully" })
  async create(
    @Req() req: Request,
    @Body() dto: CreateServiceDto,
    @UploadedFiles()
    files: {
      images?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    const user = req.user as { sub: number };
    if (files?.images && files.images.length > 0) {
      dto.images = files.images; // Assuming images are stored as file objects
    } else {
      dto.images = []; // Ensure images is always an array
    }
    if (files?.video && files.video.length > 0) {
      dto.video = files.video; // Assuming video is stored as a file object
    } else {
      dto.video = []; // Ensure video is always an array
    }

    dto.parameters = JSON.parse(
      dto.parameters?.toString() || "{}",
    );

    return await this.servicesService.create(user.sub, dto);
  }

  @Put("update/:serviceId")
  @ApiOperation({ summary: "Update an existing service" })
  @ApiParam({ name: "serviceId", required: true })
  @ApiResponse({ status: 200, description: "Service updated successfully" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "images", maxCount: 5 },
      { name: "video", maxCount: 1 },
    ]),
  )
  @ApiBody({ type: UpdateServiceDto })
  async update(
    @Param("serviceId") serviceId: string,
    @Body() dto: UpdateServiceDto,
    @UploadedFiles()
    files: {
      images?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    if (files?.images && files.images.length > 0) {
      dto.images = files.images; // Assuming images are stored as file objects
    }
    if (files?.video && files.video.length > 0) {
      dto.video = files.video; // Assuming video is stored as a file object
    }

    dto.parameters = JSON.parse(
      dto.parameters?.toString() || "{}",
    );

    return await this.servicesService.update(Number(serviceId), dto);
  }

  @Delete(':serviceId')
  @ApiOperation({ summary: 'Delete a service' })
  @ApiParam({ name: 'serviceId', required: true })
  @ApiResponse({ status: 204, description: 'Service deleted successfully' })
  @HttpCode(HttpStatus.OK)
  async delete(@Param('serviceId') serviceId: string) {
    const results = await this.servicesService.delete(Number(serviceId));
    console.log("Results", results)
    return { message: results.message }
  }
  @Public()
  @Get(":serviceId")
  @ApiOperation({ summary: "Get service by ID" })
  @ApiParam({ name: "serviceId", required: true })
  @ApiQuery({ name: "userId", required: false })
  @ApiResponse({ status: 200, description: "Service found" })
  async getById(@Param("serviceId") serviceId: string, @Query("userId") userId?: string): Promise<any> {
    return await this.servicesService.getById(Number(serviceId), userId ? Number(userId) : undefined);
  }

  @Get("/user/:userId")
  @Public()
  @ApiOperation({ summary: "Get paginated services by user ID" })
  @ApiParam({ name: "userId", required: true })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "Paginated list of services",
  })
  async getByUser(
    @Param("userId") userId: string,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 10,
  ): Promise<PaginatedResponseDto<any>> {
    return this.servicesService.getByUser(Number(userId), page, limit);
  }

  @Get("/requests/:userId")
  @ApiOperation({ summary: "Get paginated service requests for a user" })
  @ApiParam({ name: "userId", required: true })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({
    name: "jobStatus",
    required: false,
    type: String,
  })
  @ApiQuery({
    name: "status",
    required: false,
    type: String,
  })
  @ApiQuery({
    name: "role",
    required: true,
    enum: ["customer", "provider"],
    description: "Return requests where the user is acting as the customer or provider",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of service requests",
  })
  async getServiceRequestsByUser(
    @Param("userId") userId: string,
    @Query("role") role: "customer" | "provider",
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 10,
    @Query("jobStatus") jobStatus?: string,
    @Query("status") status?: string,
  ): Promise<PaginatedResponseDto<any>> {
    return this.servicesService.getServiceRequestsByUser(Number(userId), role, page, limit, jobStatus, status);
  }


  @Public()
  @Get("with-videos/all")
  @ApiOperation({ summary: "Get all services with videos (paginated)" })

  @ApiResponse({
    status: 200,
    description: "Paginated list of services with videos",
  })
  async getServicesWithVideos(
    @Query() query: GetWithVideosDto,
    @Query("userId") userId?: string,
  ): Promise<PaginatedResponseDto<any>> {
    console.log("Recieved pagination", query);
    return this.servicesService.getServicesWithVideos(query, userId ? Number(userId) : undefined, query.category);
  }

  @Delete(":id/media")
  @ApiOperation({ summary: "Delete selected media files for a service" })
  @ApiParam({ name: "id", description: "Service ID" })
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
    description: "Selected service media deleted successfully",
  })
  @ApiResponse({ status: 404, description: "Service not found" })
  @ApiResponse({
    status: 400,
    description: "No media files provided for deletion",
  })
  @HttpCode(HttpStatus.OK)
  async deleteProductMedia(
    @Param("id") serviceId: string,
    @Body("media") media: string[],
  ) {
    if (!Array.isArray(media) || media.length === 0) {
      throw new BadRequestException("No media files provided for deletion");
    }
    await this.servicesService.deleteServiceMedia(Number(serviceId), media);
    return { message: "Selected service media deleted successfully" };
  }

  @Public()
  @Get("search/nearby")
  @ApiOperation({ summary: "Search services near a coordinate within a radius" })
  @ApiQuery({ name: "lat", required: true, type: Number })
  @ApiQuery({ name: "lng", required: true, type: Number })
  @ApiQuery({ name: "radius", required: true, type: Number, description: "Distance in kilometers" })
  @ApiQuery({ name: "category", required: false, type: String, description: "Optional category id to filter services" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async searchNearbyServices(
    @Query() query: SearchNearbyServiceDto,
  ) {
    console.log("Searching nearby services with query:", query);
    return this.servicesService.searchNearbyServices(query);
  }

  @Delete(":id/media")
  @ApiOperation({ summary: "Delete selected media files for a service" })
  @ApiParam({ name: "id", description: "Service ID" })
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
    description: "Selected service deleted successfully",
  })
  @ApiResponse({ status: 404, description: "Service not found" })

  @HttpCode(HttpStatus.OK)
  async deleteService(
    @Param("id") serviceId: string,
  ) {
    await this.servicesService.delete(Number(serviceId));
    return { message: "Selected service deleted successfully" };
  }

  @Get("/customer/:customerId")
  @ApiOperation({ summary: "Get paginated services for a customer" })
  @ApiParam({ name: "customerId", required: true })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({
    name: "jobStatus",
    required: false,
    type: String,
  })
  @ApiQuery({
    name: "status",
    required: false,
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of services for the customer",
  })
  async getServiceRequestsForCustomer(
    @Param("customerId") customerId: string,
    @Query() paginationDto: PaginationDto,
    @Query("jobStatus") jobStatus?: string,
    @Query("status") status?: string,
  ) {
    return this.servicesService.getServicesRequestsForCustomer(Number(customerId), paginationDto, jobStatus, status);
  }
}
