import { forwardRef, Module } from "@nestjs/common";
import { ListingUtilsService } from "./listing-util-service";
import { ProductsModule } from "src/products/products.module";
import { ServicesModule } from "src/services/services.module";
import { FileUploadService } from "src/common/file-upload/file-upload.service";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => ProductsModule),
    forwardRef(() => ServicesModule),
  ],
  providers: [ListingUtilsService, FileUploadService],

  exports: [ListingUtilsService, FileUploadService],
})
export class SharedModule {}
