import {
  ArrowLeftRight,
  ClipboardCheck,
  FileSearch,
  FolderKanban,
  History,
  Landmark,
  MapPin,
  PackageCheck,
  ReceiptText,
  ShoppingCart,
  Sheet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

/**
 * Everything the public home page claims about the product lives here, so it can be checked against what is
 * actually built (see FLOW.md "What is not in the menu yet") in one place. Keep claims factual: no customer
 * results, logos, certifications or savings figures.
 */

/** Section anchors, shared by the navigation and the sections so a link can never point at nothing. */
export const SECTION = {
  modules: 'modules',
  workflow: 'workflow',
  solutions: 'solutions',
  product: 'product',
  demo: 'demo',
} as const;

export const NAV_LINKS = [
  { href: `#${SECTION.modules}`, label: 'Modules' },
  { href: `#${SECTION.workflow}`, label: 'Workflow' },
  { href: `#${SECTION.solutions}`, label: 'Solutions' },
  { href: `#${SECTION.product}`, label: 'Product tour' },
] as const;

export const VALUE_POINTS: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: ArrowLeftRight,
    title: 'Connected procurement and inventory',
    body: 'Requests, orders, receipts and stock in one chain.',
  },
  {
    icon: Sheet,
    title: 'Project cost visibility',
    body: 'Budget, committed and actual by cost code.',
  },
  {
    icon: History,
    title: 'Approval and audit trails',
    body: 'Amount-based routing and a history on every document.',
  },
  {
    icon: MapPin,
    title: 'Philippine construction workflows',
    body: 'PHP, Manila time, retention and advance terms.',
  },
];

/** `live` means the screens exist today; `partial` means only part of the module has screens. */
export type ModuleStatus = 'live' | 'partial';

export type ModuleCard = {
  icon: LucideIcon;
  title: string;
  body: string;
  status: ModuleStatus;
  /** Shown under the body for `partial` modules: what is not on screen yet. */
  note?: string;
  href: string;
  points?: string[];
};

export const MODULES: ModuleCard[] = [
  {
    icon: ShoppingCart,
    title: 'Procurement',
    body: 'Purchase requisitions with WBS, cost code and BOQ on every line, RFQs to several suppliers, a side-by-side quotation comparison, and purchase orders built from the award.',
    status: 'live',
    href: '/procurement/requests',
    points: ['Requisitions and approvals', 'RFQs and quotation comparison', 'Purchase orders with amount-band routing'],
  },
  {
    icon: FolderKanban,
    title: 'Projects, WBS and BOQ',
    body: 'Contracts, work breakdown, estimates and an approved budget that every purchase is measured against.',
    status: 'live',
    href: '/projects',
  },
  {
    icon: PackageCheck,
    title: 'Receiving and QC',
    body: 'Partial deliveries, per-line inspection with accept, reject or quarantine, and a stop on over-receipt.',
    status: 'live',
    href: '/inventory/receipts',
  },
  {
    icon: Warehouse,
    title: 'Inventory and material control',
    body: 'Stock by warehouse and status, material requests and issues, all on an append-only stock ledger.',
    status: 'live',
    href: '/inventory/stock',
  },
  {
    icon: ClipboardCheck,
    title: 'Approvals and audit',
    body: 'Configurable approval workflows by document and amount, an approvals inbox, and an activity history on every record.',
    status: 'live',
    href: '/approvals',
  },
  {
    icon: Landmark,
    title: 'Accounting foundation',
    body: 'Open and closed accounting periods, so nothing posts into a closed month.',
    status: 'partial',
    note: 'Chart of accounts, journals and trial balance are built into the system; their screens are in progress.',
    href: '/finance/accounting-periods',
  },
];

export const ROADMAP = ['Accounts payable', 'Billing and retention', 'Payroll', 'Equipment', 'Subcontractors'] as const;

/** The procure-to-cost chain. Every stage has working screens in the current release. */
export const WORKFLOW_PHASES = [
  { key: 'buy', label: 'Buy' },
  { key: 'receive', label: 'Receive' },
  { key: 'use', label: 'Store and use' },
  { key: 'cost', label: 'Cost' },
] as const;

