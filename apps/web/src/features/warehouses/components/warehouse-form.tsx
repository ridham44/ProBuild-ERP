'use client';

import { createWarehouseSchema, WAREHOUSE_TYPES } from '@probuild/shared';
import type { z } from 'zod';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { EntityCombobox } from '@/components/common/entity-combobox';
import { SelectField, TextAreaField, TextField } from '@/components/common/form-controls';
import { FormField } from '@/components/common/form-field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { toast } from '@/components/ui/toast';
import { useCan } from '@/features/auth/components/current-user';
import { useBranches } from '@/features/branches/api/hooks';
import { searchProjectOptions } from '@/features/projects/api/hooks';
import type { WarehouseDetail } from '@/lib/api/types';
import { applyServerErrors, formResolver, withClearedFields } from '@/lib/forms';
import { titleCase } from '@/lib/format';
import { useCreateWarehouse, useUpdateWarehouse } from '../api/hooks';

type FormValues = z.input<typeof createWarehouseSchema>;
const FIELDS = ['code', 'name', 'type', 'branchId', 'projectId', 'address'] as const;
const CLEARABLE = ['branchId', 'projectId', 'address'];

function defaultsFor(warehouse: WarehouseDetail | null): FormValues {
  return {
    code: warehouse?.code ?? '',
    name: warehouse?.name ?? '',
    type: (warehouse?.type as FormValues['type']) ?? 'CENTRAL',
    branchId: warehouse?.branchId ?? '',
    projectId: warehouse?.projectId ?? '',
    address: warehouse?.address ?? '',
  };
}

function BodyGate(props: { warehouse: WarehouseDetail | null; onDone: (id: string) => void; onCancel: () => void }) {
  const canSeeBranches = useCan('organization.branch', 'VIEW');
  const branches = useBranches({ limit: 100 }, canSeeBranches);
  if (canSeeBranches && branches.isPending) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  return <Body {...props} />;
}

function Body({
  warehouse,
  onDone,
  onCancel,
}: {
  warehouse: WarehouseDetail | null;
  onDone: (id: string) => void;
  onCancel: () => void;
}) {
  const create = useCreateWarehouse();
  const update = useUpdateWarehouse(warehouse?.id ?? '');
  const canSeeBranches = useCan('organization.branch', 'VIEW');
  const canSeeProjects = useCan('projects.project', 'VIEW');
  const branches = useBranches({ limit: 100 }, canSeeBranches);
  const [formError, setFormError] = React.useState<string | null>(null);
  const pending = create.isPending || update.isPending;
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: formResolver<FormValues>(createWarehouseSchema),
    defaultValues: defaultsFor(warehouse),
  });

  function onSubmit(values: FormValues): void {
    if (pending) return;
    setFormError(null);
    const options = {
      onSuccess: (saved: { id: string; name: string }) => {
        toast.success(warehouse ? 'Warehouse updated' : 'Warehouse created', saved.name);
        onDone(saved.id);
      },
      onError: (error: unknown) => setFormError(applyServerErrors(error, setError, FIELDS)),
    };
    if (warehouse) update.mutate(withClearedFields(defaultsFor(warehouse), values, CLEARABLE), options);
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
        <SelectField label="Type" error={errors.type?.message} {...register('type')}>
          {WAREHOUSE_TYPES.map((type) => (
            <option key={type} value={type}>
              {titleCase(type)}
            </option>
          ))}
        </SelectField>
        {canSeeBranches ? (
          <SelectField label="Branch" error={errors.branchId?.message} {...register('branchId')}>
            <option value="">No branch</option>
            {(branches.data?.items ?? [])
              .filter((branch) => branch.active || branch.id === warehouse?.branchId)
              .map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
          </SelectField>
        ) : null}
        {canSeeProjects ? (
          <FormField
            label="Project"
            hint="Set for site and project warehouses so stock can be issued against the project."
            error={errors.projectId?.message}
          >
            {(field) => (
              <Controller
                control={control}
                name="projectId"
                render={({ field: bound }) => (
                  <EntityCombobox
                    entity="projects"
                    id={field.id}
                    search={searchProjectOptions}
                    value={bound.value || null}
                    {...(warehouse?.project ? { selectedLabel: warehouse.project.name } : {})}
                    onChange={(value) => bound.onChange(value ?? '')}
                    placeholder="Not tied to a project"
                    aria-invalid={field['aria-invalid']}
                    aria-describedby={field['aria-describedby']}
                  />
                )}
              />
            )}
          </FormField>
        ) : null}
        <TextAreaField label="Address" error={errors.address?.message} {...register('address')} />
      </div>
      <div className="flex justify-end gap-2 border-t border-border bg-surface-muted/50 px-4 py-2.5">
        <Button onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {warehouse ? 'Save changes' : 'Create warehouse'}
        </Button>
      </div>
    </form>
  );
}

export function WarehouseDrawer({
  open,
  onOpenChange,
  warehouse,
  navigateOnCreate = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse: WarehouseDetail | null;
  navigateOnCreate?: boolean;
}) {
  const router = useRouter();
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="w-[min(32rem,100vw)]"
        title={warehouse ? `Edit ${warehouse.name}` : 'New warehouse'}
        description="Warehouses hold stock. Storage locations are added on the warehouse page."
      >
        <BodyGate
          key={warehouse?.id ?? 'new'}
          warehouse={warehouse}
          onCancel={() => onOpenChange(false)}
          onDone={(id) => {
            onOpenChange(false);
            if (navigateOnCreate && !warehouse) router.push(`/inventory/warehouses/${id}`);
          }}
        />
      </DrawerContent>
    </Drawer>
  );
}
