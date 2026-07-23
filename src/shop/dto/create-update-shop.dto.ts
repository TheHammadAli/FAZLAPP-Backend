import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsNumber,
  IsOptional,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

class LocationDto {
  @ApiProperty({ enum: ["Point"], example: "Point" })
  @IsEnum(["Point"], { message: 'Location type must be "Point"' })
  type: "Point";

  @ApiProperty({
    example: [73.0479, 33.6844],
    description: "Coordinates in [longitude, latitude] format",
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  coordinates: [number, number];
}

export class CreateUpdateShopDto {
  @ApiProperty({ example: "Smart Tech Store" })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: "Address of shop" })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: "Selling the latest smart gadgets and accessories." })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    type: "string",
    format: "binary",
    description: "Upload shop logo image",
  })
  @IsOptional()
  image?: any;

  @ApiPropertyOptional({
    type: "string",
    format: "binary",
    description: "Upload shop banner image",
  })
  @IsOptional()
  banner?: any;

  @ApiProperty({ type: LocationDto })
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;
}
