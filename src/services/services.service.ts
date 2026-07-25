import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { I18nService } from "nestjs-i18n";
import { CreateServiceDto } from "./dto/create-service.dto";
import { UpdateServiceDto } from "./dto/update-service.dto";
import { PaginatedResponseDto } from "src/common/dto/pagination-response.dto";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { ListingUtilsService } from "src/shared/listing-util-service";
import { UsersService } from "src/users/users.service";
import { HandleRequestDto } from "./dto/handle-request.do";

import { SearchAllProductsServiceDto } from "src/search/dto/product-service-search-for.dto";
import { SearchNearbyServiceDto } from "./dto/search-nearby-service.dto";
import { UpdateJobStatusDto } from "./dto/update-job-dto";
import { UpdateRequestStatusDto } from "./dto/update-request-dto";
import { CreateRequestDto } from "./dto/create-request-dto";
import { NotificationsService } from "src/notifications/notifications.service";
import { FileUploadService } from "src/common/file-upload/file-upload.service";
import { ClsService } from "nestjs-cls";
import { LikeService } from "src/like/like.service";
import { ReviewService } from "src/reviews/reviews.service";
import { PrismaService } from "src/core/prisma/prisma.service";
import { Prisma } from "src/generated/prisma/client";
import { fromGeoJson, toGeoJson } from "src/common/utils/location-formatter";

