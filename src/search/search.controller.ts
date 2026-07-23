import { Controller, Get, Query, BadRequestException } from "@nestjs/common";
import { SearchService } from "./search.service";
import { ProductsService } from "src/products/products.service";
import { ServicesService } from "src/services/services.service";
import { SearchAllProductsServiceDto } from "./dto/product-service-search-for.dto";
import { ApiOperation, ApiQuery } from "@nestjs/swagger";
@Controller("search")
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly productsService: ProductsService,
    private readonly servicesService: ServicesService,
  ) {}

  @Get("autocomplete-locations")
  @ApiOperation({
    summary: "Get location autocomplete suggestions from Google Places API",
  })
  @ApiQuery({
    name: "q",
    type: String,
    required: true,
    description: "Search query (e.g. partial city or address)",
  })
  async autocomplete(@Query("q") query: string) {
    return this.searchService.autocompleteLocations(query);
  }

  @Get()
  async searchNearby(
    @Query("type") type: "product" | "service",
    @Query("category") category: string,
    @Query("radius") radius: string,
    @Query("latitude") latitude: string,
    @Query("longitude") longitude: string,
    @Query("page") page = "1",
    @Query("limit") limit = "10",
  ) {
    // Validation
    if (!["product", "service"].includes(type)) {
      throw new BadRequestException('Type must be "product" or "service"');
    }

    const parsedRadius = parseFloat(radius);
    const parsedLatitude = parseFloat(latitude);
    const parsedLongitude = parseFloat(longitude);
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const parsedCategory = parseInt(category, 10);

    if (
      isNaN(parsedRadius) ||
      isNaN(parsedLatitude) ||
      isNaN(parsedLongitude) ||
      isNaN(parsedCategory)
    ) {
      throw new BadRequestException("Invalid or missing location parameters");
    }

    if (type === "product") {
      return this.productsService.searchNearbyWithCategory(
        parsedCategory,
        [parsedLatitude, parsedLongitude],
        parsedRadius,
        { page: parsedPage, limit: parsedLimit },
      );
    }

    return this.servicesService.searchNearbyWithCategory(
      parsedCategory,
      [parsedLatitude, parsedLongitude],
      parsedRadius,
      { page: parsedPage, limit: parsedLimit },
    );
  }

  @Get("all-products")
  async searchAllProducts(@Query() query: SearchAllProductsServiceDto) {
    console.log("Search query:", query);
    const { name, category, page = 1, limit = 20 } = query;

    // Validate pagination parameters
    if (page < 1 || limit < 1) {
      throw new BadRequestException("Page and limit must be greater than 0");
    }

    return this.productsService.searchProducts({
      name,
      category,
      page,
      limit,
    });
  }

  @Get("all-services")
  async searchAllServices(@Query() query: SearchAllProductsServiceDto) {
    console.log("Search query:", query);
    const { name, category, page = 1, limit = 20 } = query;

    // Validate pagination parameters
    if (page < 1 || limit < 1) {
      throw new BadRequestException("Page and limit must be greater than 0");
    }

    return this.servicesService.searchServices({
      name,
      category,
      page,
      limit,
    });
  }
}
