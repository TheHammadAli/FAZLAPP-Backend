import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsNumber,
  ValidateNested,
  ArrayNotEmpty,
  IsOptional,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Location } from "../users.interfaces";

class LocationDto implements Location {
  @ApiProperty({ enum: ["Point"], example: "Point" })
  @IsEnum(["Point"], { message: 'Location type must be "Point"' })
  type: "Point";

  @ApiProperty({ example: [73.0479, 33.6844], description: "[lng, lat]" })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  coordinates: [number, number];
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: "secret123" })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ example: "+923001234567" })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: "Street 1, City" })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    example: ["buyer"],
    enum: ["buyer", "seller", "admin", "subadmin"],
    isArray: true,
  })
  @IsArray()
  @IsOptional()
  @IsEnum(["buyer", "seller", "admin", "subadmin"], { each: true })
  roles?: ("buyer" | "seller" | "admin" | "subadmin")[];

  @ApiPropertyOptional({ enum: ["en", "ur"], example: "en" })
  @IsEnum(["en", "ur"], { message: "Language must be either en or ur" })
  @IsOptional()
  language?: "en" | "ur";

  @ApiPropertyOptional({ type: LocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiPropertyOptional({
    type: "string",
    format: "binary",
    isArray: true,
    description: "Upload image",
  })
  image?: any;

  @ApiPropertyOptional({ example: "" })
  @IsOptional()
  @IsString()
  refreshToken?: null | string;

  @ApiPropertyOptional({ example: "" })
  @IsOptional()
  @IsString()
  resetPasswordToken?: null | string;

  @ApiPropertyOptional({ example: "" })
  @IsOptional()
  resetPasswordExpires?: null | Date;
}
