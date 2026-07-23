import { forwardRef, Module } from "@nestjs/common";
import { LikeController } from "./like.controller";
import { LikeService } from "./like.service";

import { ProductsModule } from "src/products/products.module";
import { ServicesModule } from "src/services/services.module";

@Module({
  imports: [
    forwardRef(() => ProductsModule),
    forwardRef(() => ServicesModule),
  ],
  controllers: [LikeController],
  providers: [LikeService],
  exports: [LikeService],
})
export class LikeModule {}
