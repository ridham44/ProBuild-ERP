'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { EntityCombobox } from '@/components/common/entity-combobox';
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
import { searchProjectOptions, useProject } from '@/features/projects/api/hooks';
import { searchWarehouseOptions, useWarehouse } from '@/features/warehouses/api/hooks';
import { saveErrorMessage } from '@/lib/api/errors';
import { manilaToday } from '@/lib/format';
import { useCreateMaterialIssue, type MaterialIssueInput } from '../api/hooks';
import { blankDelivery, deliveryPayload, IssueDeliveryFields, type IssueDelivery } from './issue-delivery-fields';

/** Issue with no request behind it. The API needs the override permission and a written reason. */
export function DirectIssueForm() {
  const router = useRouter();
  const { projectId: contextProject } = useWorkContext();
  const create = useCreateMaterialIssue();
  const [projectId, setProjectId] = React.useState(contextProject ?? '');
  const [warehouseId, setWarehouseId] = React.useState('');
  const [lines, setLines] = React.useState<ItemQtyLine[]>(() => [blankItemQtyLine()]);
  const [delivery, setDelivery] = React.useState<IssueDelivery>(() => blankDelivery(manilaToday()));
  const [showErrors, setShowErrors] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const project = useProject(projectId, Boolean(projectId));
  const warehouse = useWarehouse(warehouseId);

  const lineErrors = Object.fromEntries(lines.map((line) => [line.key, validateItemQtyLine(line)]));
  const reasonMissing = delivery.remarks.trim().length < 3;
  const valid =
    Boolean(projectId && warehouseId) && !reasonMissing && Object.values(lineErrors).every((errors) => Object.keys(errors).length === 0);

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (create.isPending) return;
    setShowErrors(true);
    setServerError(null);
    if (!valid) return;
    const body: MaterialIssueInput = {
      projectId,
      warehouseId,
      ...deliveryPayload(delivery),
      lines: lines.map((line) => ({ itemId: line.itemId, qty: line.qty })),
    };
    create.mutate(body, {
      onSuccess: (issue) => {
        toast.success('Material issue created', `${issue.number} is a draft. Review it, then post it.`);
        router.push(`/inventory/material-issues/${issue.id}`);
      },
      onError: (error) => setServerError(saveErrorMessage(error)),
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Alert tone="info" title="Direct issue">
        Use this only when there is no approved request. It needs the override permission and a reason, which is kept on the audit trail.
      </Alert>
      {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
      {showErrors && !valid ? <Alert tone="warning">Fix the highlighted fields before saving.</Alert> : null}
      <Panel title="Issue to">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Project" required error={showErrors && !projectId ? 'Choose a project' : undefined}>
            {(field) => (
              <EntityCombobox
                entity="projects"
                id={field.id}
                search={searchProjectOptions}
                value={projectId || null}
                {...(project.data ? { selectedLabel: `${project.data.code} · ${project.data.name}` } : {})}
                onChange={(value) => setProjectId(value ?? '')}
                clearable={false}
                placeholder="Search projects"
                aria-invalid={field['aria-invalid']}
                aria-describedby={field['aria-describedby']}
              />
            )}
          </FormField>
          <FormField label="Issue from warehouse" required error={showErrors && !warehouseId ? 'Choose a warehouse' : undefined}>
            {(field) => (
              <EntityCombobox
                entity="warehouses"
                id={field.id}
                search={searchWarehouseOptions}
                value={warehouseId || null}
                {...(warehouse.data ? { selectedLabel: warehouse.data.name } : {})}
                onChange={(value) => setWarehouseId(value ?? '')}
                clearable={false}
                placeholder="Search warehouses"
                aria-invalid={field['aria-invalid']}
                aria-describedby={field['aria-describedby']}
              />
            )}
          </FormField>
        </div>
      </Panel>
      <Panel title="Lines" description="Quantities are in each item's base unit. Batches and serials are picked automatically." bodyClassName="p-0">
        <ItemQtyLines lines={lines} errors={showErrors ? lineErrors : {}} noteLabel="Note" onChange={setLines} />
      </Panel>
      <IssueDeliveryFields
        value={delivery}
        onChange={(change) => setDelivery((current) => ({ ...current, ...change }))}
        remarksLabel="Reason for the direct issue"
        remarksRequired
        remarksError={showErrors && reasonMissing ? 'Give a reason (at least 3 characters)' : undefined}
      />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" loading={create.isPending}>
          Create draft issue
        </Button>
        <Button asChild variant="ghost" disabled={create.isPending}>
          <Link href="/inventory/material-issues">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
