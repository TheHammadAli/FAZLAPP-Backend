import { ApiPropertyOptional } from "@nestjs/swagger";

export class SearchAllProductsServiceDto {
  @ApiPropertyOptional({
    description: "Product name to search for",
    example: "iPhone",
  })
  name?: string;

  @ApiPropertyOptional({
    description: "Category of the product",
    example: 1,
  })
  category?: number;

  @ApiPropertyOptional({
    description: "Page number for pagination",
    example: 1,
  })
  page?: number;

  @ApiPropertyOptional({
    description: "Number of results per page",
    example: 20,
  })
  limit?: number;
}
