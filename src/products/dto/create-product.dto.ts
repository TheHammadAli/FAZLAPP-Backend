import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsInt,
  IsOptional,
  ValidateNested,
  IsArray,
  IsDateString,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

class ProductParameterDto {
  @ApiProperty({ example: "Color" })
  @IsString()
  name: string;

  @ApiProperty({ example: ["Red", "Blue"], type: [String] })
  @IsArray()
  @IsString({ each: true })
  variants: string[];
}

export class CreateProductDto {
  @ApiProperty({ example: "Wireless Mouse" })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: "Ergonomic wireless mouse" })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 1999 })
  @IsNumber()
  price: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  category: number;

  @ApiProperty({
    example: "retail",
    enum: ["retail", "classified"],
    description: "Product Type",
  })
  type: "retail" | "classified";

  @ApiPropertyOptional({
    type: [String],
    example: ["https://img.com/p1.jpg", "https://img.com/p2.jpg"],
  })
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

  @ApiPropertyOptional({
    type: [ProductParameterDto],
    example: [
      { name: "Color", variants: ["Red", "Blue"] },
    ],
    description: "Custom product parameters like size, color, etc.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductParameterDto)
  parameters?: ProductParameterDto[];
}
