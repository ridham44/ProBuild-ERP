import { HttpException, HttpStatus } from '@nestjs/common';

/** A business rule was violated (e.g. insufficient stock). Maps to 422 problem details. */
export class BusinessRuleError extends HttpException {
  constructor(
    detail: string,
    readonly errors?: Array<{ path: string; message: string }>,
  ) {
    super({ title: 'Business rule violated', detail }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class NotFoundError extends HttpException {
  constructor(entity: string, id?: string) {
    super(
      { title: 'Not found', detail: id ? `${entity} ${id} was not found` : `${entity} was not found` },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ConflictError extends HttpException {
  constructor(detail: string) {
    super({ title: 'Conflict', detail }, HttpStatus.CONFLICT);
  }
}
