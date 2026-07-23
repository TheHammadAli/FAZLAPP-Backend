import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCategoryRequestDto {
  @ApiProperty({
    example: "Home Appliances",
    description: "Requested category name",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: "Products like refrigerators, ovens, etc." })
  @IsString()
  @IsOptional()
  description?: string;
}
