import { forwardRef, Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { ShopModule } from "src/shop/shop.module";
import { SharedModule } from "src/shared/shared.module";
import { UsersModule } from "src/users/users.module";

import { PromotionModule } from "src/promotion/promotion.module";
import { LikeModule } from "src/like/like.module";
import { ReviewsModule } from "src/reviews/reviews.module";

@Module({
  imports: [
    forwardRef(() => LikeModule),
    forwardRef(() => ShopModule), // If circular dependency
    forwardRef(() => SharedModule),
    forwardRef(() => UsersModule),
    // If LikeService is used in ProductsService
    forwardRef(() => PromotionModule), // If PromotionService is used in ProductsService
    forwardRef(() => ReviewsModule),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule { }
