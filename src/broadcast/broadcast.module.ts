import { Module } from "@nestjs/common";

import { BroadcastController } from "./broadcast.controller";
import { BroadcastService } from "./broadcast.service";
import { BroadcastGateway } from "./broadcast.gateway";
import { ShopModule } from "../shop/shop.module";
import { CategoryModule } from "src/category/category.module";
import { UsersModule } from "src/users/users.module";
import { ServicesModule } from "src/services/services.module";
import { ProductsModule } from "src/products/products.module";
import { NotificationsModule } from "src/notifications/notifications.module";
import { FileUploadService } from "src/common/file-upload/file-upload.service";
import { ConfigService } from "@nestjs/config";

@Module({
  imports: [
    ShopModule,
    CategoryModule,
    UsersModule,
    ServicesModule,
    ProductsModule,
    NotificationsModule,
  ],
  controllers: [BroadcastController],
  providers: [
    BroadcastService,
    BroadcastGateway,
    FileUploadService,
    ConfigService,
  ],
  exports: [BroadcastService],
})
export class BroadcastModule { }
