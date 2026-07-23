import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, IsNumber, IsInt } from "class-validator";

export class SearchNearbyServiceDto {
    @ApiPropertyOptional({ example: 1, description: "Optional category id to filter services" })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    category?: number;

    @ApiProperty({ example: 33.6844, description: "Latitude coordinate" })
    @Type(() => Number)
    @IsNumber()
    lat: number;

    @ApiProperty({ example: 73.0479, description: "Longitude coordinate" })
    @Type(() => Number)
    @IsNumber()
    lng: number;

    @ApiProperty({ example: 10, description: "Search radius in kilometers" })
    @Type(() => Number)
    @IsNumber()
    radius: number;

    @ApiPropertyOptional({ example: 1, description: "Page number for pagination" })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    page?: number = 1;

    @ApiPropertyOptional({ example: 10, description: "Number of results per page" })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    limit?: number = 10;
}
