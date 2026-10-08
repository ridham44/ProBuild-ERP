'use client';

import { newIdempotencyKey } from '@probuild/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { PRIORITIES } from '@probuild/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { EntityCombobox } from '@/components/common/entity-combobox';
import { FormField } from '@/components/common/form-field';
import { PageHeader } from '@/components/common/page-header';
import { DetailList, Panel } from '@/components/common/panel';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useCan, useCurrentUser } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { useWorkflows } from '@/features/approvals/api/hooks';
import { useWorkContext } from '@/features/context/work-context';
import { searchProjectOptions, useBoq, useCostCodes, useProject, useWbs } from '@/features/projects/api/hooks';
import { searchWarehouseOptions, useWarehouse } from '@/features/warehouses/api/hooks';
import { isApiError, errorMessage } from '@/lib/api/errors';
import type { RequisitionDetail } from '@/lib/api/types';
import { formatPHP, manilaToday, titleCase } from '@/lib/format';
import {
  useCreateRequisition,
  requisitionKeys,
  submitRequisitionCall,
  useUpdateRequisition,
} from '../api/hooks';
import {
  blankLine,
  buildRequisitionPayload,
  estimatedTotal,
  headerFromDetail,
  linesFromDetail,
  mapServerErrors,
  previewApprovalRoute,
  validateRequisition,
  type HeaderDraft,
  type HeaderErrors,
  type LineDraft,
  type LineErrors,
} from '../model';
import { LineTable } from './line-table';

type Props = {
  /** The draft being edited, or null to start a new requisition. */
  draft: RequisitionDetail | null;
  /** An existing requisition whose content seeds a new one (copy of a rejected request). */
  seed?: RequisitionDetail | null;
};

function ApprovalRoute({ amount }: { amount: string }) {
  const canSeeWorkflows = useCan('security.workflow', 'VIEW');
  const workflows = useWorkflows(canSeeWorkflows);
  const preview = previewApprovalRoute(canSeeWorkflows ? workflows.data : undefined, amount);
  if (preview.kind === 'unknown') {
    return (
      <p className="text-sm text-muted-foreground">
        The approval route is set when the requisition is submitted and is shown on its Approvals tab.
      </p>
    );
  }
  if (preview.kind === 'automatic') {
    return (
      <p className="text-sm text-muted-foreground">
        No approval step applies to this amount. Submitting approves the requisition immediately.
      </p>
    );
  }
  return (
    <ol className="space-y-1 text-sm">
      {preview.roles.map((role, index) => (
        <li key={`${role}-${index}`} className="flex items-center gap-2">
          <span className="num flex size-5 items-center justify-center rounded-full border border-border bg-surface-muted text-2xs">{index + 1}</span>
          {role}
        </li>
      ))}
    </ol>
  );
}

