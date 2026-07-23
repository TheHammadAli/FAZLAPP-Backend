import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RefreshTokenDto {
  @ApiProperty({
    example: "your-refresh-token-here",
    description: "Refresh token string",
  })
  @IsString()
  @IsNotEmpty({ message: "refreshToken must not be empty" })
  token: string;
}
