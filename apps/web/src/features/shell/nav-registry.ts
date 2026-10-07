import type { SessionUser } from '@probuild/shared';
import {
  ArrowLeftRight,
  BadgeDollarSign,
  BookOpen,
  BookText,
  Boxes,
  Building2,
  Calculator,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Coins,
  FileBarChart,
  FileStack,
  FileText,
  FolderKanban,
  GitBranch,
  Handshake,
  History,
  Landmark,
  LayoutDashboard,
  Layers,
  ListChecks,
  Package,
  PackageCheck,
  PackageMinus,
  Receipt,
  Scale,
  ScrollText,
  SearchCheck,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  UsersRound,
  Warehouse,
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { canUser } from '@/features/auth/permissions';

export type NavGroupId =
  | 'workspace'
  | 'projects'
  | 'procurement'
  | 'inventory'
  | 'finance'
  | 'people'
  | 'equipment'
  | 'subcontractors'
  | 'documents'
  | 'administration';

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  group: NavGroupId;
  /** Module whose VIEW permission gates the entry; null means every signed-in user. */
  module: string | null;
  /** Only true when the route exists and works end to end. */
  implemented: boolean;
  keywords?: string[];
};

export const NAV_GROUPS: ReadonlyArray<{ id: NavGroupId; label: string }> = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'projects', label: 'Projects' },
  { id: 'procurement', label: 'Procurement' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'finance', label: 'Finance' },
  { id: 'people', label: 'People' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'subcontractors', label: 'Subcontractors' },
  { id: 'documents', label: 'Documents' },
  { id: 'administration', label: 'Administration' },
];

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    group: 'workspace',
    module: null,
    implemented: true,
    keywords: ['home', 'overview'],
  },

  {
    id: 'projects',
    label: 'Projects',
    href: '/projects',
    icon: FolderKanban,
    group: 'projects',
    module: 'projects.project',
    implemented: false,
  },
  {
    id: 'contracts',
    label: 'Contracts',
    href: '/contracts',
    icon: ScrollText,
    group: 'projects',
    module: 'projects.contract',
    implemented: false,
  },
  {
    id: 'boq',
    label: 'BOQ',
    href: '/boq',
    icon: ListChecks,
    group: 'projects',
    module: 'projects.boq',
    implemented: false,
  },
  {
    id: 'budgets',
    label: 'Budgets',
    href: '/budgets',
    icon: Coins,
    group: 'projects',
    module: 'projects.budget',
    implemented: false,
  },
  {
    id: 'wbs',
    label: 'WBS',
    href: '/wbs',
    icon: Layers,
    group: 'projects',
    module: 'projects.wbs',
    implemented: false,
  },

  {
    id: 'requests',
    label: 'Requests',
    href: '/procurement/requests',
    icon: ClipboardList,
    group: 'procurement',
    module: 'procurement.requisition',
    implemented: false,
  },
  {
    id: 'rfqs',
    label: 'RFQs',
    href: '/procurement/rfqs',
    icon: SearchCheck,
    group: 'procurement',
    module: 'procurement.rfq',
    implemented: false,
  },
  {
    id: 'quotations',
    label: 'Quotations',
    href: '/procurement/quotations',
    icon: FileText,
    group: 'procurement',
    module: 'procurement.rfq',
    implemented: false,
  },
  {
    id: 'purchase-orders',
    label: 'Purchase Orders',
    href: '/procurement/orders',
    icon: ShoppingCart,
    group: 'procurement',
    module: 'procurement.order',
    implemented: false,
  },
  {
    id: 'goods-receipts',
    label: 'Goods Receipts',
    href: '/procurement/receipts',
    icon: PackageCheck,
    group: 'procurement',
    module: 'procurement.receipt',
    implemented: false,
  },

  {
    id: 'items',
    label: 'Items',
    href: '/inventory/items',
    icon: Package,
    group: 'inventory',
    module: 'inventory.item',
    implemented: false,
  },
  {
    id: 'warehouses',
    label: 'Warehouses',
    href: '/inventory/warehouses',
    icon: Warehouse,
    group: 'inventory',
    module: 'organization.warehouse',
    implemented: false,
  },
  {
    id: 'stock',
    label: 'Stock',
    href: '/inventory/stock',
    icon: Boxes,
    group: 'inventory',
    module: 'inventory.stock',
    implemented: false,
  },
  {
    id: 'material-requests',
    label: 'Material Requests',
    href: '/inventory/requests',
    icon: ClipboardCheck,
    group: 'inventory',
    module: 'inventory.request',
    implemented: false,
  },
  {
    id: 'material-issues',
    label: 'Material Issues',
    href: '/inventory/issues',
    icon: PackageMinus,
    group: 'inventory',
    module: 'inventory.issue',
    implemented: false,
  },
  {
    id: 'transfers',
    label: 'Transfers',
    href: '/inventory/transfers',
    icon: ArrowLeftRight,
    group: 'inventory',
    module: 'inventory.transfer',
    implemented: false,
  },
  {
    id: 'stock-counts',
    label: 'Stock Counts',
    href: '/inventory/counts',
    icon: Calculator,
    group: 'inventory',
    module: 'inventory.count',
    implemented: false,
  },

  {
    id: 'accounts',
    label: 'Accounts',
    href: '/finance/accounts',
    icon: BookText,
    group: 'finance',
    module: 'finance.ledger',
    implemented: false,
  },
  {
    id: 'journals',
    label: 'Journals',
    href: '/finance/journals',
    icon: BookOpen,
    group: 'finance',
    module: 'finance.ledger',
    implemented: false,
  },
  {
    id: 'ap',
    label: 'Accounts Payable',
    href: '/finance/payables',
    icon: Receipt,
    group: 'finance',
    module: 'procurement.invoice',
    implemented: false,
  },
  {
    id: 'ar',
    label: 'Accounts Receivable',
    href: '/finance/receivables',
    icon: BadgeDollarSign,
    group: 'finance',
    module: 'finance.billing',
    implemented: false,
  },
  {
    id: 'payments',
    label: 'Payments',
    href: '/finance/payments',
    icon: Landmark,
    group: 'finance',
    module: 'finance.payment',
    implemented: false,
  },
  {
    id: 'periods',
    label: 'Accounting Periods',
    href: '/finance/accounting-periods',
    icon: CalendarRange,
    group: 'finance',
    module: 'finance.ledger',
    implemented: true,
    keywords: ['close', 'month end'],
  },
  {
    id: 'reports',
    label: 'Reports',
    href: '/reports',
    icon: FileBarChart,
    group: 'finance',
    module: 'reports.view',
    implemented: false,
  },

  {
    id: 'people',
    label: 'People',
    href: '/people',
    icon: UsersRound,
    group: 'people',
    module: 'workforce.employee',
    implemented: false,
  },
  {
    id: 'equipment',
    label: 'Equipment',
    href: '/equipment',
    icon: Wrench,
    group: 'equipment',
    module: 'equipment.equipment',
    implemented: false,
  },
  {
    id: 'subcontractors',
    label: 'Subcontractors',
    href: '/subcontractors',
    icon: Handshake,
    group: 'subcontractors',
    module: 'parties.subcontractor',
    implemented: false,
  },
  {
    id: 'documents',
    label: 'Documents',
    href: '/documents',
    icon: FileStack,
    group: 'documents',
    module: 'documents.document',
    implemented: false,
  },

  {
    id: 'company',
    label: 'Company',
    href: '/admin/company',
    icon: Building2,
    group: 'administration',
    module: 'organization.company',
    implemented: true,
    keywords: ['profile', 'tin', 'vat'],
  },
  {
    id: 'branches',
    label: 'Branches',
    href: '/admin/branches',
    icon: GitBranch,
    group: 'administration',
    module: 'organization.branch',
    implemented: true,
    keywords: ['office'],
  },
  {
    id: 'users',
    label: 'Users',
    href: '/admin/users',
    icon: Users,
    group: 'administration',
    module: 'security.user',
    implemented: true,
    keywords: ['accounts', 'password reset'],
  },
  {
    id: 'roles',
    label: 'Roles',
    href: '/admin/roles',
    icon: ShieldCheck,
    group: 'administration',
    module: 'security.role',
    implemented: true,
    keywords: ['permissions', 'access'],
  },
  {
    id: 'approvals',
    label: 'Approvals',
    href: '/approvals',
    icon: Scale,
    group: 'administration',
    module: 'approvals.inbox',
    implemented: true,
    keywords: ['inbox', 'pending'],
  },
  {
    id: 'approval-workflows',
    label: 'Approval Workflows',
    href: '/admin/approval-workflows',
    icon: Workflow,
    group: 'administration',
    module: 'security.workflow',
    implemented: true,
    keywords: ['amount bands'],
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    group: 'administration',
    module: null,
    implemented: false,
  },
  {
    id: 'audit-log',
    label: 'Audit Log',
    href: '/admin/audit-log',
    icon: History,
    group: 'administration',
    module: 'audit.log',
    implemented: false,
  },
];

