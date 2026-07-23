import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsEnum,
  IsArray,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ServiceParameterDto } from "./create-service.dto";
import { Type } from "class-transformer";
export class UpdateServiceDto {
  @ApiPropertyOptional({ example: "Home Cleaning Deluxe" })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    example: "Includes balcony, kitchen, and bathroom cleaning.",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 2000 })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ enum: ["hourly", "fixed", "call_for_price"], example: "fixed" })
  @IsEnum(["hourly", "fixed", "call_for_price"])
  @IsOptional()
  paymentType?: "hourly" | "fixed" | "call_for_price";

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  requiresAppointment?: boolean;

  @ApiProperty({
    type: "string",
    format: "binary",
    isArray: true,
    description: "Upload multiple images",
  })
  @ApiPropertyOptional()
  images: any; // NestJS

  @ApiProperty({
    type: "string",
    format: "binary",
    isArray: true,
    description: "Upload One video file",
    maximum: 1,
  })
  @ApiPropertyOptional()
  video: any;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @IsOptional()
  category?: number;

  @ApiPropertyOptional({
    type: [ServiceParameterDto],
    example: [
      { name: "Color", variants: ["Red", "Blue"] },
    ],
    description: "Custom service parameters like size, color, etc.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceParameterDto)
  parameters?: ServiceParameterDto[];
}
