import { ITEM_TYPES, SUPPORTED_COSTING_METHODS } from '@probuild/shared';
import { titleCase } from '@/lib/format';

export const ITEM_TYPE_OPTIONS = ITEM_TYPES.map((value) => ({ value, label: titleCase(value) }));

/** FIFO and moving average are deliberately not offered: only the methods the engine implements. */
export const COSTING_OPTIONS = SUPPORTED_COSTING_METHODS.map((value) => ({
  value,
  label: value === 'WEIGHTED_AVERAGE' ? 'Weighted average' : 'Standard cost',
  hint:
    value === 'WEIGHTED_AVERAGE'
      ? 'Unit cost follows the running average of receipts.'
      : 'Unit cost is fixed; variances are reported separately.',
}));

export function costingLabel(method: string): string {
  const supported = COSTING_OPTIONS.find((option) => option.value === method);
  return supported ? supported.label : titleCase(method);
}

export const COST_CATEGORY_OPTIONS = [
  { value: 'MATERIAL', label: 'Material' },
  { value: 'LABOR', label: 'Labor' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'SUBCONTRACT', label: 'Subcontract' },
  { value: 'OTHER', label: 'Other' },
] as const;

export type TrackingFlags = { trackBatch: boolean; trackSerial: boolean; trackExpiry: boolean };

export function trackingLabels(item: TrackingFlags): string[] {
  return [
    ...(item.trackBatch ? ['Batch'] : []),
    ...(item.trackSerial ? ['Serial'] : []),
    ...(item.trackExpiry ? ['Expiry'] : []),
  ];
}