export type WorkflowPhase = (typeof WORKFLOW_PHASES)[number]['key'];

export const WORKFLOW_STEPS: Array<{ label: string; detail: string; phase: WorkflowPhase }> = [
  { label: 'Purchase requisition', detail: 'WBS, cost code and BOQ line on every request', phase: 'buy' },
  { label: 'RFQ and supplier comparison', detail: 'Quotations side by side, award with a reason', phase: 'buy' },
  { label: 'Purchase order', detail: 'Built from the award, approved by amount band', phase: 'buy' },
  { label: 'Goods receipt', detail: 'Partial deliveries against the order', phase: 'receive' },
  { label: 'Quality control', detail: 'Accept, reject or quarantine each line', phase: 'receive' },
  { label: 'Stock', detail: 'Append-only ledger, weighted-average cost', phase: 'use' },
  { label: 'Material issue', detail: 'Against an approved material request', phase: 'use' },
  { label: 'Project cost', detail: 'Issues net of returns, by cost code', phase: 'cost' },
];

export const BENEFITS: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: FileSearch,
    title: 'Trace materials from purchase to project use',
    body: 'Each document is created from the one before it: the order from the award, the receipt from the order, the issue from the material request. The trail stays connected.',
  },
  {
    icon: Sheet,
    title: 'Know the actual material cost of a project',
    body: 'Issued materials, net of returns, are charged to the project and cost code at the moment they leave the warehouse.',
  },
  {
    icon: History,
    title: 'Track approvals and transaction history',
    body: 'Every approval step records who decided, when and why. Posted documents are never edited, only reversed.',
  },
  {
    icon: ReceiptText,
    title: 'See procurement and receiving status',
    body: 'Which requests are waiting, which orders are partly delivered, and which receipts are still in QC.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Fewer disconnected spreadsheets',
    body: 'Purchasing, warehouse and project teams work on the same records, so there is less to reconcile by hand.',
  },
];

/** Panels of the product tour. Images are real screens from the demo environment (scripts/capture-marketing-screenshots.mjs). */
export const WALKTHROUGH = [
  {
    id: 'approvals',
    title: 'Purchase requisition and approvals',
    body: 'Raise a request for a project with WBS and cost code on each line, then follow every approval step with the approver, decision and comment.',
    image: '/marketing/requisition-approval.jpg',
    alt: 'Purchase requisition PR-2026-00001 in ProBuild with its line items and approval history',
  },
  {
    id: 'comparison',
    title: 'RFQ and supplier comparison',
    body: 'Record each supplier quotation and compare prices and delivery side by side before you award.',
    image: '/marketing/rfq-comparison.jpg',
    alt: 'Quotation comparison for RFQ-2026-00001 showing three suppliers side by side',
  },
  {
    id: 'receiving',
    title: 'Goods receipt and quality control',
    body: 'Receive a delivery against the purchase order, inspect every line, and post only what passed.',
    image: '/marketing/goods-receipt-qc.jpg',
    alt: 'Goods receipt GRN-2026-00001 with accepted and rejected quantities per line',
  },
  {
    id: 'stock',
    title: 'Stock availability',
    body: 'See what is available, quarantined or damaged in each warehouse, with value, and spot items below minimum.',
    image: '/marketing/stock.jpg',
    alt: 'Stock balance list by item and warehouse',
  },
  {
    id: 'materials',
    title: 'Project material costs',
    body: 'Open a project to see what was issued to site, what came back, and the material cost that remains.',
    image: '/marketing/project-materials.jpg',
    alt: 'Materials tab of the Metro Heights Tower A project with issues, returns and material cost',
  },
] as const;

export const SOLUTIONS_IMAGE = {
  src: '/marketing/project-financial.jpg',
  alt: 'Financial tab of the Metro Heights Tower A project: budget, committed and actual cost by cost code',
} as const;

export const FOOTER_MODULE_LINKS = [
  { href: '/projects', label: 'Projects' },
  { href: '/procurement/requests', label: 'Procurement' },
  { href: '/inventory/receipts', label: 'Receiving and QC' },
  { href: '/inventory/stock', label: 'Inventory' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/finance/accounting-periods', label: 'Accounting periods' },
] as const;
