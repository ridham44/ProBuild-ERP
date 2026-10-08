'use client';

import { createSupplierSchema, type CreateSupplierInput } from '@probuild/shared';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { SelectField, TextAreaField, TextField } from '@/components/common/form-controls';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { toast } from '@/components/ui/toast';
import { VAT_OPTIONS } from '@/features/company/schemas';
import type { Supplier } from '@/lib/api/types';
import { applyServerErrors, formResolver, withClearedFields } from '@/lib/forms';
import { useCreateSupplier, useUpdateSupplier } from '../api/hooks';

type FormValues = CreateSupplierInput;
const FIELDS = [
  'code',
  'name',
  'tin',
  'vatStatus',
  'address',
  'bankInfo',
  'paymentTermsDays',
  'category',
  'productCategories',
  'ewtCode',
  'email',
  'phone',
  'notes',
] as const;
const CLEARABLE = FIELDS.filter((field) => field !== 'code' && field !== 'name');

function defaultsFor(supplier: Supplier | null): FormValues {
  return {
    code: supplier?.code ?? '',
    name: supplier?.name ?? '',
    tin: supplier?.tin ?? '',
    vatStatus: supplier?.vatStatus ?? 'VAT',
    address: supplier?.address ?? '',
    bankInfo: supplier?.bankInfo ?? '',
    paymentTermsDays: supplier?.paymentTermsDays ?? 30,
    category: supplier?.category ?? '',
    productCategories: supplier?.productCategories ?? '',
    ewtCode: supplier?.ewtCode ?? '',
    email: supplier?.email ?? '',
    phone: supplier?.phone ?? '',
    notes: supplier?.notes ?? '',
  };
}

function SupplierFormBody({
  supplier,
  onDone,
  onCancel,
}: {
  supplier: Supplier | null;
  onDone: (saved: Supplier) => void;
  onCancel: () => void;
}) {
  const create = useCreateSupplier();
  const update = useUpdateSupplier(supplier?.id ?? '');
  const [formError, setFormError] = React.useState<string | null>(null);
  const pending = create.isPending || update.isPending;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: formResolver<FormValues>(createSupplierSchema),
    defaultValues: defaultsFor(supplier),
  });

  function onSubmit(values: FormValues): void {
    if (pending) return;
    setFormError(null);
    const options = {
      onSuccess: (saved: Supplier) => {
        toast.success(supplier ? 'Supplier updated' : 'Supplier created', saved.name);
        onDone(saved);
      },
      onError: (error: unknown) => setFormError(applyServerErrors(error, setError, FIELDS)),
    };
    if (supplier) {
      update.mutate(withClearedFields(defaultsFor(supplier), values, CLEARABLE), options);
    } else {
      create.mutate(values, options);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      aria-label={supplier ? 'Edit supplier' : 'New supplier'}
    >
      <div className="scroll-thin flex-1 space-y-5 overflow-y-auto p-4">
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Identity</legend>
          <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
            <TextField
              label="Code"
              required
              autoFocus
              inputClassName="font-mono"
              error={errors.code?.message}
              {...register('code')}
            />
            <TextField label="Registered name" required error={errors.name?.message} {...register('name')} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Category" hint="e.g. Cement, Steel, Electrical" error={errors.category?.message} {...register('category')} />
            <TextField label="Products supplied" error={errors.productCategories?.message} {...register('productCategories')} />
          </div>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Tax and payment</legend>
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
              inputMode="numeric"
              error={errors.paymentTermsDays?.message}
              {...register('paymentTermsDays', { valueAsNumber: true })}
            />
            <TextField label="EWT code" error={errors.ewtCode?.message} {...register('ewtCode')} />
          </div>
          <TextAreaField label="Bank details" error={errors.bankInfo?.message} {...register('bankInfo')} />
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Contact</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Email" type="email" error={errors.email?.message} {...register('email')} />
            <TextField label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />
          </div>
          <TextAreaField label="Address" error={errors.address?.message} {...register('address')} />
          <TextAreaField label="Internal notes" error={errors.notes?.message} {...register('notes')} />
        </fieldset>
      </div>
      <div className="flex justify-end gap-2 border-t border-border bg-surface-muted/50 px-4 py-2.5">
        <Button onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {supplier ? 'Save changes' : 'Create supplier'}
        </Button>
      </div>
    </form>
  );
}

export function SupplierDrawer({
  open,
  onOpenChange,
  supplier,
  navigateOnCreate = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
  /** On the list page, open the new supplier's page after creating it. */
  navigateOnCreate?: boolean;
}) {
  const router = useRouter();
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="w-[min(36rem,100vw)]"
        title={supplier ? `Edit ${supplier.name}` : 'New supplier'}
        description={
          supplier
            ? 'Changes apply to new documents; existing orders keep their terms.'
            : 'Contacts and accreditation are recorded on the supplier page after it is created.'
        }
      >
        <SupplierFormBody
          key={supplier?.id ?? 'new'}
          supplier={supplier}
          onCancel={() => onOpenChange(false)}
          onDone={(saved) => {
            onOpenChange(false);
            if (navigateOnCreate && !supplier) router.push(`/procurement/suppliers/${saved.id}`);
          }}
        />
      </DrawerContent>
    </Drawer>
  );
}
