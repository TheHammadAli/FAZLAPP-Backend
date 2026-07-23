import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional } from "class-validator";

export class CreateOrderDto {
  @ApiProperty({
    example: 1,
    description: "Buyer user ID",
  })
  buyer: number;

  @ApiProperty({
    example: 2,
    description: "Owner (shop or user) ID",
  })
  owner: number;

  @ApiProperty({
    example: "Shop",
    enum: ["Shop", "User"],
    description: "Owner model discriminator",
  })
  ownerModel: "Shop" | "User";

  @ApiProperty({
    example: 3,
    description: "Product ID",
  })
  product: number;

  @ApiProperty({ example: "self-pickup", enum: ["self-pickup", "delivery"] })
  deliveryOption: "self-pickup" | "delivery";

  @ApiPropertyOptional({
    example: "pending",
    enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
  })
  status?: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

  @ApiPropertyOptional({
    example: "cashonDelivery",
    enum: ["cashonDelivery", "Easypaisa"],
  })
  paymentType?: "cashonDelivery" | "Easypaisa";

  @ApiProperty({ example: 499.99 })
  amount: number;

  @ApiProperty({ example: { size: "M", color: "black" } })
  @IsOptional()
  variant: Record<string, any>;

  @ApiProperty({ example: 1 })
  quantity: number;
}
