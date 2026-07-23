import { ApiProperty } from "@nestjs/swagger";

export class CreateMessageDto {
  @ApiProperty({ example: 1 })
  conversationId: number;

  @ApiProperty({ example: 2 })
  senderId: number;

  @ApiProperty({ example: 3 })
  receiverId: number;

  @ApiProperty({ example: "Hello! Is this still available?" })
  text: string;
}
