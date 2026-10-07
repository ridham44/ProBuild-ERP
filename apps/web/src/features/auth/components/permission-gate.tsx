'use client';

import type { PermissionActionKey } from '@probuild/shared';
import * as React from 'react';
import { ErrorState } from '@/components/common/error-state';
import { useCan } from './current-user';

/** Hides a whole screen the user cannot open. The API still enforces the same rule. */
export function PermissionGate({
  module,
  action = 'VIEW',
  children,
}: {
  module: string;
  action?: PermissionActionKey;
  children: React.ReactNode;
}) {
  const allowed = useCan(module, action);
  if (!allowed) return <ErrorState kind="forbidden" />;
  return <>{children}</>;
}
