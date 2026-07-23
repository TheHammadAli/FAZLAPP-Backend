import { Injectable } from "@nestjs/common";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { PaginatedResponseDto } from "src/common/dto/pagination-response.dto";
import { PrismaService } from "src/core/prisma/prisma.service";
import { toGeoJson } from "src/common/utils/location-formatter";

@Injectable()
export class ListingUtilsService {
  constructor(private readonly prisma: PrismaService) {}

  async findNearbyWithCategory(
    table: "Product" | "Service",
    category: number,
    coordinates: [number, number],
    radius: number,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<any>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const [lng, lat] = coordinates;
    const radiusInMeters = radius * 1000;

    // Step 1: paginated data (geo filter + category join, sorted by
    // createdAt like the original — not by distance). Distance is computed
    // via the Haversine formula (no PostGIS available on this database).
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT t.*, row_to_json(c.*) as "categoryJson"
      FROM "${table}" t
      LEFT JOIN "Category" c ON c.id = t."categoryId"
      WHERE t."categoryId" = $1
        AND t."isDeleted" = false
        AND t."isDisabled" = false
        AND (6371000 * acos(LEAST(1.0, GREATEST(-1.0,
              cos(radians($3)) * cos(radians(t."latitude")) * cos(radians(t."longitude") - radians($2))
              + sin(radians($3)) * sin(radians(t."latitude"))
            )))) <= $4
      ORDER BY t."createdAt" DESC
      LIMIT $5 OFFSET $6
      `,
      category,
      lng,
      lat,
      radiusInMeters,
      limit,
      skip,
    );

    // Step 2: separate count query
    const countResult = await this.prisma.$queryRawUnsafe<{ total: bigint }[]>(
      `
      SELECT COUNT(*) as total
      FROM "${table}" t
      WHERE t."categoryId" = $1
        AND t."isDeleted" = false
        AND t."isDisabled" = false
        AND (6371000 * acos(LEAST(1.0, GREATEST(-1.0,
              cos(radians($3)) * cos(radians(t."latitude")) * cos(radians(t."longitude") - radians($2))
              + sin(radians($3)) * sin(radians(t."latitude"))
            )))) <= $4
      `,
      category,
      lng,
      lat,
      radiusInMeters,
    );

    const total = Number(countResult[0]?.total ?? 0);

    const data = rows.map((row) => {
      const { categoryJson, categoryId, latitude, longitude, ...restRow } = row;
      return {
        ...restRow,
        location: toGeoJson(latitude, longitude),
        category: categoryJson,
      };
    });

    return {
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data,
    };
  }
}