const VALID_JOB_STATUSES = ["not_started", "in_progress", "completed"];
const VALID_REQUEST_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "proposed",
  "cancelled",
  "confirmed",
];

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => UsersService))
    private readonly userService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly listingUtils: ListingUtilsService,
    private readonly fileUploadService: FileUploadService,
    private readonly i18n: I18nService,
    private readonly cls: ClsService,
    @Inject(forwardRef(() => LikeService))
    private readonly likeService: LikeService,
    private readonly reviewService: ReviewService,
  ) { }

  private get lang(): string {
    return this.cls?.get("lang") ?? "en";
  }

  private async delayResponse(ms = 2000): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async create(userId: number, dto: CreateServiceDto) {
    const user = await this.userService.findUserById(userId);
    if (!user) {
      throw new NotFoundException(
        this.i18n.translate("auth.services.user_not_found", {
          lang: this.lang,
        }),
      );
    }
    const existingService = await this.prisma.service.findFirst({
      where: { ownerId: user.id, isDeleted: false, isDisabled: false },
    });
    if (existingService) {
      throw new BadRequestException(
        this.i18n.translate("auth.services.user_duplicate_service", {
          lang: this.lang,
        }),
      );
    }
    if (
      !user.location ||
      !user.location.coordinates ||
      user.location.coordinates.length !== 2
    ) {
      throw new BadRequestException(
        this.i18n.translate("auth.services.user_location_missing", {
          lang: this.lang,
        }),
      );
    }
    let imageFiles: Express.Multer.File[] = [];
    let videoFiles: Express.Multer.File[] = [];
    if (dto.images) {
      imageFiles = dto.images as Express.Multer.File[];
    }

    if (imageFiles.length > 5) {
      throw new BadRequestException(
        this.i18n.translate("auth.services.media_limit_exceeded", {
          lang: this.lang,
        }),
      );
    }
    if (dto.video) {
      videoFiles = dto.video as Express.Multer.File[];
    }

    const coords = fromGeoJson(user.location)!;

    let created = await this.prisma.service.create({
      data: {
        ownerId: user.id,
        title: dto.title,
        description: dto.description ?? null,
        price: dto.price,
        paymentType: dto.paymentType,
        requiresAppointment: dto.requiresAppointment ?? true,
        categoryId: dto.category,
        images: [],
        video: "",
        parameters: (dto.parameters || []) as any,
        ...coords,
      },
    });

    if (imageFiles && imageFiles.length > 0) {
      const images = await this.fileUploadService.uploadServiceFile(
        userId,
        created.id,
        imageFiles,
      );
      created = await this.prisma.service.update({
        where: { id: created.id },
        data: { images },
      });
    }
    if (videoFiles && videoFiles.length > 0) {
      const video = await this.fileUploadService.uploadServiceFile(
        userId,
        created.id,
        videoFiles,
        "video",
      );
      created = await this.prisma.service.update({
        where: { id: created.id },
        data: { video: video[0] }, // Assuming only one video file is uploaded
      });
    }

    const withCategory = await this.prisma.service.findUniqueOrThrow({
      where: { id: created.id },
      include: { category: true },
    });
    const { latitude, longitude, ...rest } = withCategory as any;

    return {
      message: this.i18n.translate("auth.services.created_success", {
        lang: this.lang,
      }),
      data: { ...rest, location: toGeoJson(latitude, longitude) },
    };
  }

  async update(serviceId: number, dto: UpdateServiceDto) {
    Object.keys(dto).forEach((key) => {
      if (
        dto[key] === "" || // empty string
        dto[key] === null || // null
        typeof dto[key] === "undefined"
      ) {
        delete dto[key]; // remove it from updateData
      }
    });
    const existingService = await this.prisma.service.findFirst({
      where: { id: serviceId, isDeleted: false, isDisabled: false },
    });
    if (!existingService) {
      throw new NotFoundException("Service not found");
    }
    const imageFiles = dto.images as Express.Multer.File[];
    let images = existingService.images; // Preserve existing images if not updated
    if (imageFiles && imageFiles.length > 0) {
      if (existingService.images && existingService.images.length > 4) {
        throw new BadRequestException("You can only upload up to 5 images");
      }
      images = existingService.images || [];
      const newimages = await this.fileUploadService.uploadServiceFile(
        existingService.ownerId,
        serviceId,
        imageFiles,
      );
      images = [...images, ...newimages];
    }
    const videoFiles = dto.video as Express.Multer.File[];
    let video = existingService.video; // Preserve existing video if not updated
    let videoFile: string[] = [];
    if (videoFiles && videoFiles.length > 0) {
      videoFile = await this.fileUploadService.uploadServiceFile(
        existingService.ownerId,
        existingService.id,
        videoFiles,
        "video",
      );
    }

    if (videoFile && videoFile.length > 0) {
      video = videoFile[0]; // Assuming only one video file is uploaded
    }

    const data: any = {
      ...dto,
      images,
      video,
      parameters: dto.parameters || existingService.parameters || [],
    };
    if ((dto as any).category) {
      data.categoryId = (dto as any).category;
      delete data.category;
    }

    try {
      await this.prisma.service.update({
        where: { id: serviceId },
        data,
        include: { category: true },
      });
    } catch {
      throw new NotFoundException(
        this.i18n.translate("auth.services.service_not_found", {
          lang: this.lang,
        }),
      );
    }

    return {
      message: this.i18n.translate("auth.services.updated_success", {
        lang: this.lang,
      }),
      data: { ...dto, images, video },
    }; // Ensure the images and video are included in the returned object
  }

  async delete(serviceId: number) {
    const existingService = await this.prisma.service.findFirst({
      where: { id: serviceId, isDeleted: false, isDisabled: false },
    });
    if (!existingService) {
      throw new NotFoundException(
        this.i18n.translate("auth.services.service_not_found", {
          lang: this.lang,
        }),
        // Ensure the service exists before attempting to delete
      );
    }
    let media: string[] = [];
    if (existingService.images.length != 0) {
      media = [...existingService.images];
    }
    if (existingService.video) {
      media.push(existingService.video);
    }

    if (media && media.length > 0) {
      await this.fileUploadService.deleteFiles(media); // Delete associated media files
    }

    // NOTE: preserves a pre-existing bug — the original set a field named
    // "imageUrls" here (not "images", the real column), so the images array
    // was never actually cleared on delete. Only isDeleted/video are touched.
    const result = await this.prisma.service
      .update({
        where: { id: serviceId },
        data: { isDeleted: true, video: "" },
      })
      .catch(() => null);
    if (!result) {
      throw new NotFoundException(
        this.i18n.translate("auth.services.service_not_found", {
          lang: this.lang,
        }),
      );
    }
    return {
      status: 200,
      message: this.i18n.translate("auth.services.deleted_success", {
        lang: this.lang,
      }),
    };
  }

  async deleteServiceMedia(serviceId: number, media: string[]) {
    const existingService = await this.prisma.service.findFirst({
      where: { id: serviceId, isDeleted: false, isDisabled: false },
    });
    if (!existingService) {
      throw new NotFoundException(
        this.i18n.translate("auth.services.service_not_found", {
          lang: this.lang,
        }),
      );
    }
    if (!media || media.length === 0) {
      throw new BadRequestException(
        this.i18n.translate("auth.services.no_media_provided", {
          lang: this.lang,
        }),
      );
    }

    // Remove media files from storage
    await this.fileUploadService.deleteFiles(media);

    // Remove media from service document
    let images = existingService.images || [];
    let video = existingService.video;

    // Remove any images that match the URLs
    images = images.filter((imgUrl) => !media.includes(imgUrl));

    // Remove video if its URL is in the media array
    if (video && media.includes(video)) {
      video = "";
    }

    await this.prisma.service.update({
      where: { id: serviceId },
      data: { images, video: video ?? "" },
    });

    return true;
  }

  async getById(serviceId: number, userId?: number): Promise<any> {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, isDeleted: false, isDisabled: false },
      include: { category: true, owner: true },
    });

    if (!service) {
      throw new NotFoundException(
        this.i18n.translate("auth.services.service_not_found", {
          lang: this.lang,
        }),
      );
    }

    const { owner, ownerId, categoryId, latitude, longitude, ...rest } = service as any;
    const shaped = { ...rest, location: toGeoJson(latitude, longitude), ownerId: owner };

    if (!userId) return shaped;

    const [isLiked, userReview] = await Promise.all([
      this.likeService.isLiked(userId, serviceId, "service"),
      this.reviewService.findOne(userId, serviceId, "service"),
    ]);

    return {
      ...shaped,
      isLiked: !!isLiked,
      userReview: userReview || null,
    } as any;
  }

  async getByUser(
    userId: number,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<any>> {
    const skip = (page - 1) * limit;
    const where = { ownerId: userId, isDeleted: false, isDisabled: false };

    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: { category: true, owner: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.service.count({ where }),
    ]);

    const shaped = data.map((item: any) => {
      const { owner, ownerId, categoryId, latitude, longitude, ...rest } = item;
      return {
        ...rest,
        ownerId: owner,
        location: toGeoJson(latitude, longitude),
      };
    });

    return {
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      data: shaped,
    };
  }

  async searchNearbyWithCategory(
    category: number,
    coordinates: [number, number],
    radius: number,
    pagination: PaginationDto,
  ) {
    return this.listingUtils.findNearbyWithCategory(
      "Service",
      category,
      coordinates,
      radius,
      pagination,
    );
  }

  async searchNearbyServices(query: SearchNearbyServiceDto) {
    const coordinates: [number, number] = [Number(query.lng), Number(query.lat)];
    const radiusMeters = Number(query.radius) * 1000;
    const page = query.page && Number(query.page) > 0 ? Number(query.page) : 1;
    const limit = query.limit && Number(query.limit) > 0 ? Number(query.limit) : 10;
    const skip = (page - 1) * limit;
    const [lng, lat] = coordinates;

    const categoryFilter = query.category
      ? Prisma.sql`AND s."categoryId" = ${query.category}`
      : Prisma.empty;

    const distanceExpr = Prisma.sql`(6371000 * acos(LEAST(1.0, GREATEST(-1.0,
          cos(radians(${lat})) * cos(radians(s."latitude")) * cos(radians(s."longitude") - radians(${lng}))
          + sin(radians(${lat})) * sin(radians(s."latitude"))
        ))))`;

    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT s.*, row_to_json(c.*) as "categoryJson"
      FROM "Service" s
      LEFT JOIN "Category" c ON c.id = s."categoryId"
      WHERE s."isDeleted" = false AND s."isDisabled" = false
        ${categoryFilter}
        AND ${distanceExpr} <= ${radiusMeters}
      ORDER BY s."createdAt" DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    const countResult = await this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) as total
      FROM "Service" s
      WHERE s."isDeleted" = false AND s."isDisabled" = false
        ${categoryFilter}
        AND ${distanceExpr} <= ${radiusMeters}
    `;
    const total = Number(countResult[0]?.total ?? 0);

    const results = rows.map((row) => {
      const { categoryJson, categoryId, latitude, longitude, ...rest } = row;
      return { ...rest, location: toGeoJson(latitude, longitude), category: categoryJson };
    });

    const enrichedResults = await this.enrichServicesWithReviewStats(results);

    return {
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data: enrichedResults,
    };
  }

  /**
   * Raw-SQL replacement for the old getServiceModel()-based query in
   * broadcast.service.ts (Prisma has no concept of a raw/exposed model).
   */
  async findNearbyServiceProviderIds(
    coordinates: [number, number],
    radiusInMeters: number,
    categoryId: number,
  ): Promise<number[]> {
    const [lng, lat] = coordinates;
    const rows = await this.prisma.$queryRaw<{ ownerId: number }[]>`
      SELECT DISTINCT "ownerId"
      FROM "Service"
      WHERE "categoryId" = ${categoryId}
        AND "isDeleted" = false
        AND "isDisabled" = false
        AND (6371000 * acos(LEAST(1.0, GREATEST(-1.0,
              cos(radians(${lat})) * cos(radians("latitude")) * cos(radians("longitude") - radians(${lng}))
              + sin(radians(${lat})) * sin(radians("latitude"))
            )))) <= ${radiusInMeters}
    `;
    return rows.map((r) => r.ownerId);
  }

  async setDisabledByOwner(ownerId: number, disabled: boolean) {
    await this.prisma.service.updateMany({
      where: { ownerId },
      data: { isDisabled: disabled },
    });
  }

  async searchServices(query: SearchAllProductsServiceDto) {
    // Build filter only with present fields
    const where: Prisma.ServiceWhereInput = {
      isDeleted: false,
      isDisabled: false,
    };

    if (query.name) {
      where.title = { contains: query.name, mode: "insensitive" };
    }
    if (query.category) {
      where.categoryId = query.category;
    }

    const page = query.page && Number(query.page) > 0 ? Number(query.page) : 1;
    const limit = query.limit && Number(query.limit) > 0 ? Number(query.limit) : 10;
    const skip = (page - 1) * limit;

    const [results, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.service.count({ where }),
    ]);

    const enrichedResults = await this.enrichServicesWithReviewStats(results);

    return {
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      data: enrichedResults,
    };
  }

  private async enrichServicesWithReviewStats(services: any[]) {
    if (!services || services.length === 0) {
      return services;
    }

    const serviceIds = services.map((service) => service.id);
    const reviewStats = await this.reviewService.getAverageRatingsForItems(
      serviceIds,
      "service",
    );

    const reviewMap = new Map(
      reviewStats.map((item: any) => [
        item._id,
        {
          avgRating: item.avgRating ?? 0,
          reviewCount: item.count ?? 0,
        },
      ]),
    );

    return services.map((service: any) => {
      const stats = reviewMap.get(service.id);
      return {
        ...service,
        averageRating: stats?.avgRating
          ? Number(stats.avgRating.toFixed(1))
          : 0,
        reviewCount: stats?.reviewCount ?? 0,
      };
    });
  }

  async createServiceRequest(dto: CreateRequestDto) {
    const { serviceId, customerId, requestedDateTime, message } = dto;

    // --- Validation: User Existence ---
    const customer = customerId
      ? await this.userService.findUserById(customerId)
      : null;

    if (customerId && !customer)
      throw new NotFoundException(
        this.i18n.translate("auth.services.customer_not_found", {
          lang: this.lang,
        }),
      );

    // --- Creation Flow ---

    if (!serviceId || !requestedDateTime || !customerId) {
      throw new BadRequestException(
        "Missing required fields for request creation",
      );
    }

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service)
      throw new NotFoundException(
        this.i18n.translate("auth.services.service_not_found", {
          lang: this.lang,
        }),
      );

    const results = await this.prisma.serviceRequest.create({
      data: {
        serviceId,
        customerId,
        providerId: service.ownerId,
        requestedDateTime: new Date(requestedDateTime),
        status: "pending",
        jobStatus: "not_started",
        message,
      },
    });

    await this.notificationsService.createAndNotify(
      service.ownerId,
      "request_created",
      "SERVICE_REQUEST",
      {
        serviceId,
        customerId,
        requestedDateTime,
        actionType: "recieved",
      },
      { serviceName: service.title, customerName: customer?.name || "A customer" },
    );

    await this.delayResponse();

    return {
      data: results,
      message: this.i18n.translate("auth.services.request_created_success", {
        lang: this.lang,
      }),
    };
  }

  async updateRequestStatus(dto: UpdateRequestStatusDto) {
    const { requestId, action, proposedDateTime } = dto;

    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: { service: true, customer: true, provider: true },
    });

    if (!request)
      throw new NotFoundException(
        this.i18n.translate("auth.services.request_not_found", {
          lang: this.lang,
        }),
      );

    // Safely extract service name (avoid using full object)
    const serviceName = (request.service as any)?.title || "service";
    const currentRequestStatus = request.status;

    // 1. Prepare variables at the top
    let notificationKey: string | null = null;
    let recipientId: number = request.customerId;
    const notificationPayload: any = {
      requestId: request.id,
      action,
      request,
      actionType: "recieved",
    };
    const data: any = {};

    // 2. The switch logic (ONLY updates status and picks the message key)
    switch (action) {
      case "accept":
        if (currentRequestStatus === "proposed") {
          data.status = "confirmed";
          recipientId = request.providerId;
          notificationKey = "request_confirmed";
          Object.assign(notificationPayload, {
            proposedDate:
              request.proposedDateTime?.toISOString() || proposedDateTime,
          });
        } else {
          data.status = "accepted";
          notificationKey = "request_accepted";
        }
        break;

      case "reject":
        data.status = "rejected";
        notificationKey = "request_rejected";
        if (currentRequestStatus === "proposed") {
          recipientId = request.providerId;
        }
        break;

      case "cancel":
        data.status = "cancelled";
        recipientId = request.providerId; // Switch recipient
        notificationKey = "request_cancelled";
        break;

      case "propose":
        if (!proposedDateTime) throw new BadRequestException();

        data.status = "proposed";
        data.proposedDateTime = new Date(proposedDateTime);
        notificationKey = "request_proposed";
        // Add extra data specifically for this case
        Object.assign(notificationPayload, { proposedDate: proposedDateTime });
        break;

      case "confirm":
        if (currentRequestStatus !== "proposed") {
          throw new BadRequestException(
            this.i18n.translate("auth.services.invalid_confirm_action"),
          );
        }

        data.status = "confirmed";
        recipientId = request.providerId;
        notificationKey = "request_confirmed";
        Object.assign(notificationPayload, {
          proposedDate:
            request.proposedDateTime?.toISOString() || proposedDateTime,
        });
        break;

      default:
        throw new BadRequestException(
          this.i18n.translate("auth.services.unsupported_action"),
        );
    }

    // 3. Perform the DB operation (the source of truth)
    await this.prisma.serviceRequest.update({ where: { id: requestId }, data });

    // 4. Dispatch notification (only if save succeeded and we have a key)
    if (notificationKey) {
      const i18nArgs = { serviceName };

      await this.notificationsService.createAndNotify(
        recipientId,
        notificationKey,
        "SERVICE_REQUEST",
        notificationPayload,
        i18nArgs,
      );
    }
    // Give Android a brief window to settle the connection before the response completes.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      status: 201,
      message: this.i18n.translate("auth.services.request_status_updated", {
        lang: this.lang,
      }),
      data: {
        requestId,
      },
    };
  }

  async updateJobStatus(dto: UpdateJobStatusDto) {
    const { requestId, action } = dto;

    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException("Request not found");

    const data: any = {};

    switch (action) {
      case "start_job": {
        // Check if provider already has another in_progress job
        const existingInProgress = await this.prisma.serviceRequest.findFirst({
          where: {
            id: { not: request.id },
            providerId: request.providerId,
            jobStatus: "in_progress",
          },
        });

        if (existingInProgress) {
          throw new BadRequestException(
            this.i18n.translate("auth.services.provider_has_in_progress_job", {
              lang: this.lang,
            }),
          );
        }

        data.jobStatus = "in_progress";
        data.status = "accepted";
        data.startedAt = new Date();
        break;
      }

      case "complete_job":
        data.status = "accepted"; // keep it consistent
        data.jobStatus = "completed";
        data.completedAt = new Date();
        break;

      default:
        throw new BadRequestException(
          this.i18n.translate("auth.services.unsupported_job_action", {
            lang: this.lang,
          }),
        );
    }

    const result = await this.prisma.serviceRequest.update({
      where: { id: requestId },
      data,
    });
    // Give Android a brief window to settle the connection before the response completes.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      status: 201,
      message: this.i18n.translate("auth.services.job_status_updated", {
        lang: this.lang,
        args: {
          jobStatus: result.jobStatus,
        },
      }),
      data: {
        requestId: result.id,
        jobStatus: result.jobStatus,
      },
    };
  }

  async getServiceRequestsByUser(
    userId: number,
    role: "customer" | "provider",
    page = 1,
    limit = 10,
    jobStatus?: string,
    status?: string,
  ): Promise<PaginatedResponseDto<any>> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (role === "customer") {
      where.customerId = userId;
    } else if (role === "provider") {
      where.providerId = userId;
    } else {
      throw new BadRequestException(
        "Invalid role value. Expected 'customer' or 'provider'.",
      );
    }

    // Prisma enforces the enum strictly (unlike Mongo, which silently
    // matched nothing for an invalid string) — force the same "no match"
    // outcome for an invalid filter value instead of letting Prisma throw.
    if (jobStatus) {
      if (VALID_JOB_STATUSES.includes(jobStatus)) {
        where.jobStatus = jobStatus;
      } else {
        where.id = -1;
      }
    }

    if (status) {
      if (VALID_REQUEST_STATUSES.includes(status)) {
        where.status = status;
      } else {
        where.id = -1;
      }
    }

    const [requests, total] = await Promise.all([
      this.prisma.serviceRequest.findMany({
        where,
        include: { service: true, customer: true, provider: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.serviceRequest.count({ where }),
    ]);

    if (!requests || requests.length === 0) {
      throw new NotFoundException(
        this.i18n.translate("auth.services.no_requests_found", {
          lang: this.lang,
        }),
      );
    }
    return {
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data: requests,
    };
  }

  async deleteAllServiceMedia(serviceId: number, media: string[]) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) {
      throw new NotFoundException(
        this.i18n.translate("auth.services.service_not_found", {
          lang: this.lang,
        }),
      );
    }
    if (!media || media.length === 0) {
      throw new BadRequestException(
        this.i18n.translate("auth.services.no_media_provided", {
          lang: this.lang,
        }),
      );
    }

    // Remove media files from storage
    await this.fileUploadService.deleteFiles(media);

    let images = service.images || [];
    let video = service.video;

    images = images.filter((imgUrl) => !media.includes(imgUrl));

    if (video && media.includes(video)) {
      video = "";
    }

    await this.prisma.service.update({
      where: { id: serviceId },
      data: { images, video: video ?? "" },
    });

    return {
      message: this.i18n.translate("auth.services.media_deleted_success", {
        lang: this.lang,
      }),
    };
  }

  async getServicesWithVideos(
    paginationDto: PaginationDto,
    userId?: number,
    category?: number,
  ): Promise<PaginatedResponseDto<any>> {
    const page = Number(paginationDto.page) || 1;
    const limit = Number(paginationDto.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ServiceWhereInput = {
      AND: [{ video: { not: null } }, { video: { not: "" } }],
      isDeleted: false,
      isDisabled: false,
    };

    if (category) {
      where.categoryId = Number(category);
    }

    const [items, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: {
          category: true,
          owner: {
            select: {
              id: true,
              name: true,
              image: true,
              address: true,
              phone: true,
              latitude: true,
              longitude: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.service.count({ where }),
    ]);

    let data: any[] = items.map((item: any) => {
      const { owner, ownerId, categoryId, latitude, longitude, ...rest } = item;
      const ownerShaped = owner
        ? (() => {
          const { latitude: oLat, longitude: oLng, ...ownerRest } = owner;
          return { ...ownerRest, location: toGeoJson(oLat, oLng) };
        })()
        : null;
      return {
        ...rest,
        location: toGeoJson(latitude, longitude),
        ownerId: ownerShaped,
      };
    });

    if (!userId) {
      return {
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        data,
      };
    }

    const user = await this.userService.findUserById(userId);
    if (!user) {
      throw new NotFoundException(
        this.i18n.translate("auth.users.user_not_found", {
          lang: this.lang,
        }),
      );
    }

    const serviceIds = items.map((item) => item.id);
    const likes = await this.likeService.getLikesByUser(
      userId,
      "service",
      serviceIds,
    );

    const likedServiceIds = new Set(likes.map((like: any) => like.itemId));

    data = data.map((item: any) => ({
      ...item,
      isLiked: likedServiceIds.has(item.id),
    }));

    return {
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      data,
    };
  }

  async getServicesRequestsForCustomer(
    customerId: number,
    paginationDto: PaginationDto,
    jobStatus?: string,
    status?: string,
  ): Promise<PaginatedResponseDto<any>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const existingCustomer = await this.userService.findUserById(customerId);
    if (!existingCustomer) {
      throw new NotFoundException(
        this.i18n.translate("auth.users.user_not_found", {
          lang: this.lang,
        }),
      );
    }

    const where: any = { customerId };

    if (jobStatus) {
      if (VALID_JOB_STATUSES.includes(jobStatus)) {
        where.jobStatus = jobStatus;
      } else {
        where.id = -1;
      }
    }
    if (status) {
      if (VALID_REQUEST_STATUSES.includes(status)) {
        where.status = status;
      } else {
        where.id = -1;
      }
    }

    const requests = await this.prisma.serviceRequest.findMany({
      where,
      include: {
        provider: { select: { name: true, email: true } },
        customer: { select: { name: true, email: true } },
        service: { include: { category: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });
    const total = await this.prisma.serviceRequest.count({ where });

    return {
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      data: requests,
    };
  }
}
