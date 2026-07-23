import { Module } from "@nestjs/common";
import { SearchService } from "./search.service";
import { SearchController } from "./search.controller";
import { ProductsModule } from "src/products/products.module";
import { ServicesModule } from "src/services/services.module";
import { ShopModule } from "src/shop/shop.module";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [ProductsModule, ServicesModule, ShopModule, ConfigModule], // ✅ Modular and consistent
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
