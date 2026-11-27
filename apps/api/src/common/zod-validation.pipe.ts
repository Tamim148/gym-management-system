import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, ZodObject, ZodTypeAny } from 'zod';

@Injectable()
export class ZodValidationPipe<T = unknown> implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}

  transform(value: unknown): T {
    try {
      const strictSchema =
        this.schema instanceof ZodObject ? this.schema.strict() : this.schema;
      return strictSchema.parse(value) as T;
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: error.errors[0]?.message || 'Validation failed',
          errorCode: 'VALIDATION_ERROR',
          details: error.errors.map((issue) => ({
            path: issue.path.join('.'),
            code: issue.code,
            message: issue.message,
          })),
        });
      }
      throw new BadRequestException({
        message: 'Invalid request payload',
        errorCode: 'VALIDATION_ERROR',
      });
    }
  }
}