export function RequisitionEditor({ draft, seed = null }: Props) {
  const router = useRouter();
  const me = useCurrentUser();
  const { projectId: contextProject } = useWorkContext();
  const source = draft ?? seed;
  const canSubmit = useCan('procurement.requisition', 'SUBMIT');
  const canPickWarehouse = useCan('organization.warehouse', 'VIEW');
  const create = useCreateRequisition();
  const update = useUpdateRequisition(draft?.id ?? '');
  const queryClient = useQueryClient();

  const [header, setHeader] = React.useState<HeaderDraft>(() =>
    source
      ? headerFromDetail(source)
      : { projectId: contextProject ?? '', warehouseId: '', priority: 'NORMAL', requiredDate: '', purpose: '', remarks: '' },
  );
  const [lines, setLines] = React.useState<LineDraft[]>(() =>
    source ? linesFromDetail(source) : [blankLine()],
  );
  const [showErrors, setShowErrors] = React.useState(false);
  const [serverHeader, setServerHeader] = React.useState<HeaderErrors>({});
  const [serverLines, setServerLines] = React.useState<Record<string, LineErrors>>({});
  const [general, setGeneral] = React.useState<string[]>([]);
  const [dirty, setDirty] = React.useState(false);
  const submitKey = React.useRef<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const project = useProject(header.projectId, Boolean(header.projectId));
  const warehouse = useWarehouse(header.warehouseId);
  const wbs = useWbs(header.projectId, Boolean(header.projectId));
  const boq = useBoq(header.projectId, { limit: 100 }, Boolean(header.projectId));
  const costCodes = useCostCodes({ limit: 100, active: 'true' });

  React.useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent): void => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const validation = React.useMemo(() => validateRequisition(header, lines), [header, lines]);
  const total = estimatedTotal(lines);
  const pending = create.isPending || update.isPending || submitting;
  const lineErrors = showErrors ? mergeLineErrors(validation.lines, serverLines) : serverLines;
  const headerErrors: HeaderErrors = showErrors ? { ...validation.header, ...serverHeader } : serverHeader;
  const issueCount = Object.keys(validation.header).length + Object.keys(validation.lines).length;

  function patchHeader(patch: Partial<HeaderDraft>): void {
    setHeader((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  function changeLines(next: LineDraft[]): void {
    setLines(next);
    setDirty(true);
    setServerLines({});
  }

  async function save(andSubmit: boolean): Promise<void> {
    if (pending) return;
    setShowErrors(true);
    setServerHeader({});
    setServerLines({});
    setGeneral([]);
    if (!validation.valid) {
      toast.error('Fix the highlighted fields', `${issueCount} ${issueCount === 1 ? 'problem' : 'problems'} to resolve before saving.`);
      return;
    }
    const payload = buildRequisitionPayload(header, lines);
    let saved: RequisitionDetail;
    try {
      if (draft) {
        const { projectId: _ignored, ...body } = payload;
        void _ignored;
        saved = await update.mutateAsync(body);
      } else {
        saved = await create.mutateAsync(payload);
      }
    } catch (error) {
      if (isApiError(error) && error.problem.errors?.length) {
        const mapped = mapServerErrors(error.problem.errors, lines);
        setServerHeader(mapped.header);
        setServerLines(mapped.lines);
        setGeneral(mapped.general);
      } else {
        setGeneral([errorMessage(error)]);
      }
      return;
    }
    setDirty(false);
    void queryClient.invalidateQueries({ queryKey: requisitionKeys.all });
    if (!andSubmit) {
      toast.success(draft ? 'Draft saved' : 'Draft created', saved.number);
      router.push(`/procurement/requests/${saved.id}`);
      return;
    }
    submitKey.current ??= newIdempotencyKey();
    setSubmitting(true);
    try {
      await submitRequisitionCall(saved.id, submitKey.current);
      toast.success('Submitted for approval', saved.number);
    } catch (error) {
      toast.error(`${saved.number} saved as a draft, but could not be submitted`, errorMessage(error));
    } finally {
      setSubmitting(false);
      submitKey.current = null;
      void queryClient.invalidateQueries({ queryKey: requisitionKeys.all });
    }
    router.push(`/procurement/requests/${saved.id}`);
  }

  const title = draft ? `Edit ${draft.number}` : seed ? 'New requisition (copy)' : 'New purchase requisition';
  return (
    <PermissionGate module="procurement.requisition" action={draft ? 'EDIT' : 'CREATE'}>
      <PageHeader
        title={title}
        breadcrumbs={[
          { label: 'Procurement' },
          { label: 'Requests', href: '/procurement/requests' },
          ...(draft ? [{ label: draft.number, href: `/procurement/requests/${draft.id}` }, { label: 'Edit' }] : [{ label: 'New' }]),
        ]}
        description={
          seed
            ? `Copied from ${seed.number}. Review the lines, then save or submit.`
            : 'List what you need, then submit it for approval. Drafts can be changed until they are submitted.'
        }
      />
      <div className="space-y-4">
          {general.length > 0 ? (
            <Alert tone="danger" title="The server could not save this requisition">
              <ul className="list-disc pl-4">
                {general.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
          {showErrors && issueCount > 0 ? (
            <Alert tone="warning">
              {issueCount} {issueCount === 1 ? 'problem needs' : 'problems need'} attention. Fields are marked below.
            </Alert>
          ) : null}
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <Panel title="Request">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Project" required error={headerErrors.projectId}>
                {(field) => (
                  <EntityCombobox
                    entity="projects"
                    id={field.id}
                    search={searchProjectOptions}
                    value={header.projectId || null}
                    {...(project.data ? { selectedLabel: `${project.data.code} · ${project.data.name}` } : {})}
                    onChange={(value) => patchHeader({ projectId: value ?? '' })}
                    disabled={Boolean(draft)}
                    clearable={!draft}
                    placeholder="Search projects"
                    aria-invalid={field['aria-invalid']}
                    aria-describedby={field['aria-describedby']}
                  />
                )}
              </FormField>
              {canPickWarehouse || header.warehouseId ? (
                <FormField label="Deliver to warehouse">
                  {(field) => (
                    <EntityCombobox
                      entity="warehouses"
                      id={field.id}
                      search={searchWarehouseOptions}
                      value={header.warehouseId || null}
                      {...(warehouse.data ? { selectedLabel: warehouse.data.name } : {})}
                      onChange={(value) => patchHeader({ warehouseId: value ?? '' })}
                      placeholder="Any warehouse"
                    />
                  )}
                </FormField>
              ) : null}
              <FormField label="Needed by" error={headerErrors.requiredDate}>
                {(field) => (
                  <Input
                    {...field}
                    type="date"
                    min={manilaToday()}
                    value={header.requiredDate}
                    onChange={(event) => patchHeader({ requiredDate: event.target.value })}
                  />
                )}
              </FormField>
              <FormField label="Priority">
                {(field) => (
                  <Select {...field} value={header.priority} onChange={(event) => patchHeader({ priority: event.target.value as HeaderDraft['priority'] })}>
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {titleCase(priority)}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField label="Purpose" error={headerErrors.purpose} className="sm:col-span-2">
                {(field) => (
                  <Input
                    {...field}
                    maxLength={300}
                    value={header.purpose}
                    placeholder="e.g. Rebar for 4th floor columns"
                    onChange={(event) => patchHeader({ purpose: event.target.value })}
                  />
                )}
              </FormField>
              <FormField label="Remarks" error={headerErrors.remarks} wide className="lg:col-span-3">
                {(field) => (
                  <Textarea {...field} rows={2} maxLength={1000} value={header.remarks} onChange={(event) => patchHeader({ remarks: event.target.value })} />
                )}
              </FormField>
            </div>
          </Panel>
          <aside className="space-y-4" aria-label="Summary">
          <Panel title="Summary">
            <DetailList
              columns={2}
              className="sm:grid-cols-2 lg:grid-cols-2"
              items={[
                { label: 'Status', value: 'Draft' },
                { label: 'Requester', value: me.name },
                { label: 'Lines', value: lines.length, numeric: true },
                { label: 'Estimated amount', value: formatPHP(total), numeric: true },
              ]}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Estimates use the cost you type, otherwise the item&apos;s last purchase or standard cost. The approval route follows this amount.
            </p>
          </Panel>
          <Panel title="Approval route">
            <ApprovalRoute amount={total} />
          </Panel>
          </aside>
        </div>
          <section aria-label="Lines" className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold">Lines</h2>
              {showErrors && headerErrors.lines ? <p className="text-xs font-medium text-danger">{headerErrors.lines}</p> : null}
            </div>
            <LineTable
              lines={lines}
              errors={lineErrors}
              showErrors
              dimensions={{ wbs: wbs.data ?? [], costCodes: costCodes.data?.items ?? [], boq: boq.data?.items ?? [] }}
              onChange={changeLines}
              disabled={pending}
            />
          </section>
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
          <p className="text-sm">
            <span className="text-muted-foreground">Estimated amount </span>
            <span className="num text-base font-semibold">{formatPHP(total)}</span>
            <span className="text-muted-foreground"> · {lines.length} {lines.length === 1 ? 'line' : 'lines'}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" disabled={pending}>
              <Link href={draft ? `/procurement/requests/${draft.id}` : '/procurement/requests'}>Cancel</Link>
            </Button>
            <Button onClick={() => void save(false)} disabled={pending} variant={canSubmit ? 'secondary' : 'primary'}>
              Save draft
            </Button>
            {canSubmit ? (
              <Button variant="primary" onClick={() => void save(true)} loading={pending}>
                Save and submit for approval
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </PermissionGate>
  );
}

function mergeLineErrors(
  local: Record<string, LineErrors>,
  server: Record<string, LineErrors>,
): Record<string, LineErrors> {
  const keys = new Set([...Object.keys(local), ...Object.keys(server)]);
  const out: Record<string, LineErrors> = {};
  for (const key of keys) out[key] = { ...local[key], ...server[key] };
  return out;
}
