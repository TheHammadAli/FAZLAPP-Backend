import { IsEnum, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ReviewCategoryRequestDto {
  @ApiProperty({
    example: "approved",
    enum: ["approved", "rejected"],
    description: "Request status update",
  })
  @IsEnum(["approved", "rejected"])
  status: "approved" | "rejected";

  @ApiPropertyOptional({
    example: 'This category is already covered under "Appliances"',
    description: "Optional admin comment",
  })
  @IsOptional()
  @IsString()
  adminComment?: string;
}
