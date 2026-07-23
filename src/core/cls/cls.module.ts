import { Module } from "@nestjs/common";
import { ClsModule } from "nestjs-cls";

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true, // enables request context automatically
      },
    }),
  ],
})
export class ClsConfigModule {}
