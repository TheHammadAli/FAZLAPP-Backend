import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ProductsModule } from "./products/products.module";
import { SearchModule } from "./search/search.module";
import { ConfigModule } from "@nestjs/config";
import { ShopModule } from "./shop/shop.module";
import { CategoryModule } from "./category/category.module";
import { ServicesModule } from "./services/services.module";
import { ChatModule } from "./chat/chat.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { AcceptLanguageResolver, I18nModule, QueryResolver } from "nestjs-i18n";
import { OrdersModule } from "./orders/orders.module";
import { SubscriptionModule } from "./subscription/subscription.module";
import { PromotionModule } from "./promotion/promotion.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { BroadcastModule } from "./broadcast/broadcast.module";
import { ClsConfigModule } from "./core/cls/cls.module";
import { PrismaModule } from "./core/prisma/prisma.module";

import * as path from "path";
import { LanguageInterceptor } from "./common/interceptors/language.interceptor";
import { LikeModule } from "./like/like.module";

const isProduction = process.env.NODE_ENV === "production";

@Module({
  imports: [
    ConfigModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 100,
        },
      ],
    }),
    I18nModule.forRoot({
      fallbackLanguage: "en",
      loaderOptions: {
        path: path.join(process.cwd(), "src/i18n/"),
        watch: !isProduction,
      },
      resolvers: [
        { use: QueryResolver, options: ["lang", "locale", "l"] }, // supports ?lang=ur
        AcceptLanguageResolver, // supports Accept-Language header
      ],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClsConfigModule,
    ProductsModule,
    ServicesModule,
    SearchModule,
    ShopModule,
    CategoryModule,
    ChatModule,
    ReviewsModule,
    OrdersModule,
    SubscriptionModule,
    PromotionModule,
    NotificationsModule,
    BroadcastModule,
    LikeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    LanguageInterceptor,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
