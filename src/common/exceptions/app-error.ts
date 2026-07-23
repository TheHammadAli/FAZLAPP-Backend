import { HttpStatus, HttpException } from "@nestjs/common";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string = "INTERNAL_ERROR",
    public readonly status: number = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly originalError?: any,
  ) {
    super(message);
    this.name = "AppError";

    if (originalError instanceof HttpException) {
      const res = originalError.getResponse();
      this.message = typeof res === "string" ? res : res["message"];
      this.code = typeof res === "object" ? res["error"] : code;
      this.status = originalError.getStatus();
    }

    Error.captureStackTrace(this, this.constructor);
  }
}
