export type BranchFilters = { search?: string; cursor?: string; limit?: number };

export const branchKeys = {
  all: ['branches'] as const,
  lists: () => [...branchKeys.all, 'list'] as const,
  list: (filters: BranchFilters) => [...branchKeys.lists(), filters] as const,
};
