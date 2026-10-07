import { isApiError, errorMessage } from '@/lib/api/errors';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

/**
 * Maps ProblemDetails.errors (path/message) onto form fields. Returns a message for anything that
 * does not belong to a known field, so the caller can show it in a form-level alert.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  if (!isApiError(error)) return errorMessage(error);
  const unmatched: string[] = [];
  let matched = 0;
  for (const issue of error.problem.errors ?? []) {
    const field = fields.find((name) => name === issue.path);
    if (field) {
      setError(field, { type: 'server', message: issue.message });
      matched += 1;
    } else {
      unmatched.push(issue.path ? `${issue.path}: ${issue.message}` : issue.message);
    }
  }
  if (unmatched.length > 0) return unmatched.join('. ');
  return matched > 0 ? null : errorMessage(error);
}
