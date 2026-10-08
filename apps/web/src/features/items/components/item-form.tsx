'use client';

import { createItemSchema, type CreateItemInput } from '@probuild/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { EntityCombobox } from '@/components/common/entity-combobox';
import { CheckField, SelectField, TextAreaField, TextField } from '@/components/common/form-controls';
import { FormField } from '@/components/common/form-field';
import { FormSection } from '@/components/common/form-section';
import { PageHeader } from '@/components/common/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { searchSupplierOptions } from '@/features/suppliers/api/hooks';
import type { ItemDetail } from '@/lib/api/types';
import { applyServerErrors, formResolver, withClearedFields } from '@/lib/forms';
import { useCreateItem, useItemCategories, useUoms, useUpdateItem } from '../api/hooks';
import { COSTING_OPTIONS, COST_CATEGORY_OPTIONS, ITEM_TYPE_OPTIONS } from '../model';
import { UnitConversionsEditor } from './unit-conversions-editor';
import { UomQuickAdd } from './uom-quick-add';

type FormValues = CreateItemInput;

const FIELDS = [
  'sku',
  'name',
  'description',
  'categoryId',
  'preferredSupplierId',
  'brand',
  'model',
  'specification',
  'itemType',
  'costCategory',
  'trackBatch',
  'trackSerial',
  'trackExpiry',
  'baseUnit',
  'purchaseUnit',
  'issueUnit',
  'conversionFactor',
  'barcode',
  'minStock',
  'maxStock',
  'reorderPoint',
  'safetyStock',
  'costingMethod',
  'standardCost',
  'allowableWastePct',
] as const;
const CLEARABLE = [
  'description',
  'categoryId',
  'preferredSupplierId',
  'brand',
  'model',
  'specification',
  'purchaseUnit',
  'issueUnit',
  'barcode',
];

function defaultsFor(item: ItemDetail | null): FormValues {
  const costing = item?.costingMethod === 'STANDARD' ? 'STANDARD' : 'WEIGHTED_AVERAGE';
  return {
    sku: item?.sku ?? '',
    name: item?.name ?? '',
    description: item?.description ?? '',
    categoryId: item?.categoryId ?? '',
    preferredSupplierId: item?.preferredSupplierId ?? '',
    brand: item?.brand ?? '',
    model: item?.model ?? '',
    specification: item?.specification ?? '',
    itemType: (item?.itemType as FormValues['itemType']) ?? 'CONSUMABLE',
    costCategory: (item?.costCategory as FormValues['costCategory']) ?? 'MATERIAL',
    trackBatch: item?.trackBatch ?? false,
    trackSerial: item?.trackSerial ?? false,
    trackExpiry: item?.trackExpiry ?? false,
    baseUnit: item?.baseUnit ?? '',
    purchaseUnit: item?.purchaseUnit ?? '',
    issueUnit: item?.issueUnit ?? '',
    conversionFactor: item?.conversionFactor ?? '1',
    barcode: item?.barcode ?? '',
    minStock: item?.minStock ?? '0',
    maxStock: item?.maxStock ?? '0',
    reorderPoint: item?.reorderPoint ?? '0',
    safetyStock: item?.safetyStock ?? '0',
    costingMethod: costing,
    standardCost: item?.standardCost ?? '0',
    allowableWastePct: item?.allowableWastePct ?? '0',
  };
}

/** Waits for the category and unit lists so the selects open on the saved values. */
export function ItemForm({ item }: { item: ItemDetail | null }) {
  const categories = useItemCategories();
  const uoms = useUoms();
  if (categories.isPending || uoms.isPending) return <Skeleton className="h-96 w-full max-w-4xl" />;
  return <ItemFormBody item={item} />;
}

