import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

/**
 * Renames Prisma's `id` primary-key field to `_id` recursively, everywhere in
 * a response, so the frontend (built against Mongo's `_id` shape) keeps
 * working unchanged after the Postgres/Prisma migration.
 */
@Injectable()
export class DatabaseCompatibilityInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.transform(data)));
  }

  private transform(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.transform(item));
    }

    if (value instanceof Date) {
      return value;
    }

    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        const transformed = this.transform(val);
        if (key === "id" && typeof val === "string") {
          result._id = transformed;
        } else {
          result[key] = transformed;
        }
      }
      return result;
    }

    return value;
  }
}
