import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty } from "class-validator";

export class GoogleLoginDto {
  @ApiProperty({
    description:
      "Google ID token obtained from Google SDK (Android, iOS, or Web)",
    example: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2Z...",
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
