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

export class CreateUpdateUserDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: "secret123" })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: "John Doe" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: "+923001234567" })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: "Street 1, City" })
  @IsString()
  address: string;

  @ApiProperty({
    example: ["buyer"],
    enum: ["buyer", "seller", "admin", "subadmin"],
    isArray: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(["buyer", "seller", "admin", "subadmin"], { each: true })
  roles: ("buyer" | "seller" | "admin" | "subadmin")[];

  @ApiProperty({ enum: ["en", "ur"], example: "en" })
  @IsEnum(["en", "ur"], { message: "Language must be either en or ur" })
  language: "en" | "ur";

  @ApiProperty({ example: true })
  @IsBoolean()
  isVerified: boolean;

  @ApiProperty({ type: LocationDto })
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @ApiProperty({
    type: "string",
    format: "binary",
    isArray: true,
    description: "Upload image",
  })
  image: any; // NestJS will handle file upload

  @ApiProperty({ example: "local" })
  @IsString()
  provider: string;
}
