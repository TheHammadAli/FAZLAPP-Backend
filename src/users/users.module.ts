import { forwardRef, Module } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { SharedModule } from "src/shared/shared.module";
import { ShopModule } from "src/shop/shop.module";
import { ProductsModule } from "src/products/products.module";
import { ServicesModule } from "src/services/services.module";
@Module({
  imports: [
    forwardRef(() => SharedModule),
    forwardRef(() => ShopModule),
    forwardRef(() => ProductsModule),
    forwardRef(() => ServicesModule),
  ],
  controllers: [UsersController],
  exports: [UsersService],
  providers: [UsersService],
})
export class UsersModule { }
