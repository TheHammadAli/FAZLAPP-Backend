// common/decorators/api-lang-header.decorator.ts
import { applyDecorators } from "@nestjs/common";
import { ApiHeader } from "@nestjs/swagger";

export function ApiLangHeader() {
  return applyDecorators(
    ApiHeader({
      name: "accept-language",
      required: false,
      description: "Language code (e.g. en, ur)",
      schema: {
        default: "en",
      },
    }),
  );
}
