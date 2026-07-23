import { ApiPropertyOptional } from "@nestjs/swagger";

export class GetWithVideosDto {
  @ApiPropertyOptional({
    description: "Page number",
    default: 1,
  })
  page?: number;

  @ApiPropertyOptional({
    description: "Items per page",
    default: 10,
  })
  limit?: number;

  @ApiPropertyOptional({
    description: "Which category to filter by",
  })
  category?: number;


  @ApiPropertyOptional({
    description: "User ID to filter by",
  })
  userId?: number;
}