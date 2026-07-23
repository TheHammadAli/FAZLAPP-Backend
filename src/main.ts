import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/exceptions/all-exceptions.filter";
import { SuccessResponseInterceptor } from "./common/interceptors/success-response.interceptor";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { LanguageInterceptor } from "./common/interceptors/language.interceptor";
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { DatabaseCompatibilityInterceptor } from "./common/interceptors/database-compatibility.interceptor";
import * as express from "express";
import { join } from "path";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: "*", // allow all origins
    credentials: false, // no cookies / sessions
  });

  app.use("/media", express.static(join(process.cwd(), "media")));

  app.useGlobalInterceptors(app.get(LanguageInterceptor));
  app.useGlobalInterceptors(new TimeoutInterceptor(60000));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new SuccessResponseInterceptor());
  app.useGlobalInterceptors(new DatabaseCompatibilityInterceptor());
  app.useWebSocketAdapter(new IoAdapter(app));
  const config = new DocumentBuilder()
    .setTitle("Buy & Sell API")
    .setDescription("API documentation for the Buy/Sell Platform")
    .setVersion("1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "Authorization",
        in: "header",
      },
      "jwt", // This is the security name
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const server = await app.listen(process.env.PORT ?? 3000, '::');
  server.keepAliveTimeout = 120000; // 2 minutes
  server.headersTimeout = 121000;   // Must be slightly higher than keepAliveTimeout
  server.timeout = 120000;
}
bootstrap();
