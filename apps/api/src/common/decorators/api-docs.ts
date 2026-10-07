import { applyDecorators, Type } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse } from '@nestjs/swagger';

type ReturnsOptions = { created?: boolean; array?: boolean };

/** Documents the success response of a handler with a named, explicit schema. */
export const Returns = (dto: Type<unknown>, options: ReturnsOptions = {}) =>
  applyDecorators(
    options.created
      ? ApiCreatedResponse({ type: dto, isArray: options.array ?? false })
      : ApiOkResponse({ type: dto, isArray: options.array ?? false }),
  );

export const ReturnsNothing = () => applyDecorators(ApiNoContentResponse({ description: 'Deleted' }));
