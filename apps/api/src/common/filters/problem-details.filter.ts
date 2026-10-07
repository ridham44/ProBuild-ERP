import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ProblemDetails } from '@probuild/shared';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

/** RFC 9457 problem details for every error. Internal errors never leak to clients. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<Request & { id?: string }>();
    const problem = this.toProblem(exception);
    if (problem.status >= 500) {
      this.logger.error({ err: exception, requestId: req.id, path: req.url }, 'Unhandled error');
    }
    res.status(problem.status).type('application/problem+json').json(problem);
  }

  private toProblem(exception: unknown): ProblemDetails {
    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError();
      return {
        type: 'about:blank#validation',
        title: 'Validation failed',
        status: HttpStatus.BAD_REQUEST,
        detail: 'One or more fields are invalid',
        errors:
          zodError instanceof ZodError
            ? zodError.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
            : [],
      };
    }
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.fromPrismaError(exception);
      if (mapped) return mapped;
    }
    return { type: 'about:blank#500', title: 'Internal Server Error', status: 500, detail: 'An unexpected error occurred' };
  }

  private fromHttpException(exception: HttpException): ProblemDetails {
    const status = exception.getStatus();
    const body = exception.getResponse();
    const obj = typeof body === 'string' ? { message: body } : (body as Record<string, unknown>);
    const detail =
      typeof obj.detail === 'string'
        ? obj.detail
        : Array.isArray(obj.message)
          ? obj.message.join('; ')
          : String(obj.message ?? exception.message);
    const errors = (exception as { errors?: ProblemDetails['errors'] }).errors;
    return {
      type: `about:blank#${status}`,
      title: typeof obj.title === 'string' ? obj.title : (HttpStatus[status]?.replace(/_/g, ' ') ?? 'Error'),
      status,
      detail,
      ...(errors ? { errors } : {}),
    };
  }

  private fromPrismaError(exception: Prisma.PrismaClientKnownRequestError): ProblemDetails | null {
    switch (exception.code) {
      case 'P2002':
        return { type: 'about:blank#409', title: 'Conflict', status: 409, detail: 'A record with the same unique value already exists' };
      case 'P2025':
        return { type: 'about:blank#404', title: 'Not found', status: 404, detail: 'The record was not found' };
      case 'P2003':
        return { type: 'about:blank#409', title: 'Conflict', status: 409, detail: 'The record references, or is referenced by, another record' };
      default:
        return null;
    }
  }
}
