import { ApiError } from '@probuild/api-client';
import { describe, expect, it, vi } from 'vitest';
import { applyServerErrors } from './forms';

type Values = { name: string; email: string };

function validation(errors: Array<{ path: string; message: string }>): ApiError {
  return new ApiError({
    type: 'about:blank#validation',
    title: 'Validation failed',
    status: 400,
    detail: 'One or more fields are invalid',
    errors,
  });
}

describe('applyServerErrors', () => {
  it('maps problem-details paths onto form fields', () => {
    const setError = vi.fn();
    const result = applyServerErrors<Values>(
      validation([{ path: 'email', message: 'Invalid email' }]),
      setError,
      ['name', 'email'],
    );
    expect(setError).toHaveBeenCalledWith('email', { type: 'server', message: 'Invalid email' });
    expect(result).toBeNull();
  });

  it('returns unmatched messages for a form-level alert', () => {
    const setError = vi.fn();
    const result = applyServerErrors<Values>(
      validation([{ path: 'rules.0.steps', message: 'Required' }]),
      setError,
      ['name'],
    );
    expect(setError).not.toHaveBeenCalled();
    expect(result).toBe('rules.0.steps: Required');
  });

  it('uses the problem detail when there are no field errors', () => {
    const error = new ApiError({
      type: 'x',
      title: 'Conflict',
      status: 409,
      detail: 'A user with this email already exists',
    });
    expect(applyServerErrors<Values>(error, vi.fn(), ['email'])).toBe(
      'A user with this email already exists',
    );
  });

  it('never leaks server error detail', () => {
    const error = new ApiError({
      type: 'x',
      title: 'Internal Server Error',
      status: 500,
      detail: 'stack trace here',
    });
    expect(applyServerErrors<Values>(error, vi.fn(), [])).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
