import { forwardRef, Module } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { ServicesController } from "./services.controller";
import { SharedModule } from "src/shared/shared.module";
import { UsersModule } from "src/users/users.module";
import { NotificationsModule } from "src/notifications/notifications.module";
import { LikeModule } from "src/like/like.module";
import { ReviewsModule } from "src/reviews/reviews.module";
@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => LikeModule),
    forwardRef(() => SharedModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => ReviewsModule),
  ],
  providers: [ServicesService],
  controllers: [ServicesController],
  exports: [ServicesService],
})
export class ServicesModule { }
