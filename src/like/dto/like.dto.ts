import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsInt, IsEnum } from "class-validator";

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
  @IsString()
  @IsEnum(["product", "service"])
  itemType: "product" | "service";

  @ApiProperty({ enum: ["Shop", "User"], description: "Owner model type" })
  @IsNotEmpty()
  @IsString()
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
  @IsString()
  @IsEnum(["product", "service"])
  itemType: "product" | "service";
}
