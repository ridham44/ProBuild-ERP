import { passwordSchema } from '@probuild/shared';
import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Messages come straight from the shared schema, so the hints can never drift from the server rule. */
const RULES: ReadonlyArray<{ message: string; label: string }> = [
  { message: 'Use at least 12 characters', label: 'At least 12 characters' },
  { message: 'Include at least one letter', label: 'At least one letter' },
  { message: 'Include at least one number', label: 'At least one number' },
];

export function failedPolicyMessages(password: string): Set<string> {
  const result = passwordSchema.safeParse(password);
  return new Set(result.success ? [] : result.error.issues.map((issue) => issue.message));
}

export function PasswordPolicy({ password }: { password: string }) {
  const failed = failedPolicyMessages(password);
  const touched = password.length > 0;
  return (
    <ul className="space-y-0.5" aria-label="Password requirements">
      {RULES.map((rule) => {
        const met = touched && !failed.has(rule.message);
        return (
          <li
            key={rule.message}
            className={cn(
              'flex items-center gap-1.5 text-xs',
              met ? 'text-success' : 'text-muted-foreground',
            )}
          >
            {met ? (
              <Check className="size-3" aria-hidden />
            ) : (
              <Circle className="size-3" aria-hidden />
            )}
            <span>{rule.label}</span>
            <span className="sr-only">{met ? ' (met)' : ' (not met yet)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
