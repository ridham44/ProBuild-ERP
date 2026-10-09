'use client';

import { createLocationSchema } from '@probuild/shared';
import { Boxes, MapPin, Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { ActivityPanel } from '@/components/common/activity-panel';
import type { DataColumn } from '@/components/common/data-table/column-meta';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { SelectField, TextField } from '@/components/common/form-controls';
import { DetailPageSkeleton } from '@/components/common/page-skeleton';
import { PageHeader } from '@/components/common/page-header';
import { DetailList, Panel } from '@/components/common/panel';
import { useCursorPagination } from '@/components/common/pagination';
import { StatusBadge } from '@/components/common/status-badge';
import { UrlTabs } from '@/components/common/url-tabs';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useCan } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import type { WarehouseDetail, WarehouseLocation, WarehouseStockRow } from '@/lib/api/types';
import { applyServerErrors, formResolver } from '@/lib/forms';
import { formatDateTime, formatPHP, formatQty, titleCase } from '@/lib/format';
import {
  useCreateLocation,
  useLocations,
  useWarehouse,
  useWarehouseActivity,
  useWarehouseStock,
  useWarehouseSummary,
} from '../api/hooks';
import { WarehouseDrawer } from './warehouse-form';

const LEVELS = ['ZONE', 'RACK', 'SHELF', 'BIN'] as const;
type Level = (typeof LEVELS)[number];

