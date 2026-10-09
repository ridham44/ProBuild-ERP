'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { EntityCombobox } from '@/components/common/entity-combobox';
import { FormField } from '@/components/common/form-field';
import { PageHeader } from '@/components/common/page-header';
import { Panel } from '@/components/common/panel';
import { QueryErrorState } from '@/components/common/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { searchReceivableOrderOptions, useReceivableLines } from '../api/hooks';
import { GoodsReceiptForm } from './goods-receipt-form';

/** Starts a receipt from a purchase order: pick the order, then record what arrived against its open lines. */
export function GoodsReceiptNewView() {
  const router = useRouter();
  const preselected = useSearchParams().get('orderId') ?? '';
  const [orderId, setOrderId] = React.useState(preselected);
  const lines = useReceivableLines(orderId);

  return (
    <PermissionGate module="procurement.receipt" action="CREATE">
      <PageHeader
        title="New goods receipt"
        description="Record a delivery against a purchase order. The receipt stays a draft until it is posted."
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Goods receipts', href: '/inventory/receipts' }, { label: 'New' }]}
      />
      <div className="space-y-4">
        <Panel title="Purchase order">
          <div className="max-w-md">
            <FormField label="Receive against" required>
              {(field) => (
                <EntityCombobox
                  entity="receivable-orders"
                  id={field.id}
                  search={searchReceivableOrderOptions}
                  value={orderId || null}
                  {...(lines.data ? { selectedLabel: lines.data.orderNumber } : {})}
                  onChange={(value) => {
                    setOrderId(value ?? '');
                    router.replace(value ? `/inventory/receipts/new?orderId=${value}` : '/inventory/receipts/new');
                  }}
                  clearable={false}
                  placeholder="Search approved or sent purchase orders"
                />
              )}
            </FormField>
          </div>
        </Panel>
        {!orderId ? null : lines.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : lines.isError ? (
          <QueryErrorState error={lines.error} onRetry={() => void lines.refetch()} />
        ) : (
          <GoodsReceiptForm key={orderId} order={lines.data} />
        )}
      </div>
    </PermissionGate>
  );
}
