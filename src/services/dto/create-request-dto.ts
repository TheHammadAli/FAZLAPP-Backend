import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsInt, IsDateString } from "class-validator";
export class CreateRequestDto {
  @ApiProperty()
  @IsInt()
  serviceId!: number;

  @ApiProperty()
  @IsInt()
  customerId!: number;

  @ApiProperty({ example: "2025-07-01T15:00:00Z" })
  @IsDateString()
  requestedDateTime!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}
