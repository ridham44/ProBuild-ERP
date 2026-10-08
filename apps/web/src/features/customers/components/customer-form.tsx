'use client';

import { createCustomerSchema, type CreateCustomerInput } from '@probuild/shared';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { SelectField, TextAreaField, TextField } from '@/components/common/form-controls';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { VAT_OPTIONS } from '@/features/company/schemas';
import type { Customer } from '@/lib/api/types';
import { applyServerErrors, formResolver, withClearedFields } from '@/lib/forms';
import { useCreateCustomer, useUpdateCustomer } from '../api/hooks';

type FormValues = CreateCustomerInput;
const FIELDS = [
  'code',
  'name',
  'isCompany',
  'tin',
  'vatStatus',
  'billingAddress',
  'siteAddress',
  'paymentTermsDays',
  'creditLimit',
  'bankInfo',
  'email',
  'phone',
] as const;
const CLEARABLE = ['tin', 'billingAddress', 'siteAddress', 'bankInfo', 'email', 'phone'];

function defaultsFor(customer: Customer | null): FormValues {
  return {
    code: customer?.code ?? '',
    name: customer?.name ?? '',
    isCompany: customer?.isCompany ?? true,
    tin: customer?.tin ?? '',
    vatStatus: customer?.vatStatus ?? 'VAT',
    billingAddress: customer?.billingAddress ?? '',
    siteAddress: customer?.siteAddress ?? '',
    paymentTermsDays: customer?.paymentTermsDays ?? 30,
    creditLimit: customer ? customer.creditLimit : '0',
    bankInfo: customer?.bankInfo ?? '',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
  };
}

function Body({
  customer,
  onDone,
  onCancel,
}: {
  customer: Customer | null;
  onDone: (saved: Customer) => void;
  onCancel: () => void;
}) {
  const create = useCreateCustomer();
  const update = useUpdateCustomer(customer?.id ?? '');
  const [formError, setFormError] = React.useState<string | null>(null);
  const pending = create.isPending || update.isPending;
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: formResolver<FormValues>(createCustomerSchema),
    defaultValues: defaultsFor(customer),
  });

  function onSubmit(values: FormValues): void {
    if (pending) return;
    setFormError(null);
    const options = {
      onSuccess: (saved: Customer) => {
        toast.success(customer ? 'Customer updated' : 'Customer created', saved.name);
        onDone(saved);
      },
      onError: (error: unknown) => setFormError(applyServerErrors(error, setError, FIELDS)),
    };
    if (customer) update.mutate(withClearedFields(defaultsFor(customer), values, CLEARABLE), options);
    else create.mutate(values, options);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-4">
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
          <TextField label="Code" required autoFocus inputClassName="font-mono" error={errors.code?.message} {...register('code')} />
          <TextField label="Name" required error={errors.name?.message} {...register('name')} />
        </div>
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="isCompany"
            render={({ field }) => (
              <Checkbox
                id="customer-company"
                checked={field.value !== false}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            )}
          />
          <Label htmlFor="customer-company">Registered company (not an individual)</Label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="TIN" inputClassName="font-mono" error={errors.tin?.message} {...register('tin')} />
          <SelectField label="VAT status" error={errors.vatStatus?.message} {...register('vatStatus')}>
            {VAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Payment terms (days)"
            type="number"
            min={0}
            max={365}
            error={errors.paymentTermsDays?.message}
            {...register('paymentTermsDays', { valueAsNumber: true })}
          />
          <TextField label="Credit limit (PHP)" inputMode="decimal" error={errors.creditLimit?.message} {...register('creditLimit')} />
          <TextField label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <TextField label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />
        </div>
        <TextAreaField label="Billing address" error={errors.billingAddress?.message} {...register('billingAddress')} />
        <TextAreaField label="Site address" error={errors.siteAddress?.message} {...register('siteAddress')} />
        <TextAreaField label="Bank details" error={errors.bankInfo?.message} {...register('bankInfo')} />
      </div>
      <div className="flex justify-end gap-2 border-t border-border bg-surface-muted/50 px-4 py-2.5">
        <Button onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {customer ? 'Save changes' : 'Create customer'}
        </Button>
      </div>
    </form>
  );
}

export function CustomerDrawer({
  open,
  onOpenChange,
  customer,
  navigateOnCreate = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  navigateOnCreate?: boolean;
}) {
  const router = useRouter();
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="w-[min(34rem,100vw)]"
        title={customer ? `Edit ${customer.name}` : 'New customer'}
        description="Customers are the clients that projects are contracted with."
      >
        <Body
          key={customer?.id ?? 'new'}
          customer={customer}
          onCancel={() => onOpenChange(false)}
          onDone={(saved) => {
            onOpenChange(false);
            if (navigateOnCreate && !customer) router.push(`/customers/${saved.id}`);
          }}
        />
      </DrawerContent>
    </Drawer>
  );
}
