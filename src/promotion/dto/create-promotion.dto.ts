import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreatePromotionDto {
  @ApiProperty({ type: Number, description: "Subscription ID" })
  subscriptionId: number;

  @ApiProperty({ enum: ["Product", "Shop"], description: "Target type" })
  targetType: "Product" | "Shop";

  @ApiProperty({ type: Number, description: "Target ID (Product or Shop)" })
  targetId: number;

  @ApiProperty({ type: String, format: "date-time" })
  startDate: Date;

  @ApiProperty({ type: String, format: "date-time" })
  endDate: Date;

  @ApiPropertyOptional({
    enum: ["active", "expired", "cancelled", "scheduled"],
    default: "active",
  })
  status?: "active" | "expired" | "cancelled" | "scheduled";

  @ApiPropertyOptional({ default: false })
  isAutoRenew?: boolean;
}
