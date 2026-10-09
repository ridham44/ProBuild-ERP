'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { EntityCombobox } from '@/components/common/entity-combobox';
import { TextAreaField, TextField } from '@/components/common/form-controls';
import { FormField } from '@/components/common/form-field';
import {
  blankItemQtyLine,
  ItemQtyLines,
  validateItemQtyLine,
  type ItemQtyLine,
} from '@/components/common/item-qty-lines';
import { Panel } from '@/components/common/panel';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useWorkContext } from '@/features/context/work-context';
import { searchCostCodeOptions, searchProjectOptions, useProject } from '@/features/projects/api/hooks';
import { searchWarehouseOptions, useWarehouse } from '@/features/warehouses/api/hooks';
import { saveErrorMessage } from '@/lib/api/errors';
import { useCreateMaterialRequest, type MaterialRequestInput } from '../api/hooks';

type Header = {
  projectId: string;
  warehouseId: string;
  costCodeId: string;
  costCodeLabel: string;
  neededDate: string;
  purpose: string;
  remarks: string;
};

export function MaterialRequestForm() {
  const router = useRouter();
  const { projectId: contextProject } = useWorkContext();
  const create = useCreateMaterialRequest();
  const [header, setHeader] = React.useState<Header>({
    projectId: contextProject ?? '',
    warehouseId: '',
    costCodeId: '',
    costCodeLabel: '',
    neededDate: '',
    purpose: '',
    remarks: '',
  });
  const [lines, setLines] = React.useState<ItemQtyLine[]>(() => [blankItemQtyLine()]);
  const [showErrors, setShowErrors] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const project = useProject(header.projectId, Boolean(header.projectId));
  const warehouse = useWarehouse(header.warehouseId);

  const lineErrors = Object.fromEntries(lines.map((line) => [line.key, validateItemQtyLine(line)]));
  const headerValid = Boolean(header.projectId && header.warehouseId);
  const valid = headerValid && Object.values(lineErrors).every((errors) => Object.keys(errors).length === 0);
  const patch = (change: Partial<Header>): void => setHeader((current) => ({ ...current, ...change }));

  function save(): void {
    if (create.isPending) return;
    setShowErrors(true);
    setServerError(null);
    if (!valid) return;
    const body: MaterialRequestInput = {
      projectId: header.projectId,
      warehouseId: header.warehouseId,
      ...(header.costCodeId ? { costCodeId: header.costCodeId } : {}),
      ...(header.neededDate ? { neededDate: header.neededDate } : {}),
      ...(header.purpose.trim() ? { purpose: header.purpose.trim() } : {}),
      ...(header.remarks.trim() ? { remarks: header.remarks.trim() } : {}),
      lines: lines.map((line) => ({
        itemId: line.itemId,
        qty: line.qty,
        ...(line.note.trim() ? { purpose: line.note.trim() } : {}),
      })),
    };
    create.mutate(body, {
      onSuccess: (request) => {
        toast.success('Material request created', `${request.number} is a draft.`);
        router.push(`/inventory/material-requests/${request.id}`);
      },
      onError: (error) => setServerError(saveErrorMessage(error)),
    });
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="space-y-4"
    >
      {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
      {showErrors && !valid ? <Alert tone="warning">Fix the highlighted fields before saving.</Alert> : null}
      <Panel title="Request">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Project" required error={showErrors && !header.projectId ? 'Choose a project' : undefined}>
            {(field) => (
              <EntityCombobox
                entity="projects"
                id={field.id}
                search={searchProjectOptions}
                value={header.projectId || null}
                {...(project.data ? { selectedLabel: `${project.data.code} · ${project.data.name}` } : {})}
                onChange={(value) => patch({ projectId: value ?? '' })}
                clearable={false}
                placeholder="Search projects"
                aria-invalid={field['aria-invalid']}
                aria-describedby={field['aria-describedby']}
              />
            )}
          </FormField>
          <FormField label="Issue from warehouse" required error={showErrors && !header.warehouseId ? 'Choose a warehouse' : undefined}>
            {(field) => (
              <EntityCombobox
                entity="warehouses"
                id={field.id}
                search={searchWarehouseOptions}
                value={header.warehouseId || null}
                {...(warehouse.data ? { selectedLabel: warehouse.data.name } : {})}
                onChange={(value) => patch({ warehouseId: value ?? '' })}
                clearable={false}
                placeholder="Search warehouses"
                aria-invalid={field['aria-invalid']}
                aria-describedby={field['aria-describedby']}
              />
            )}
          </FormField>
          <TextField label="Needed by" type="date" value={header.neededDate} onChange={(event) => patch({ neededDate: event.target.value })} />
          <FormField label="Default cost code" hint="Lines use this unless they carry their own.">
            {(field) => (
              <EntityCombobox
                entity="cost-codes"
                id={field.id}
                search={searchCostCodeOptions}
                value={header.costCodeId || null}
                selectedLabel={header.costCodeLabel}
                onChange={(value, option) => patch({ costCodeId: value ?? '', costCodeLabel: option?.label ?? '' })}
                placeholder="Optional"
                aria-describedby={field['aria-describedby']}
              />
            )}
          </FormField>
          <TextField label="Purpose" className="lg:col-span-2" maxLength={300} value={header.purpose} onChange={(event) => patch({ purpose: event.target.value })} />
          <TextAreaField label="Remarks" wide className="lg:col-span-3" maxLength={1000} value={header.remarks} onChange={(event) => patch({ remarks: event.target.value })} />
        </div>
      </Panel>
      <Panel title="Lines" description="Quantities are in each item's base unit." bodyClassName="p-0">
        <ItemQtyLines lines={lines} errors={showErrors ? lineErrors : {}} noteLabel="Purpose" onChange={setLines} />
      </Panel>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" loading={create.isPending}>
          Save draft
        </Button>
        <Button asChild variant="ghost" disabled={create.isPending}>
          <Link href="/inventory/material-requests">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
