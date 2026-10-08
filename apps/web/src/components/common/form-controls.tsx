'use client';

import * as React from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FormField } from '@/components/common/form-field';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

type FieldChrome = {
  label: string;
  error?: string | undefined;
  hint?: React.ReactNode;
  required?: boolean;
  wide?: boolean;
  className?: string;
};

export const TextField = React.forwardRef<
  HTMLInputElement,
  FieldChrome & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> & { inputClassName?: string }
>(function TextField(
  { label, error, hint, required, wide, className, inputClassName, ...input },
  ref,
) {
  return (
    <FormField
      label={label}
      error={error}
      hint={hint}
      {...(required ? { required } : {})}
      {...(wide ? { wide } : {})}
      {...(className ? { className } : {})}
    >
      {(control) => <Input ref={ref} {...control} className={inputClassName} {...input} />}
    </FormField>
  );
});

export const TextAreaField = React.forwardRef<
  HTMLTextAreaElement,
  FieldChrome & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>
>(function TextAreaField({ label, error, hint, required, wide, className, ...input }, ref) {
  return (
    <FormField
      label={label}
      error={error}
      hint={hint}
      {...(required ? { required } : {})}
      {...(wide ? { wide } : {})}
      {...(className ? { className } : {})}
    >
      {(control) => <Textarea ref={ref} rows={2} {...control} {...input} />}
    </FormField>
  );
});

export const SelectField = React.forwardRef<
  HTMLSelectElement,
  FieldChrome & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'>
>(function SelectField(
  { label, error, hint, required, wide, className, children, ...input },
  ref,
) {
  return (
    <FormField
      label={label}
      error={error}
      hint={hint}
      {...(required ? { required } : {})}
      {...(wide ? { wide } : {})}
      {...(className ? { className } : {})}
    >
      {(control) => (
        <Select ref={ref} {...control} {...input}>
          {children}
        </Select>
      )}
    </FormField>
  );
});

/** Checkbox bound to a react-hook-form boolean field, with an optional explanatory line. */
export function CheckField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  disabled,
}: {
  control: Control<T>;
  name: Path<T>;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  const id = React.useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-start gap-2">
          <Checkbox
            id={id}
            checked={field.value === true}
            disabled={disabled}
            onCheckedChange={(checked) => field.onChange(checked === true)}
            className="mt-0.5"
          />
          <div>
            <Label htmlFor={id}>{label}</Label>
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          </div>
        </div>
      )}
    />
  );
}
