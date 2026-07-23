import { forwardRef, Module } from "@nestjs/common";
import { ShopService } from "./shop.service";
import { ShopController } from "./shop.controller";
import { SharedModule } from "src/shared/shared.module";
import { ProductsModule } from "src/products/products.module";
import { ServicesModule } from "src/services/services.module";
import { UsersModule } from "src/users/users.module";
import { OrdersModule } from "src/orders/orders.module";

@Module({
  imports: [
    forwardRef(() => SharedModule),
    forwardRef(() => ProductsModule),
    forwardRef(() => UsersModule),
    forwardRef(() => ServicesModule),
    forwardRef(() => OrdersModule),
  ],
  providers: [ShopService],
  controllers: [ShopController],
  exports: [ShopService],
})
export class ShopModule { }
