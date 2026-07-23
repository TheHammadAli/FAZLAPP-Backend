import { forwardRef, Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { UsersModule } from "src/users/users.module";
import { ProductsModule } from "src/products/products.module";
import { ShopModule } from "src/shop/shop.module";
import { NotificationsModule } from "src/notifications/notifications.module";

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => ProductsModule),
    forwardRef(() => ShopModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule { }
