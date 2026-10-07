export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (search: string) => [...userKeys.lists(), { search }] as const,
};
