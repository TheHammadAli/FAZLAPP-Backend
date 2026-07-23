import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsNumber,
  IsInt,
  IsString,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
} from "class-validator";
import { Type } from "class-transformer";
import { Location } from "src/users/users.interfaces";

class LocationDto implements Location {
  @ApiProperty({ enum: ["Point"], example: "Point" })
  @IsEnum(["Point"], { message: 'Location type must be "Point"' })
  type!: "Point";

  @ApiProperty({ example: [73.0479, 33.6844], description: "[lng, lat]" })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  coordinates!: [number, number];
}

export class CreateBroadcastDto {
  @ApiProperty({ example: "Need 50kg rice urgently" })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiPropertyOptional({ example: "123 Main St, Downtown City" })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  radius!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  categoryId!: number;

  @ApiProperty({ example: "product", enum: ["product", "service"] })
  @IsEnum(["product", "service"])
  @IsNotEmpty()
  type!: "product" | "service";

  @ApiProperty({ example: "Buying", enum: ["Buying", "Selling"] })
  @IsEnum(["Buying", "Selling"])
  @IsNotEmpty()
  purpose!: "Buying" | "Selling";

  @ApiPropertyOptional({ type: LocationDto })
  @ValidateNested()
  @Type(() => LocationDto)
  @IsOptional()
  location?: LocationDto;

  @ApiPropertyOptional({
    type: "array",
    items: {
      type: "string",
      format: "binary",
    },
  })
  files?: any[];
}