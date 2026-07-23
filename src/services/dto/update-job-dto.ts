import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsInt, IsEnum } from "class-validator";

export class UpdateJobStatusDto {
  @ApiProperty()
  @IsInt()
  requestId!: number;

  @ApiProperty({ enum: ["start_job", "complete_job"] })
  @IsEnum(["start_job", "complete_job"])
  action!: "start_job" | "complete_job";
}
