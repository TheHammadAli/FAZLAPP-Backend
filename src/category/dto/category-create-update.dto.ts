import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

import {
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";

import { CategoryType } from "src/generated/prisma/enums";

class CategoryParametersDto {
  @ApiProperty({ example: ["Size", "Color"] })
  @IsArray()
  @IsString({ each: true })
  en!: string[];

  @ApiProperty({ example: ["سائز", "رنگ"] })
  @IsArray()
  @IsString({ each: true })
  ur!: string[];
}

export class CreateUpdateCategoryDto {
  @ApiProperty({
    example: {
      en: "Cleaning",
      ur: "صفائی",
    },
  })
  @IsObject()
  name!: Record<string, string>;

  @ApiPropertyOptional({
    example: {
      en: "Home cleaning and sanitization services",
      ur: "گھر کی صفائی اور جراثیم کش خدمات",
    },
  })
  @IsOptional()
  @IsObject()
  description?: Record<string, string>;

  @ApiPropertyOptional({
    example: {
      en: ["Size", "Color"],
      ur: ["سائز", "رنگ"],
    },
    type: CategoryParametersDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryParametersDto)
  parameters?: CategoryParametersDto;

  @ApiPropertyOptional({ type: "string", format: "binary" })
  @IsOptional()
  icon?: any;

  @ApiProperty({
    enum: CategoryType,
    example: CategoryType.service,
  })
  @IsEnum(CategoryType)
  type!: CategoryType;

  @ApiPropertyOptional({
    example: 1,
    description: "Used to control display ordering of categories",
  })
  @IsOptional()
  @IsInt()
  sortNumber?: number;

  @ApiPropertyOptional({
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isDisabled?: boolean;
}
