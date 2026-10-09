'use client';

import { FolderKanban, Pencil } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { ActivityPanel } from '@/components/common/activity-panel';
import { ContactsPanel } from '@/components/common/contacts-panel';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { DetailPageSkeleton } from '@/components/common/page-skeleton';
import { PageHeader } from '@/components/common/page-header';
import { ProgressBar, projectProgressTone } from '@/features/projects/components/progress-bar';
import { DetailList, Panel } from '@/components/common/panel';
import { StatusBadge } from '@/components/common/status-badge';
import { UrlTabs } from '@/components/common/url-tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCan } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { VAT_OPTIONS } from '@/features/company/schemas';
import { useProjects } from '@/features/projects/api/hooks';
import { formatDate, formatPHP } from '@/lib/format';
import type { CustomerDetail } from '@/lib/api/types';
import {
  useCustomer,
  useCustomerActivity,
  useDeleteCustomerContact,
  useSaveCustomerContact,
} from '../api/hooks';
import { CustomerDrawer } from './customer-form';

function Overview({ customer }: { customer: CustomerDetail }) {
  const vat = VAT_OPTIONS.find((option) => option.value === customer.vatStatus)?.label;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Profile">
        <DetailList
          columns={2}
          items={[
            { label: 'Type', value: customer.isCompany ? 'Company' : 'Individual' },
            { label: 'TIN', value: customer.tin ? <span className="font-mono">{customer.tin}</span> : null },
            { label: 'VAT status', value: vat },
            { label: 'Email', value: customer.email },
            { label: 'Phone', value: customer.phone },
            { label: 'Billing address', value: customer.billingAddress, wide: true },
            { label: 'Site address', value: customer.siteAddress, wide: true },
          ]}
        />
      </Panel>
      <Panel title="Commercial terms">
        <DetailList
          columns={2}
          items={[
            { label: 'Payment terms', value: customer.paymentTermsDays === 0 ? 'Cash' : `Net ${customer.paymentTermsDays} days` },
            { label: 'Credit limit', value: formatPHP(customer.creditLimit), numeric: true },
            { label: 'Projects', value: customer.projectCount, numeric: true },
            { label: 'Bank details', value: customer.bankInfo, wide: true },
          ]}
        />
      </Panel>
    </div>
  );
}

function CustomerProjects({ customerId }: { customerId: string }) {
  const projects = useProjects({ customerId, limit: 50 });
  if (projects.isPending) return <Skeleton className="h-32" />;
  if (projects.isError)
    return <QueryErrorState error={projects.error} onRetry={() => void projects.refetch()} compact />;
  const items = projects.data.items;
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface shadow-card">
        <EmptyState
          compact
          icon={FolderKanban}
          title="No projects for this customer"
          description="Projects contracted with this client are listed here."
        />
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/70 rounded-xl border border-border bg-surface shadow-card">
      {items.map((project) => (
        <li key={project.id} className="grid gap-x-6 gap-y-2 px-5 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_9rem_9rem] sm:items-center">
          <div className="min-w-0">
            <Link href={`/projects/${project.id}`} className="block truncate font-medium text-foreground hover:text-primary hover:underline">
              {project.name}
            </Link>
            <span className="font-mono text-xs text-muted-foreground">{project.code}</span>
          </div>
          <StatusBadge status={project.status} />
          <ProgressBar value={project.progressPct} label={`${project.name} progress`} tone={projectProgressTone(project)} />
          <span className="text-right">
            <span className="num block font-medium">{formatPHP(project.contractAmount)}</span>
            <span className="block text-xs text-muted-foreground">
              {project.startDate ? `Start ${formatDate(project.startDate)}` : 'No start date'}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CustomerDetailView({ id }: { id: string }) {
  const customer = useCustomer(id);
  const canEdit = useCan('parties.customer', 'EDIT');
  const save = useSaveCustomerContact(id);
  const remove = useDeleteCustomerContact(id);
  const activity = useCustomerActivity(id);
  const [editOpen, setEditOpen] = React.useState(false);
  const data = customer.data;

  return (
    <PermissionGate module="parties.customer">
      {customer.isPending ? (
        <DetailPageSkeleton label="Loading customer" />
      ) : customer.isError || !data ? (
        <QueryErrorState error={customer.error} onRetry={() => void customer.refetch()} />
      ) : (
        <>
          <PageHeader
            title={data.name}
            breadcrumbs={[{ label: 'Projects' }, { label: 'Customers', href: '/customers' }, { label: data.code }]}
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
            label="Customer sections"
            tabs={[
              { id: 'overview', label: 'Overview', content: <Overview customer={data} /> },
              {
                id: 'contacts',
                label: 'Contacts',
                count: data.contacts.length,
                content: (
                  <ContactsPanel
                    contacts={data.contacts}
                    canEdit={canEdit}
                    onSave={async (contactId, body) => {
                      await save.mutateAsync({ ...(contactId ? { contactId } : {}), body });
                    }}
                    onDelete={async (contactId) => {
                      await remove.mutateAsync(contactId);
                    }}
                  />
                ),
              },
              {
                id: 'projects',
                label: 'Projects',
                count: data.projectCount,
                content: <CustomerProjects customerId={id} />,
              },
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
          <CustomerDrawer open={editOpen} onOpenChange={setEditOpen} customer={data} />
        </>
      )}
    </PermissionGate>
  );
}
