'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { PageHeader } from '@/components/common/page-header';
import { Select } from '@/components/ui/select';
import { useCan } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { DirectIssueForm } from './direct-issue-form';
import { RequestIssueForm } from './request-issue-form';

type Mode = 'request' | 'direct';

/** Raises an issue either against an approved material request or, with the override permission, directly. */
export function MaterialIssueNewView() {
  const router = useRouter();
  const requestId = useSearchParams().get('requestId') ?? '';
  const canDirect = useCan('inventory.issue', 'OVERRIDE');
  const [mode, setMode] = React.useState<Mode>('request');

  return (
    <PermissionGate module="inventory.issue" action="CREATE">
      <PageHeader
        title="New material issue"
        description="Release material from a warehouse to a project. The issue stays a draft until it is posted."
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Material issues', href: '/inventory/material-issues' }, { label: 'New' }]}
      />
      <div className="space-y-4">
        {canDirect ? (
          <div className="max-w-sm">
            <Select
              aria-label="Issue type"
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as Mode);
                if (requestId) router.replace('/inventory/material-issues/new');
              }}
            >
              <option value="request">Against an approved material request</option>
              <option value="direct">Direct issue (no request)</option>
            </Select>
          </div>
        ) : null}
        {mode === 'direct' && canDirect ? <DirectIssueForm /> : <RequestIssueForm initialRequestId={requestId} />}
      </div>
    </PermissionGate>
  );
}
