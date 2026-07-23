import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsEnum, IsInt } from "class-validator";

export class CreateLikeDto {
  @ApiProperty({
    example: 1,
    description: "ID of the item to like",
  })
  @IsNotEmpty()
  @IsInt()
  itemId: number;

  @ApiProperty({
    enum: ["product", "service"],
    description: "Type of item being liked",
  })
  @IsNotEmpty()
  @IsEnum(["product", "service"])
  itemType: "product" | "service";

  @ApiProperty({ enum: ["Shop", "User"], description: "Owner model type" })
  @IsNotEmpty()
  @IsEnum(["Shop", "User"])
  ownerModel: "Shop" | "User";
}

export class RemoveLikeDto {
  @ApiProperty({
    example: 1,
    description: "ID of the item to unlike",
  })
  @IsNotEmpty()
  @IsInt()
  itemId: number;

  @ApiProperty({
    enum: ["product", "service"],
    description: "Type of item being unliked",
  })
  @IsNotEmpty()
  @IsEnum(["product", "service"])
  itemType: "product" | "service";
}
