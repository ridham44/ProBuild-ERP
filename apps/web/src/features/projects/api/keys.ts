export type ProjectFilters = Record<string, string | number>;

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: ProjectFilters) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  dashboard: (id: string) => [...projectKeys.detail(id), 'dashboard'] as const,
  members: (id: string) => [...projectKeys.detail(id), 'members'] as const,
  contracts: (id: string) => [...projectKeys.detail(id), 'contracts'] as const,
  activity: (id: string) => [...projectKeys.detail(id), 'activity'] as const,
  wbs: (id: string) => [...projectKeys.detail(id), 'wbs'] as const,
  estimates: (id: string) => [...projectKeys.detail(id), 'estimates'] as const,
  boq: (id: string, filters: ProjectFilters) => [...projectKeys.detail(id), 'boq', filters] as const,
  boqAll: (id: string) => [...projectKeys.detail(id), 'boq'] as const,
  budget: (id: string) => [...projectKeys.detail(id), 'budget'] as const,
};

export const costCodeKeys = {
  all: ['cost-codes'] as const,
  lists: () => [...costCodeKeys.all, 'list'] as const,
  list: (filters: ProjectFilters) => [...costCodeKeys.lists(), filters] as const,
};
