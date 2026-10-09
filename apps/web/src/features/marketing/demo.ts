/** Public demo account shown on the home page. It must only ever exist in a demo environment. */
export const DEMO_ACCOUNT = {
  email: 'admin@probuild.local',
  password: 'Demo@Pass1234',
} as const;

export const WORKFLOW_STEPS = [
  { label: 'Requisition', detail: 'WBS, cost code and BOQ on every line' },
  { label: 'RFQ & award', detail: 'Compare quotations, split sourcing' },
  { label: 'Purchase order', detail: 'Amount-band approval, then sent' },
  { label: 'Goods receipt', detail: 'Partial deliveries, over-receipt control' },
  { label: 'QC', detail: 'Accept, reject or quarantine per line' },
  { label: 'Stock', detail: 'Append-only ledger, weighted-average cost' },
  { label: 'Material issue', detail: 'Against an approved request, FEFO picking' },
  { label: 'Project cost', detail: 'Issues less returns, by cost code' },
] as const;

export const DEMO_STEPS = [
  'Sign in with the account on this page.',
  'Open Procurement and raise a purchase request for a project.',
  'Approve it, award a supplier, and approve the purchase order.',
  'Receive the goods, run QC, then issue material to the project.',
  'Open the project Materials tab to see the material actual cost.',
] as const;
