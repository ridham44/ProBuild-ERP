export const accountingKeys = {
  all: ['accounting'] as const,
  periods: (year?: number) => [...accountingKeys.all, 'periods', { year }] as const,
};
