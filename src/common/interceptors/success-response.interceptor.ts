import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class SuccessResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();

        return {
          success: true,
          statusCode: response.statusCode,
          message: data?.message || "Operation successful",
          error: null, // Explicit null error field
          data: data?.data || (data?.message ? undefined : data),
          ...(data?.meta && { meta: data.meta }),
          path: request.url,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
