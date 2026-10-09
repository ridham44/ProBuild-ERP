'use client';

import { Boxes, Coins, Lock, PackageCheck, Pencil, Tag, Truck, Warehouse } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { ActivityPanel } from '@/components/common/activity-panel';
import type { DataColumn } from '@/components/common/data-table/column-meta';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { DetailPageSkeleton } from '@/components/common/page-skeleton';
import { PageHeader } from '@/components/common/page-header';
import { Stat } from '@/components/common/stat';
import { DetailList, Panel } from '@/components/common/panel';
import { StatusBadge } from '@/components/common/status-badge';
import { UrlTabs } from '@/components/common/url-tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import type { ItemDetail, ItemStockSummary, PriceHistoryRow } from '@/lib/api/types';
import { formatDate, formatPHP, formatQty, titleCase } from '@/lib/format';
import { useItem, useItemActivity, useItemStock, usePriceHistory } from '../api/hooks';
import { costingLabel, trackingLabels } from '../model';

function Overview({ item }: { item: ItemDetail }) {
  const tracking = trackingLabels(item);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Identification">
        <DetailList
          columns={2}
          items={[
            { label: 'SKU', value: <span className="font-mono">{item.sku}</span> },
            { label: 'Category', value: item.category?.name },
            { label: 'Type', value: titleCase(item.itemType) },
            { label: 'Cost category', value: titleCase(item.costCategory) },
            { label: 'Brand', value: item.brand },
            { label: 'Model', value: item.model },
            { label: 'Barcode', value: item.barcode ? <span className="font-mono">{item.barcode}</span> : null },
            {
              label: 'Preferred supplier',
              value: item.preferredSupplier ? (
                <Link href={`/procurement/suppliers/${item.preferredSupplier.id}`} className="text-primary hover:underline">
                  {item.preferredSupplier.name}
                </Link>
              ) : null,
            },
            { label: 'Specification', value: item.specification, wide: true },
            { label: 'Description', value: item.description, wide: true },
          ]}
        />
      </Panel>
      <div className="space-y-4">
        <Panel title="Units and tracking">
          <DetailList
            columns={2}
            items={[
              { label: 'Base unit', value: <span className="font-mono">{item.baseUnit}</span> },
              { label: 'Purchase unit', value: item.purchaseUnit ? <span className="font-mono">{item.purchaseUnit}</span> : null },
              { label: 'Issue unit', value: item.issueUnit ? <span className="font-mono">{item.issueUnit}</span> : null },
              { label: 'Default conversion', value: formatQty(item.conversionFactor), numeric: true },
              {
                label: 'Tracking',
                value:
                  tracking.length === 0 ? (
                    'None'
                  ) : (
                    <span className="flex gap-1">
                      {tracking.map((label) => (
                        <Badge key={label} tone="info">
                          {label}
                        </Badge>
                      ))}
                    </span>
                  ),
              },
            ]}
          />
          {item.unitConversions.length > 0 ? (
            <ul className="mt-3 divide-y divide-border border-t border-border text-sm">
              {item.unitConversions.map((conversion) => (
                <li key={conversion.id} className="num py-1.5">
                  1 <span className="font-mono">{conversion.unit}</span> = {formatQty(conversion.factor)}{' '}
                  <span className="font-mono">{item.baseUnit}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
        <Panel title="Stock policy and valuation">
          <DetailList
            columns={2}
            items={[
              { label: 'Minimum', value: formatQty(item.minStock, item.baseUnit), numeric: true },
              { label: 'Maximum', value: Number(item.maxStock) > 0 ? formatQty(item.maxStock, item.baseUnit) : null, numeric: true },
              { label: 'Reorder point', value: formatQty(item.reorderPoint, item.baseUnit), numeric: true },
              { label: 'Safety stock', value: formatQty(item.safetyStock, item.baseUnit), numeric: true },
              { label: 'Valuation method', value: costingLabel(item.costingMethod) },
              {
                label: 'Standard cost',
                value: item.costingMethod === 'STANDARD' ? formatPHP(item.standardCost) : null,
                numeric: true,
              },
              {
                label: 'Last purchase cost',
                value: Number(item.lastPurchaseCost) > 0 ? formatPHP(item.lastPurchaseCost) : null,
                numeric: true,
              },
              { label: 'Allowable waste', value: `${formatQty(item.allowableWastePct)}%`, numeric: true },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}

type StockRow = ItemStockSummary['warehouses'][number];

function QtyFigure({ value, unit }: { value: string | undefined; unit: string }) {
  return (
    <>
      {formatQty(value)} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
    </>
  );
}

function StockTab({ itemId, unit }: { itemId: string; unit: string }) {
  const stock = useItemStock(itemId);
  const columns = React.useMemo<DataColumn<StockRow>[]>(
    () => [
      {
        id: 'warehouse',
        header: 'Warehouse',
        accessorFn: (row) => row.warehouseName,
        enableSorting: true,
        meta: { sticky: true },
        cell: ({ row }) => (
          <Link href={`/inventory/warehouses/${row.original.warehouseId}`} className="hover:underline">
            <span className="font-mono text-xs text-muted-foreground">{row.original.warehouseCode}</span>{' '}
            <span className="font-medium">{row.original.warehouseName}</span>
          </Link>
        ),
      },
      { id: 'onHand', header: 'On hand', accessorFn: (r) => Number(r.onHand), enableSorting: true, cell: ({ row }) => formatQty(row.original.onHand), meta: { numeric: true } },
      { id: 'reserved', header: 'Reserved', accessorFn: (r) => Number(r.reserved), cell: ({ row }) => formatQty(row.original.reserved), meta: { numeric: true } },
      { id: 'committed', header: 'Committed', accessorFn: (r) => Number(r.committed), cell: ({ row }) => formatQty(row.original.committed), meta: { numeric: true } },
      {
        id: 'available',
        header: 'Available',
        accessorFn: (r) => Number(r.available),
        enableSorting: true,
        cell: ({ row }) => <span className="font-medium">{formatQty(row.original.available)}</span>,
        meta: { numeric: true },
      },
      { id: 'quarantine', header: 'Quarantine', cell: ({ row }) => formatQty(row.original.quarantine), meta: { numeric: true, hideBelow: 'md' } },
      { id: 'damaged', header: 'Damaged', cell: ({ row }) => formatQty(row.original.damaged), meta: { numeric: true, hideBelow: 'lg' } },
      { id: 'transit', header: 'In transit', cell: ({ row }) => formatQty(row.original.inTransit), meta: { numeric: true, hideBelow: 'lg' } },
      { id: 'value', header: 'Value', accessorFn: (r) => Number(r.value), enableSorting: true, cell: ({ row }) => formatPHP(row.original.value), meta: { numeric: true } },
    ],
    [],
  );
  const totals = stock.data?.totals;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="On hand" value={<QtyFigure value={totals?.onHand} unit={unit} />} hint="usable stock, all warehouses" icon={Warehouse} tone="neutral" loading={stock.isPending} />
        <Stat label="Reserved" value={<QtyFigure value={totals?.reserved} unit={unit} />} hint="approved requests, not issued" icon={Lock} tone="pending" loading={stock.isPending} />
        <Stat label="Available" value={<QtyFigure value={totals?.available} unit={unit} />} hint="on hand minus reserved" icon={PackageCheck} tone="accent" loading={stock.isPending} />
        <Stat label="On order" value={<QtyFigure value={totals?.committed} unit={unit} />} hint="open purchase orders, inbound" icon={Truck} tone="primary" loading={stock.isPending} />
        <Stat label="Stock value" value={formatPHP(totals?.value)} hint="all stock statuses" icon={Coins} tone="violet" loading={stock.isPending} />
      </div>
      <p className="text-xs text-muted-foreground">
        Available is on hand minus reserved. On order is still with suppliers and not yet in stock. Quarantined and damaged stock is never available.
      </p>
      <DataTable
        caption="Stock by warehouse"
        columns={columns}
        data={stock.data?.warehouses ?? []}
        getRowId={(row) => row.warehouseId}
        loading={stock.isPending}
        error={stock.error}
        onRetry={() => void stock.refetch()}
        maxHeightClassName="max-h-[50vh]"
        emptyState={
          <EmptyState
            compact
            icon={Boxes}
            title="No stock recorded"
            description="Stock appears here once goods are received into a warehouse."
          />
        }
      />
    </div>
  );
}

function PricesTab({ itemId, source }: { itemId: string; source?: 'PURCHASE_ORDER' | 'QUOTATION' }) {
  const prices = usePriceHistory(itemId, { limit: 50, ...(source ? { source } : {}) });
  const columns = React.useMemo<DataColumn<PriceHistoryRow>[]>(
    () => [
      { id: 'at', header: 'Date', accessorFn: (r) => r.at, enableSorting: true, cell: ({ row }) => formatDate(row.original.at), meta: { sticky: true } },
      {
        id: 'supplier',
        header: 'Supplier',
        cell: ({ row }) => (
          <Link href={`/procurement/suppliers/${row.original.supplier.id}`} className="hover:underline">
            {row.original.supplier.name}
          </Link>
        ),
      },
      {
        id: 'source',
        header: 'Source',
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <Badge tone={row.original.source === 'PURCHASE_ORDER' ? 'info' : 'neutral'}>
              {row.original.source === 'PURCHASE_ORDER' ? 'Order' : 'Quote'}
            </Badge>
            <span className="font-mono text-xs">{row.original.reference}</span>
          </span>
        ),
      },
      { id: 'qty', header: 'Qty', cell: ({ row }) => formatQty(row.original.qty, row.original.unit ?? undefined), meta: { numeric: true } },
      { id: 'price', header: 'Unit price', cell: ({ row }) => formatPHP(row.original.unitPrice), meta: { numeric: true } },
      { id: 'discount', header: 'Disc.', cell: ({ row }) => `${formatQty(row.original.discountPct, undefined, 2)}%`, meta: { numeric: true, hideBelow: 'md' } },
      {
        id: 'net',
        header: 'Net unit price',
        accessorFn: (r) => Number(r.netUnitPrice),
        enableSorting: true,
        cell: ({ row }) => <span className="font-medium">{formatPHP(row.original.netUnitPrice)}</span>,
        meta: { numeric: true },
      },
    ],
    [],
  );
  return (
    <DataTable
      caption="Price history"
      columns={columns}
      data={prices.data?.items ?? []}
      getRowId={(row) => `${row.source}-${row.referenceId}-${row.at}-${row.unitPrice}`}
      loading={prices.isPending}
      error={prices.error}
      onRetry={() => void prices.refetch()}
      maxHeightClassName="max-h-[60vh]"
      emptyState={
        <EmptyState
          compact
          icon={Tag}
          title={source === 'PURCHASE_ORDER' ? 'Never ordered' : 'No quoted or ordered prices yet'}
          description="Prices quoted by suppliers and paid on purchase orders are recorded here for comparison."
        />
      }
    />
  );
}

export function ItemDetailView({ id }: { id: string }) {
  const item = useItem(id);
  const canEdit = useCan('inventory.item', 'EDIT');
  const canSeeStock = useCan('inventory.stock', 'VIEW');
  const activity = useItemActivity(id);
  const data = item.data;
  return (
    <PermissionGate module="inventory.item">
      {item.isPending ? (
        <DetailPageSkeleton label="Loading item" />
      ) : item.isError || !data ? (
        <QueryErrorState error={item.error} onRetry={() => void item.refetch()} />
      ) : (
        <>
          <PageHeader
            title={data.name}
            breadcrumbs={[{ label: 'Inventory' }, { label: 'Items', href: '/inventory/items' }, { label: data.sku }]}
            meta={
              <>
                <span className="font-mono text-xs text-muted-foreground">{data.sku}</span>
                <StatusBadge status={data.active ? 'ACTIVE' : 'INACTIVE'} />
              </>
            }
            actions={
              canEdit ? (
                <Button asChild variant="primary">
                  <Link href={`/inventory/items/${id}/edit`}>
                    <Pencil className="size-3.5" aria-hidden />
                    Edit
                  </Link>
                </Button>
              ) : null
            }
          />
          <UrlTabs
            label="Item sections"
            tabs={[
              { id: 'overview', label: 'Overview', content: <Overview item={data} /> },
              ...(canSeeStock
                ? [{ id: 'stock', label: 'Stock', content: <StockTab itemId={id} unit={data.baseUnit} /> }]
                : []),
              { id: 'prices', label: 'Suppliers and prices', content: <PricesTab itemId={id} /> },
              { id: 'purchases', label: 'Purchase history', content: <PricesTab itemId={id} source="PURCHASE_ORDER" /> },
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
        </>
      )}
    </PermissionGate>
  );
}
