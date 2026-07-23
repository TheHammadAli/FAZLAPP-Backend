import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, IsNotEmpty } from "class-validator";

export class SendBroadcastMessageDto {
  @ApiProperty({
    example: 1,
    description: "Receiver user ID",
  })
  @IsInt()
  @IsNotEmpty()
  receiverId: number;

  @ApiProperty({
    example: 2,
    description: "Thread ID (usually sellerId)",
  })
  @IsInt()
  @IsNotEmpty()
  threadId: number;

  @ApiProperty({
    example: "I can supply at best price",
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ type: "string", format: "binary", required: false })
  file?: any;
}
