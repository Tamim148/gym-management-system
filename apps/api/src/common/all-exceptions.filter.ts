import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const timestamp = new Date().toISOString();
    const isProd = process.env.NODE_ENV === 'production';

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const record = body as Record<string, unknown>;
        if (typeof record.message === 'string') {
          message = record.message;
        } else if (Array.isArray(record.message)) {
          message = record.message.join('; ');
        }
        if (typeof record.errorCode === 'string') {
          errorCode = record.errorCode;
        } else {
          errorCode = this.statusToErrorCode(statusCode);
        }
        if (record.details !== undefined) {
          details = record.details;
        }
      } else {
        errorCode = this.statusToErrorCode(statusCode);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        statusCode = HttpStatus.CONFLICT;
        errorCode = 'CONFLICT';
        message = 'A record with this unique identifier already exists';
      } else if (exception.code === 'P2025') {
        statusCode = HttpStatus.NOT_FOUND;
        errorCode = 'NOT_FOUND';
        message = 'Requested resource was not found';
      } else {
        statusCode = HttpStatus.BAD_REQUEST;
        errorCode = 'DATABASE_CONSTRAINT_ERROR';
        message = isProd ? 'Invalid data operation' : 'Database constraint failed';
      }
    } else if (exception instanceof Error) {
      if (!isProd) {
        message = exception.message;
      }
      this.logger.error(
        `Unhandled exception on ${request?.method} ${request?.url}: ${exception.message}`,
      );
    }

    const payload: Record<string, unknown> = {
      statusCode,
      errorCode,
      message,
      timestamp,
    };

    if (details !== undefined) {
      payload.details = details;
    }

    response.status(statusCode).json(payload);
  }

  private statusToErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      default:
        return 'HTTP_ERROR';
    }
  }
}
