// src/common/decorators/current-user.decorator.ts

import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentUser = createParamDecorator(
  (data: "sub" | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    const user = request.user as { sub: number };

    // If specific field requested → return it
    if (data) {
      return user?.[data];
    }

    // Otherwise return full user object
    return user;
  },
);
