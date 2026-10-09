'use client';

import { PageHeader } from '@/components/common/page-header';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { MaterialRequestForm } from './material-request-form';

export function MaterialRequestNewView() {
  return (
    <PermissionGate module="inventory.request" action="CREATE">
      <PageHeader
        title="New material request"
        description="List the material a project needs from a warehouse. Drafts can be submitted for approval from the request page."
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Material requests', href: '/inventory/material-requests' }, { label: 'New' }]}
      />
      <MaterialRequestForm />
    </PermissionGate>
  );
}
