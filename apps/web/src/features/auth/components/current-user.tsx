'use client';

import type { PermissionActionKey, SessionUser } from '@probuild/shared';
import * as React from 'react';
import { canUser, type AccessScope } from '../permissions';

const CurrentUserContext = React.createContext<SessionUser | null>(null);

export function CurrentUserProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): SessionUser {
  const user = React.useContext(CurrentUserContext);
  if (!user) throw new Error('useCurrentUser must be used inside CurrentUserProvider');
  return user;
}

/** Whether the signed-in user may perform an action; hides UI, never replaces server checks. */
export function useCan(
  module: string,
  action: PermissionActionKey,
  scope: AccessScope = {},
): boolean {
  const user = useCurrentUser();
  const { projectId, warehouseId, branchId } = scope;
  return React.useMemo(
    () => canUser(user, module, action, { projectId, warehouseId, branchId }),
    [user, module, action, projectId, warehouseId, branchId],
  );
}
