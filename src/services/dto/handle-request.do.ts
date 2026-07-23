import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsInt, IsDateString } from "class-validator";

export class HandleRequestDto {
  @ApiProperty({
    enum: [
      "create",
      "accept",
      "reject",
      "propose",
      "confirm",
      "cancel",
      "start_job",
      "complete_job",
      "verify_job",
      "dispute_job",
    ],
  })
  @IsEnum([
    "create",
    "accept",
    "reject",
    "propose",
    "confirm",
    "cancel",
    "start_job",
    "complete_job",
    "verify_job",
    "dispute_job",
  ])
  action: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  serviceId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  requestId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  customerId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  providerId?: number;

  @ApiPropertyOptional({ example: "2025-07-01T15:00:00Z" })
  @IsOptional()
  @IsDateString()
  requestedDateTime?: string;

  @ApiPropertyOptional({ example: "2025-07-01T18:00:00Z" })
  @IsOptional()
  @IsDateString()
  proposedDateTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}
