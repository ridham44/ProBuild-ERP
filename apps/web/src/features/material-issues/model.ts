export type MiPermissions = { post: boolean; cancel: boolean };
export type MiActions = { post: boolean; cancel: boolean };

/** Which workflow actions to offer for an issue status, given what the user's role may do. */
export function availableMiActions(status: string, can: MiPermissions): MiActions {
  return {
    post: status === 'DRAFT' && can.post,
    cancel: (status === 'DRAFT' || status === 'POSTED') && can.cancel,
  };
}
