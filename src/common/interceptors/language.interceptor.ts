import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { ClsService } from "nestjs-cls";

@Injectable()
export class LanguageInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();

    const rawLang = req.headers["accept-language"];

    const lang =
      typeof rawLang === "string" ? rawLang.split(",")[0].split("-")[0] : "en";

    // 💡 store in CLS (global request context)
    this.cls.set("lang", lang);

    return next.handle();
  }
}
