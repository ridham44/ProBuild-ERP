import { isApiError, errorMessage } from '@/lib/api/errors';
import type { FieldErrors, FieldValues, Path, Resolver, UseFormSetError } from 'react-hook-form';

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

type Plain = Record<string, unknown>;

/** Removes blank strings and NaN so optional fields are treated as "not provided" by the schema. */
export function stripBlank<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => stripBlank(entry)) as T;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Plain = {};
    for (const [key, entry] of Object.entries(value as Plain)) {
      if (entry === '' || entry === undefined || (typeof entry === 'number' && Number.isNaN(entry)))
        continue;
      out[key] = stripBlank(entry);
    }
    return out as T;
  }
  return value;
}

type Issue = { path: PropertyKey[]; message: string; code: string };

function friendlyMessage(issue: Issue): string {
  if (issue.code === 'invalid_type' && /received undefined|expected .* received/i.test(issue.message))
    return 'Required';
  if (issue.code === 'too_small' && /string/.test(issue.message)) return 'Required';
  return issue.message;
}

function nestError(target: Plain, path: PropertyKey[], message: string): void {
  let cursor = target;
  path.forEach((segment, index) => {
    const key = String(segment);
    if (index === path.length - 1) {
      if (!(key in cursor)) cursor[key] = { type: 'validation', message };
      return;
    }
    const next = (cursor[key] as Plain | undefined) ?? {};
    cursor[key] = next;
    cursor = next;
  });
}

/**
 * Resolver for react-hook-form that validates with a shared Zod schema but hands back the
 * (blank-stripped) form input, not the parsed output. The API validates the same schema again, so the
 * payload keeps plain strings for dates and decimals instead of Date objects.
 */
export function formResolver<I extends FieldValues>(schema: {
  safeParse: (value: unknown) => { success: boolean; error?: { issues: Issue[] } };
}): Resolver<I> {
  return async (values) => {
    const cleaned = stripBlank(values);
    const result = schema.safeParse(cleaned);
    if (result.success) return { values: cleaned as I, errors: {} };
    const errors: Plain = {};
    for (const issue of result.error?.issues ?? []) {
      nestError(errors, issue.path.length > 0 ? issue.path : ['root'], friendlyMessage(issue));
    }
    return { values: {}, errors: errors as FieldErrors<I> };
  };
}

/** For PATCH bodies: a field that had a value and was cleared in the form is sent as null. */
export function withClearedFields<T extends Plain>(
  initial: Plain,
  submitted: T,
  clearable: readonly string[],
): Plain {
  const out: Plain = { ...submitted };
  for (const key of clearable) {
    if (!(key in submitted) && initial[key] !== undefined && initial[key] !== null && initial[key] !== '')
      out[key] = null;
  }
  return out;
}
