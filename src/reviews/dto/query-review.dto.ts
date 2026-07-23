import { IsOptional, IsString, IsIn, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class QueryReviewDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  itemId: number;

  @ApiProperty({ enum: ["product", "service"], example: "product" })
  @IsIn(["product", "service"])
  itemType: "product" | "service";

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
