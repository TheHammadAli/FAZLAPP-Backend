import { Module } from "@nestjs/common";
import { ChatService } from "./chat.service";
import { ChatController } from "./chat.controller";
import { ChatGateway } from "./chat.gateway";
import { UsersModule } from "src/users/users.module";
import { ShopModule } from "src/shop/shop.module";
import { FileUploadService } from "src/common/file-upload/file-upload.service";
import { ConfigService } from "@nestjs/config";
import { NotificationsModule } from "src/notifications/notifications.module";
@Module({
  imports: [
    UsersModule,
    ShopModule,
    NotificationsModule,
  ],
  providers: [ChatService, ChatGateway, FileUploadService, ConfigService],
  controllers: [ChatController],
})
export class ChatModule {}
