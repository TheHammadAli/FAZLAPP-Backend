import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateOrderDto {
  @ApiPropertyOptional({
    example: "confirmed",
    enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
    description: "Order status",
  })
  status?: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

  @ApiPropertyOptional({
    example: "Easypaisa",
    enum: ["cashonDelivery", "Easypaisa"],
    description: "Payment type",
  })
  paymentType?: "cashonDelivery" | "Easypaisa";

  @ApiPropertyOptional({ example: 599.99, description: "Order amount" })
  amount?: number;
}
