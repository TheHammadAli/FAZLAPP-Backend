import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsInt,
  IsEnum,
  IsArray,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class ServiceParameterDto {
  @ApiProperty({ example: "Color" })
  @IsString()
  name: string;

  @ApiProperty({ example: ["Red", "Blue"], type: [String] })
  @IsArray()
  @IsString({ each: true })
  variants: string[];
}


export class CreateServiceDto {
  @ApiProperty({
    example: "Home Cleaning",
    description: "Title of the service",
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: "We offer deep cleaning for all rooms." })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 1500, description: "Price of the service in PKR" })
  @IsNumber()
  price: number;

  @ApiProperty({ enum: ["hourly", "fixed", "call_for_price"], example: "hourly" })
  @IsEnum(["hourly", "fixed", "call_for_price"])
  paymentType: "hourly" | "fixed" | "call_for_price";

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  requiresAppointment?: boolean;

  @ApiProperty({
    type: "string",
    format: "binary",
    isArray: true,
    description: "Upload multiple images",
  })
  images: any; // NestJS

  @ApiProperty({
    type: "string",
    format: "binary",
    isArray: true,
    description: "Upload One video file",
    maximum: 1,
  })
  @IsNotEmpty()
  video: any;

  @ApiProperty({ example: 1, description: "Category ID" })
  @IsInt()
  category: number;



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
