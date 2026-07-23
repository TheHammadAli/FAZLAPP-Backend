import { IsString, IsOptional, IsInt, IsEnum, IsDateString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
export class UpdateRequestStatusDto {
  @ApiProperty()
  @IsInt()
  requestId!: number;

  @ApiProperty({
    enum: ["accept", "reject", "cancel", "propose", "confirm"],
    description:
      "Action to perform on the request. Use 'confirm' when the buyer accepts a provider-proposed time.",
    example: "confirm",
  })
  @IsEnum(["accept", "reject", "cancel", "propose", "confirm"])
  action!: "accept" | "reject" | "cancel" | "propose" | "confirm";

  @ApiPropertyOptional({
    example: "2025-07-01T18:00:00Z",
    description:
      "Required when proposing a new date/time. Optional for confirm if the proposed time should be included.",
  })
  @IsOptional()
  @IsDateString()
  proposedDateTime?: string;
}
