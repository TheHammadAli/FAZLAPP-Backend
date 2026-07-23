import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { AppError } from "./app-error"; // adjust the import path as needed
import { Prisma } from "../../generated/prisma/client";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = "Internal Server Error";
    let message = "An unexpected error occurred";

    if (exception instanceof AppError) {
      status = exception.status;
      message = exception.message;
      error = exception.code;
      console.error("AppError:", exception.originalError ?? exception.stack);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Mirrors how Mongo-specific errors (duplicate key 11000, CastError) were
      // previously surfaced via AppError, so callers see the same shape/semantics.
      switch (exception.code) {
        case "P2002":
          status = HttpStatus.CONFLICT;
          error = "Conflict";
          message = "A record with this value already exists";
          break;
        case "P2025":
          status = HttpStatus.NOT_FOUND;
          error = "NotFound";
          message = "The requested record was not found";
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          error = "BadRequest";
          message = "A database request error occurred";
      }
      console.error("PrismaClientKnownRequestError:", exception.code, exception.message);
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      error = "BadRequest";
      message = "Invalid data provided to the database query";
      console.error("PrismaClientValidationError:", exception.message);
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
        error = exception.name.replace("Exception", "");
      } else if (typeof exceptionResponse === "object") {
        message = (exceptionResponse as any).message || message;
        error =
          (exceptionResponse as any).error ||
          exception.name.replace("Exception", "");
      }

      console.error("HttpException:", exception.stack);
    } else {
      console.error("Unhandled Exception:", exception);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      error,
      data: null,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
