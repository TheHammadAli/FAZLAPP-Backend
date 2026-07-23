// src/categories/category.module.ts
import { Module } from "@nestjs/common";
import { CategoryService } from "./category.service";
import { CategoryController } from "./category.controller";
import { SharedModule } from "src/shared/shared.module";

@Module({
  imports: [SharedModule],
  providers: [CategoryService],
  controllers: [CategoryController],
  exports: [CategoryService],
})
export class CategoryModule { }