export type NavOptions = {
  /** Development aid: also list planned entries (rendered disabled). Never true in production. */
  showPlanned?: boolean;
};

export type VisibleNavItem = NavItem & { planned: boolean };
export type VisibleNavGroup = { id: NavGroupId; label: string; items: VisibleNavItem[] };

export function isNavItemVisible(
  user: Pick<SessionUser, 'isSuperAdmin' | 'grants'>,
  item: NavItem,
  options: NavOptions = {},
): boolean {
  if (!item.implemented && !options.showPlanned) return false;
  return item.module === null || canUser(user, item.module, 'VIEW');
}

/** Groups containing at least one entry the user can see, in directive order. */
export function getVisibleNav(
  user: Pick<SessionUser, 'isSuperAdmin' | 'grants'>,
  options: NavOptions = {},
): VisibleNavGroup[] {
  return NAV_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: NAV_ITEMS.filter(
      (item) => item.group === group.id && isNavItemVisible(user, item, options),
    ).map((item) => ({ ...item, planned: !item.implemented })),
  })).filter((group) => group.items.length > 0);
}

/** Finds the entry that owns a pathname, preferring the longest matching href. */
export function findNavItem(pathname: string): NavItem | undefined {
  return [...NAV_ITEMS]
    .filter((item) => item.implemented)
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) =>
      item.href === '/'
        ? pathname === '/'
        : pathname === item.href || pathname.startsWith(`${item.href}/`),
    );
}