function Overview({ warehouse }: { warehouse: WarehouseDetail }) {
  const summary = useWarehouseSummary(warehouse.id);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Details">
        <DetailList
          columns={2}
          items={[
            { label: 'Code', value: <span className="font-mono">{warehouse.code}</span> },
            { label: 'Type', value: titleCase(warehouse.type) },
            {
              label: 'Project',
              value: warehouse.project ? (
                <Link href={`/projects/${warehouse.project.id}`} className="text-primary hover:underline">
                  {warehouse.project.name}
                </Link>
              ) : null,
            },
            { label: 'Branch', value: warehouse.branch?.name },
            { label: 'Parent warehouse', value: warehouse.parentWarehouse?.name },
            { label: 'Address', value: warehouse.address, wide: true },
          ]}
        />
      </Panel>
      <Panel title="Stock held" description="Live totals from stock balances.">
        {summary.isPending ? (
          <Skeleton className="h-24" />
        ) : summary.isError ? (
          <QueryErrorState error={summary.error} onRetry={() => void summary.refetch()} compact />
        ) : (
          <div className="space-y-3">
            <DetailList
              columns={2}
              items={[
                { label: 'Distinct items', value: summary.data.stock.distinctItems, numeric: true },
                { label: 'Storage locations', value: summary.data.locations.total, numeric: true },
              ]}
            />
            {summary.data.stock.byStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stock in this warehouse yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold text-muted-foreground">
                    <th className="py-1.5 text-left font-medium">Stock status</th>
                    <th className="py-1.5 text-right font-medium">Quantity</th>
                    <th className="py-1.5 text-right font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.data.stock.byStatus.map((row) => (
                    <tr key={row.stockStatus} className="border-b border-border last:border-0">
                      <td className="py-1.5">{titleCase(row.stockStatus)}</td>
                      <td className="num py-1.5 text-right">{formatQty(row.qtyOnHand)}</td>
                      <td className="num py-1.5 text-right">{formatPHP(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

type LocationValues = { level: Level; parentId?: string; code: string };

function LocationDialog({
  open,
  onOpenChange,
  warehouseId,
  locations,
  presetParent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  locations: WarehouseLocation[];
  presetParent: WarehouseLocation | null;
}) {
  const create = useCreateLocation(warehouseId);
  const [formError, setFormError] = React.useState<string | null>(null);
  const nextLevel = (parent: WarehouseLocation | null): Level => {
    if (!parent) return 'ZONE';
    const index = LEVELS.indexOf(parent.level as Level);
    return LEVELS[Math.min(index + 1, LEVELS.length - 1)] ?? 'BIN';
  };
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<LocationValues>({
    resolver: formResolver<LocationValues>({
      safeParse: (value) => createLocationSchema.safeParse({ ...(value as object), warehouseId }),
    }),
    defaultValues: { level: 'ZONE', parentId: '', code: '' },
  });
  React.useEffect(() => {
    if (open) {
      reset({ level: nextLevel(presetParent), parentId: presetParent?.id ?? '', code: '' });
      setFormError(null);
    }
  }, [open, presetParent, reset]);

  function submit(values: LocationValues): void {
    setFormError(null);
    create.mutate(
      { ...values, warehouseId },
      {
        onSuccess: (saved) => {
          toast.success('Location added', saved.fullPath);
          onOpenChange(false);
        },
        onError: (error) => setFormError(applyServerErrors(error, setError, ['level', 'parentId', 'code'] as const)),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (create.isPending ? undefined : onOpenChange(next))}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Add storage location</DialogTitle>
          <DialogDescription>Zones contain racks, racks contain shelves, shelves contain bins.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-3">
            {formError ? <Alert tone="danger">{formError}</Alert> : null}
            <SelectField label="Level" required error={errors.level?.message} {...register('level')}>
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {titleCase(level)}
                </option>
              ))}
            </SelectField>
            <SelectField label="Inside" error={errors.parentId?.message} {...register('parentId')}>
              <option value="">Warehouse (top level)</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.fullPath}
                </option>
              ))}
            </SelectField>
            <TextField label="Code" required autoFocus inputClassName="font-mono" hint="Short, e.g. A, R03, S02, B15." error={errors.code?.message} {...register('code')} />
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={create.isPending}>
              Add location
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type TreeNode = { location: WarehouseLocation; depth: number };

export function flattenLocationTree(locations: WarehouseLocation[]): TreeNode[] {
  const byParent = new Map<string | null, WarehouseLocation[]>();
  for (const location of locations) {
    const key = location.parentId;
    byParent.set(key, [...(byParent.get(key) ?? []), location]);
  }
  const known = new Set(locations.map((location) => location.id));
  const out: TreeNode[] = [];
  const walk = (parentId: string | null, depth: number): void => {
    for (const child of byParent.get(parentId) ?? []) {
      out.push({ location: child, depth });
      walk(child.id, depth + 1);
    }
  };
  walk(null, 0);
  // Locations whose parent is missing from the list are shown at the top level rather than hidden.
  for (const location of locations) {
    if (location.parentId && !known.has(location.parentId) && !out.some((node) => node.location.id === location.id)) {
      out.push({ location, depth: 0 });
      walk(location.id, 1);
    }
  }
  return out;
}

function LocationsTab({ warehouseId, canEdit }: { warehouseId: string; canEdit: boolean }) {
  const locations = useLocations(warehouseId);
  const [open, setOpen] = React.useState(false);
  const [parent, setParent] = React.useState<WarehouseLocation | null>(null);
  const items = React.useMemo(() => locations.data ?? [], [locations.data]);
  const tree = React.useMemo(() => flattenLocationTree(items), [items]);

  function openDialog(next: WarehouseLocation | null): void {
    setParent(next);
    setOpen(true);
  }

  return (
    <Panel
      title="Storage locations"
      description="Zone, rack, shelf and bin hierarchy used for putaway and picking."
      bodyClassName="p-0"
      actions={
        canEdit ? (
          <Button size="sm" onClick={() => openDialog(null)}>
            <Plus className="size-3.5" aria-hidden />
            Add location
          </Button>
        ) : null
      }
    >
      {locations.isPending ? (
        <div className="p-4">
          <Skeleton className="h-24" />
        </div>
      ) : locations.isError ? (
        <QueryErrorState error={locations.error} onRetry={() => void locations.refetch()} compact />
      ) : tree.length === 0 ? (
        <EmptyState
          compact
          icon={MapPin}
          title="No storage locations"
          description="Without locations, stock is held at warehouse level. Add zones and bins to know exactly where materials are."
          action={
            canEdit ? (
              <Button variant="primary" onClick={() => openDialog(null)}>
                <Plus className="size-3.5" aria-hidden />
                Add location
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {tree.map(({ location, depth }) => (
            <li
              key={location.id}
              className="flex items-center gap-2 py-1.5 pr-4 text-sm"
              style={{ paddingLeft: `${1 + depth * 1.5}rem` }}
            >
              <Badge>{titleCase(location.level)}</Badge>
              <span className="font-mono text-xs font-medium">{location.code}</span>
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">{location.fullPath}</span>
              {!location.active ? <StatusBadge status="INACTIVE" /> : null}
              {canEdit && location.level !== 'BIN' ? (
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => openDialog(location)}>
                  <Plus className="size-3" aria-hidden />
                  Add inside
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <LocationDialog open={open} onOpenChange={setOpen} warehouseId={warehouseId} locations={items} presetParent={parent} />
    </Panel>
  );
}

function StockTab({ warehouseId }: { warehouseId: string }) {
  const paging = useCursorPagination();
  const stock = useWarehouseStock(warehouseId, {
    limit: 25,
    ...(paging.cursor ? { cursor: paging.cursor } : {}),
  });
  const page = stock.data;
  const columns = React.useMemo<DataColumn<WarehouseStockRow>[]>(
    () => [
      {
        id: 'item',
        header: 'Item',
        accessorFn: (row) => row.item.name,
        enableSorting: true,
        meta: { sticky: true },
        cell: ({ row }) => (
          <Link href={`/inventory/items/${row.original.item.id}`} className="hover:underline">
            <span className="font-mono text-xs text-muted-foreground">{row.original.item.sku}</span>{' '}
            <span className="font-medium">{row.original.item.name}</span>
          </Link>
        ),
      },
      { id: 'batch', header: 'Batch', cell: ({ row }) => (row.original.batchNo ? row.original.batchNo : '—'), meta: { hideBelow: 'md' } },
      { id: 'status', header: 'Stock status', cell: ({ row }) => titleCase(row.original.stockStatus) },
      {
        id: 'qty',
        header: 'On hand',
        accessorFn: (row) => Number(row.qtyOnHand),
        enableSorting: true,
        cell: ({ row }) => formatQty(row.original.qtyOnHand, row.original.item.baseUnit),
        meta: { numeric: true },
      },
      { id: 'avg', header: 'Avg cost', cell: ({ row }) => formatPHP(row.original.avgCost), meta: { numeric: true, hideBelow: 'md' } },
      {
        id: 'value',
        header: 'Value',
        accessorFn: (row) => Number(row.value),
        enableSorting: true,
        cell: ({ row }) => formatPHP(row.original.value),
        meta: { numeric: true },
      },
      { id: 'updated', header: 'Updated', cell: ({ row }) => formatDateTime(row.original.updatedAt), meta: { hideBelow: 'lg' } },
    ],
    [],
  );
  return (
    <DataTable
      caption="Stock in warehouse"
      columns={columns}
      data={page?.items ?? []}
      getRowId={(row) => row.id}
      loading={stock.isPending}
      error={stock.error}
      onRetry={() => void stock.refetch()}
      getSearchText={(row) => `${row.item.sku} ${row.item.name}`}
      searchPlaceholder="Filter this page by item"
      maxHeightClassName="max-h-[60vh]"
      pagination={{
        count: page?.items.length ?? 0,
        hasPrevious: paging.hasPrevious,
        hasNext: Boolean(page?.nextCursor),
        onPrevious: paging.goPrevious,
        onNext: () => paging.goNext(page?.nextCursor ?? null),
        loading: stock.isFetching,
      }}
      emptyState={
        <EmptyState
          compact
          icon={Boxes}
          title="No stock here yet"
          description="Stock appears after goods are received into this warehouse."
        />
      }
    />
  );
}

export function WarehouseDetailView({ id }: { id: string }) {
  const warehouse = useWarehouse(id);
  const canEdit = useCan('organization.warehouse', 'EDIT');
  const canSeeStock = useCan('inventory.stock', 'VIEW');
  const activity = useWarehouseActivity(id);
  const [editOpen, setEditOpen] = React.useState(false);
  const data = warehouse.data;
  return (
    <PermissionGate module="organization.warehouse">
      {warehouse.isPending ? (
        <DetailPageSkeleton label="Loading warehouse" />
      ) : warehouse.isError || !data ? (
        <QueryErrorState error={warehouse.error} onRetry={() => void warehouse.refetch()} />
      ) : (
        <>
          <PageHeader
            title={data.name}
            breadcrumbs={[{ label: 'Inventory' }, { label: 'Warehouses', href: '/inventory/warehouses' }, { label: data.code }]}
            meta={
              <>
                <span className="font-mono text-xs text-muted-foreground">{data.code}</span>
                <StatusBadge status={data.active ? 'ACTIVE' : 'INACTIVE'} />
              </>
            }
            actions={
              canEdit ? (
                <Button variant="primary" onClick={() => setEditOpen(true)}>
                  <Pencil className="size-3.5" aria-hidden />
                  Edit
                </Button>
              ) : null
            }
          />
          <UrlTabs
            label="Warehouse sections"
            tabs={[
              { id: 'overview', label: 'Overview', content: <Overview warehouse={data} /> },
              { id: 'locations', label: 'Locations', content: <LocationsTab warehouseId={id} canEdit={canEdit} /> },
              ...(canSeeStock ? [{ id: 'stock', label: 'Stock', content: <StockTab warehouseId={id} /> }] : []),
              {
                id: 'activity',
                label: 'Activity',
                content: (
                  <Panel>
                    <ActivityPanel
                      items={activity.data}
                      loading={activity.isPending}
                      error={activity.error}
                      onRetry={() => void activity.refetch()}
                    />
                  </Panel>
                ),
              },
            ]}
          />
          <WarehouseDrawer open={editOpen} onOpenChange={setEditOpen} warehouse={data} />
        </>
      )}
    </PermissionGate>
  );
}