function ItemFormBody({ item }: { item: ItemDetail | null }) {
  const router = useRouter();
  const create = useCreateItem();
  const update = useUpdateItem(item?.id ?? '');
  const categories = useItemCategories();
  const uoms = useUoms();
  const [formError, setFormError] = React.useState<string | null>(null);
  const pending = create.isPending || update.isPending;
  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: formResolver<FormValues>(createItemSchema),
    defaultValues: defaultsFor(item),
  });
  const costing = watch('costingMethod');
  const trackBatch = watch('trackBatch');
  const unitOptions = (uoms.data?.items ?? []).map((uom) => (
    <option key={uom.id} value={uom.code}>
      {uom.code} · {uom.name}
    </option>
  ));
  const legacyUnits = [item?.baseUnit, item?.purchaseUnit, item?.issueUnit].filter(
    (unit): unit is string => Boolean(unit) && !(uoms.data?.items ?? []).some((uom) => uom.code === unit),
  );

  function onSubmit(values: FormValues): void {
    if (pending) return;
    setFormError(null);
    const options = {
      onSuccess: (saved: ItemDetail) => {
        toast.success(item ? 'Item updated' : 'Item created', saved.name);
        router.push(`/inventory/items/${saved.id}`);
      },
      onError: (error: unknown) => setFormError(applyServerErrors(error, setError, FIELDS)),
    };
    if (item) update.mutate(withClearedFields(defaultsFor(item), values, CLEARABLE), options);
    else create.mutate(values, options);
  }

  const unitSelect = (name: 'baseUnit' | 'purchaseUnit' | 'issueUnit', label: string, required = false) => (
    <SelectField label={label} required={required} error={errors[name]?.message} {...register(name)}>
      <option value="">{required ? 'Select unit' : 'Same as base unit'}</option>
      {legacyUnits.map((unit) => (
        <option key={unit} value={unit}>
          {unit}
        </option>
      ))}
      {unitOptions}
    </SelectField>
  );

  return (
    <PermissionGate module="inventory.item" action={item ? 'EDIT' : 'CREATE'}>
      <PageHeader
        title={item ? `Edit ${item.name}` : 'New item'}
        breadcrumbs={[
          { label: 'Inventory' },
          { label: 'Items', href: '/inventory/items' },
          ...(item ? [{ label: item.sku, href: `/inventory/items/${item.id}` }, { label: 'Edit' }] : [{ label: 'New' }]),
        ]}
      />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-4xl">
        {formError ? (
          <Alert tone="danger" className="mb-4">
            {formError}
          </Alert>
        ) : null}
        <FormSection title="Identity" description="How the item is named and found.">
          <TextField label="SKU" required inputClassName="font-mono" error={errors.sku?.message} {...register('sku')} />
          <TextField label="Name" required error={errors.name?.message} {...register('name')} />
          <SelectField label="Category" error={errors.categoryId?.message} {...register('categoryId')}>
            <option value="">No category</option>
            {(categories.data?.items ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </SelectField>
          <FormField label="Preferred supplier" error={errors.preferredSupplierId?.message}>
            {(field) => (
              <Controller
                control={control}
                name="preferredSupplierId"
                render={({ field: bound }) => (
                  <EntityCombobox
                    entity="suppliers"
                    id={field.id}
                    search={searchSupplierOptions}
                    value={bound.value || null}
                    {...(item?.preferredSupplier ? { selectedLabel: item.preferredSupplier.name } : {})}
                    onChange={(value) => bound.onChange(value ?? '')}
                    placeholder="None"
                    aria-invalid={field['aria-invalid']}
                    aria-describedby={field['aria-describedby']}
                  />
                )}
              />
            )}
          </FormField>
          <TextField label="Brand" error={errors.brand?.message} {...register('brand')} />
          <TextField label="Model" error={errors.model?.message} {...register('model')} />
          <TextField label="Barcode" inputClassName="font-mono" error={errors.barcode?.message} {...register('barcode')} />
          <TextAreaField label="Specification" wide error={errors.specification?.message} {...register('specification')} />
          <TextAreaField label="Description" wide error={errors.description?.message} {...register('description')} />
        </FormSection>

        <FormSection title="Classification" description="Drives tracking and how costs are reported.">
          <SelectField label="Item type" error={errors.itemType?.message} {...register('itemType')}>
            {ITEM_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Cost category" error={errors.costCategory?.message} {...register('costCategory')}>
            {COST_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <div className="space-y-2 sm:col-span-2">
            <CheckField control={control} name="trackBatch" label="Track by batch" hint="Receipts and issues record a batch number." />
            <CheckField control={control} name="trackSerial" label="Track by serial number" hint="Each unit is identified individually." />
            <CheckField
              control={control}
              name="trackExpiry"
              label="Track expiry"
              hint={trackBatch ? 'Batches carry an expiry date.' : 'Requires batch tracking.'}
            />
            {errors.trackExpiry?.message ? (
              <p className="text-xs font-medium text-danger">{errors.trackExpiry.message}</p>
            ) : null}
          </div>
        </FormSection>

        <FormSection title="Units of measure" description="Stock is kept in the base unit. Purchase and issue units convert to it.">
          {unitSelect('baseUnit', 'Base unit', true)}
          {unitSelect('purchaseUnit', 'Purchase unit')}
          {unitSelect('issueUnit', 'Issue unit')}
          <div className="sm:col-span-2">
            <UomQuickAdd empty={uoms.isSuccess && uoms.data.items.length === 0} />
          </div>
          <TextField
            label="Default conversion factor"
            hint="Base units in one purchase unit."
            inputMode="decimal"
            error={errors.conversionFactor?.message}
            {...register('conversionFactor')}
          />
          <div className="sm:col-span-2">
            {item ? (
              <UnitConversionsEditor item={item} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Additional unit conversions (for example 1 bag = 40 kg) can be added once the item is saved.
              </p>
            )}
          </div>
        </FormSection>

        <FormSection title="Stock levels" description="Used for reorder alerts and shortage warnings, in base units.">
          <TextField label="Minimum stock" inputMode="decimal" error={errors.minStock?.message} {...register('minStock')} />
          <TextField label="Maximum stock" inputMode="decimal" error={errors.maxStock?.message} {...register('maxStock')} />
          <TextField label="Reorder point" inputMode="decimal" error={errors.reorderPoint?.message} {...register('reorderPoint')} />
          <TextField label="Safety stock" inputMode="decimal" error={errors.safetyStock?.message} {...register('safetyStock')} />
          <TextField
            label="Allowable waste (%)"
            inputMode="decimal"
            error={errors.allowableWastePct?.message}
            {...register('allowableWastePct')}
          />
        </FormSection>

        <FormSection title="Valuation" description="How stock value and issue cost are calculated.">
          <SelectField label="Valuation method" error={errors.costingMethod?.message} {...register('costingMethod')}>
            {COSTING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Standard cost (PHP)"
            inputMode="decimal"
            disabled={costing !== 'STANDARD'}
            hint={costing === 'STANDARD' ? 'Required and greater than zero for standard costing.' : 'Only used with standard cost.'}
            error={errors.standardCost?.message}
            {...register('standardCost')}
          />
          <p className="text-xs text-muted-foreground sm:col-span-2">
            {COSTING_OPTIONS.find((option) => option.value === costing)?.hint} FIFO is not offered.
          </p>
        </FormSection>

        <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
          <Button asChild disabled={pending}>
            <Link href={item ? `/inventory/items/${item.id}` : '/inventory/items'}>Cancel</Link>
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            {item ? 'Save changes' : 'Create item'}
          </Button>
        </div>
      </form>
    </PermissionGate>
  );
}
