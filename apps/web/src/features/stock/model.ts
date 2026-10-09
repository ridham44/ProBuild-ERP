/** Page of the document behind a stock movement, for the document types that have a screen. */
export function movementReferenceHref(type: string, id: string): string | null {
  if (type === 'GOODS_RECEIPT') return `/inventory/receipts/${id}`;
  if (type === 'MATERIAL_ISSUE') return `/inventory/material-issues/${id}`;
  return null;
}
