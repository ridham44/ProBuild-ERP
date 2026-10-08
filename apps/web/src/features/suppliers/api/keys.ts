export type SupplierFilters = Record<string, string | number>;

export const supplierKeys = {
  all: ['suppliers'] as const,
  lists: () => [...supplierKeys.all, 'list'] as const,
  list: (filters: SupplierFilters) => [...supplierKeys.lists(), filters] as const,
  details: () => [...supplierKeys.all, 'detail'] as const,
  detail: (id: string) => [...supplierKeys.details(), id] as const,
  evaluations: (id: string) => [...supplierKeys.detail(id), 'evaluations'] as const,
  performance: (id: string) => [...supplierKeys.detail(id), 'performance'] as const,
  history: (id: string, filters: SupplierFilters) =>
    [...supplierKeys.detail(id), 'history', filters] as const,
  activity: (id: string) => [...supplierKeys.detail(id), 'activity'] as const,
};
