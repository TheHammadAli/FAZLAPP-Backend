import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsInt, IsString } from "class-validator";

export class RespondBroadcastDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  broadcastId: number;

  @ApiProperty({ example: 2, description: "sellerId" })
  @IsInt()
  @IsNotEmpty()
  sellerId: number;

  @ApiProperty({ example: "I can supply at best price within 2 hours" })
  @IsString()
  @IsNotEmpty()
  message: string;
}
