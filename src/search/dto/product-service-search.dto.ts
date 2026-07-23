// src/search/dto/search-query.dto.ts

import { IsIn, IsOptional, IsString, IsNumber } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SearchQueryDto {
  @ApiProperty({ enum: ["product", "service"], example: "product" })
  @IsIn(["product", "service"])
  type: "product" | "service";

  @ApiPropertyOptional({ example: "electronics" })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: 10, description: "Search radius in kilometers" })
  @Type(() => Number)
  @IsNumber()
  radius: number;

  @ApiProperty({ example: 33.6844, description: "Latitude coordinate" })
  @Type(() => Number)
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 73.0479, description: "Longitude coordinate" })
  @Type(() => Number)
  @IsNumber()
  lng: number;

  @ApiPropertyOptional({ example: 1, description: "Pagination: page number" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: "Pagination: limit per page",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;
}
