// Permission model: Role -> Module -> Action, applied within a scope
// (company / branch / project / warehouse). Module keys are "<domain>.<resource>".

export const PERMISSION_ACTIONS = [
  'VIEW',
  'CREATE',
  'EDIT',
  'DELETE',
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'CANCEL',
  'POST',
  'EXPORT',
  'PRINT',
  'OVERRIDE',
  'ADJUST',
  'TRANSFER',
  'CLOSE',
] as const;
export type PermissionActionKey = (typeof PERMISSION_ACTIONS)[number];

export const MODULES = [
  'organization.company',
  'organization.branch',
  'organization.department',
  'organization.warehouse',
  'security.user',
  'security.role',
  'security.workflow',
  'parties.customer',
  'parties.supplier',
  'parties.subcontractor',
  'projects.project',
  'projects.contract',
  'projects.wbs',
  'projects.costcode',
  'projects.estimate',
  'projects.boq',
  'projects.budget',
  'projects.variation',
  'projects.claim',
  'projects.schedule',
  'projects.rfi',
  'projects.drawing',
  'projects.closeout',
  'procurement.requisition',
  'procurement.rfq',
  'procurement.order',
  'procurement.receipt',
  'procurement.invoice',
  'inventory.item',
  'inventory.stock',
  'inventory.request',
  'inventory.issue',
  'inventory.return',
  'inventory.transfer',
  'inventory.adjustment',
  'inventory.count',
  'inventory.mrp',
  'field.report',
  'field.progress',
  'field.hse',
  'workforce.employee',
  'workforce.attendance',
  'workforce.leave',
  'workforce.payroll',
  'equipment.equipment',
  'equipment.fuel',
  'equipment.tools',
  'equipment.assets',
  'subcontract.contract',
  'subcontract.claim',
  'finance.ledger',
  'finance.billing',
  'finance.collection',
  'finance.payment',
  'finance.bank',
  'finance.expense',
  'finance.tax',
  'compliance.document',
  'documents.document',
  'reports.view',
  'ai.assistant',
  'audit.log',
  'approvals.inbox',
  'portal.client',
  'portal.supplier',
  'portal.subcontractor',
  'portal.employee',
] as const;
export type ModuleKey = (typeof MODULES)[number];

type RoleGrant = { modules: string[]; actions: PermissionActionKey[] | 'ALL' };

const READ: PermissionActionKey[] = ['VIEW', 'EXPORT', 'PRINT'];
const WRITE: PermissionActionKey[] = ['VIEW', 'CREATE', 'EDIT', 'SUBMIT', 'EXPORT', 'PRINT'];
const OPERATE: PermissionActionKey[] = [...WRITE, 'POST', 'CANCEL', 'TRANSFER', 'ADJUST'];

/** A pattern ending in ".*" matches every module in that domain. "*" matches everything. */
export const DEFAULT_ROLES: Record<string, RoleGrant[]> = {
  'Super Admin': [{ modules: ['*'], actions: 'ALL' }],
  'Company Admin': [{ modules: ['*'], actions: 'ALL' }],
  Finance: [
    { modules: ['finance.*', 'reports.view', 'compliance.*'], actions: 'ALL' },
    { modules: ['projects.*', 'procurement.*', 'parties.*', 'subcontract.*'], actions: [...READ, 'APPROVE', 'REJECT'] },
    { modules: ['approvals.inbox', 'ai.assistant'], actions: 'ALL' },
  ],
  Accountant: [
    { modules: ['finance.*'], actions: [...OPERATE] },
    { modules: ['projects.*', 'procurement.*', 'parties.*', 'subcontract.*', 'reports.view'], actions: READ },
    { modules: ['approvals.inbox'], actions: 'ALL' },
  ],
  'Project Manager': [
    { modules: ['projects.*', 'field.*', 'subcontract.*', 'inventory.request', 'inventory.issue', 'inventory.mrp'], actions: [...OPERATE, 'APPROVE', 'REJECT', 'CLOSE'] },
    { modules: ['procurement.requisition', 'procurement.order'], actions: [...WRITE, 'APPROVE', 'REJECT'] },
    { modules: ['procurement.requisition'], actions: ['CANCEL', 'CLOSE'] },
    { modules: ['reports.view', 'documents.document', 'approvals.inbox', 'ai.assistant', 'parties.*', 'inventory.stock', 'inventory.item', 'finance.billing'], actions: [...WRITE, 'APPROVE', 'REJECT'] },
  ],
  'Project Engineer': [
    { modules: ['projects.*', 'field.*', 'inventory.request', 'procurement.requisition'], actions: WRITE },
    { modules: ['procurement.requisition'], actions: ['CANCEL'] },
    { modules: ['inventory.stock', 'inventory.item', 'reports.view', 'documents.document'], actions: WRITE },
    { modules: ['approvals.inbox'], actions: ['VIEW'] },
  ],
  'Site Engineer': [
    { modules: ['field.*', 'projects.rfi', 'inventory.request', 'projects.drawing'], actions: WRITE },
    { modules: ['projects.project', 'projects.boq', 'projects.wbs', 'inventory.stock', 'inventory.item'], actions: READ },
    { modules: ['documents.document'], actions: WRITE },
  ],
  'Quantity Surveyor': [
    { modules: ['projects.estimate', 'projects.boq', 'projects.budget', 'projects.variation', 'projects.claim', 'projects.wbs', 'projects.costcode', 'subcontract.*', 'finance.billing'], actions: WRITE },
    { modules: ['projects.project', 'reports.view', 'field.progress'], actions: READ },
  ],
  Procurement: [
    { modules: ['procurement.*', 'parties.supplier'], actions: [...OPERATE, 'CLOSE'] },
    { modules: ['procurement.rfq'], actions: ['APPROVE'] },
    { modules: ['inventory.item', 'inventory.stock', 'inventory.mrp', 'projects.project', 'projects.boq', 'reports.view'], actions: READ },
    { modules: ['approvals.inbox'], actions: 'ALL' },
  ],
  'Warehouse Manager': [
    { modules: ['inventory.*', 'procurement.receipt', 'organization.warehouse'], actions: 'ALL' },
    { modules: ['projects.project', 'projects.boq', 'projects.wbs', 'projects.costcode', 'procurement.order', 'reports.view'], actions: READ },
    { modules: ['approvals.inbox'], actions: 'ALL' },
  ],
  'Warehouse Staff': [
    { modules: ['inventory.stock', 'inventory.issue', 'inventory.return', 'inventory.transfer', 'inventory.count', 'inventory.request', 'procurement.receipt'], actions: [...WRITE, 'POST', 'TRANSFER'] },
    { modules: ['inventory.item', 'projects.project', 'projects.wbs', 'projects.costcode', 'projects.boq', 'procurement.order'], actions: ['VIEW'] },
  ],
  HR: [
    { modules: ['workforce.*', 'compliance.document'], actions: [...OPERATE, 'APPROVE', 'REJECT'] },
    { modules: ['reports.view', 'documents.document'], actions: WRITE },
    { modules: ['approvals.inbox'], actions: 'ALL' },
  ],
  Payroll: [
    { modules: ['workforce.payroll', 'workforce.attendance', 'workforce.employee', 'workforce.leave'], actions: [...OPERATE, 'APPROVE'] },
    { modules: ['reports.view'], actions: READ },
  ],
  'Safety Officer': [
    { modules: ['field.hse', 'workforce.employee', 'compliance.document'], actions: WRITE },
    { modules: ['projects.project', 'documents.document', 'reports.view'], actions: READ },
  ],
  'Equipment Manager': [
    { modules: ['equipment.*'], actions: [...OPERATE, 'CLOSE'] },
    { modules: ['projects.project', 'reports.view'], actions: READ },
  ],
  'Fleet Manager': [
    { modules: ['equipment.equipment', 'equipment.fuel'], actions: [...OPERATE] },
    { modules: ['compliance.document', 'reports.view'], actions: READ },
  ],
  Supervisor: [
    { modules: ['field.*', 'workforce.attendance', 'inventory.request'], actions: WRITE },
    { modules: ['projects.project', 'projects.wbs', 'projects.boq', 'inventory.stock'], actions: READ },
  ],
  Foreman: [
    { modules: ['field.report', 'field.progress', 'workforce.attendance', 'inventory.request', 'inventory.return'], actions: ['VIEW', 'CREATE', 'SUBMIT'] },
    { modules: ['projects.project', 'projects.wbs', 'projects.boq'], actions: ['VIEW'] },
  ],
  'Client Portal': [{ modules: ['portal.client'], actions: ['VIEW', 'APPROVE', 'CREATE'] }],
  'Supplier Portal': [{ modules: ['portal.supplier'], actions: ['VIEW', 'CREATE', 'EDIT'] }],
  'Subcontractor Portal': [{ modules: ['portal.subcontractor'], actions: ['VIEW', 'CREATE', 'EDIT'] }],
  'Employee Portal': [{ modules: ['portal.employee'], actions: ['VIEW', 'CREATE'] }],
};

export function moduleMatches(pattern: string, module: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('.*')) return module.startsWith(pattern.slice(0, -1));
  return pattern === module;
}

export function expandRolePermissions(
  grants: RoleGrant[],
): Array<{ module: ModuleKey; action: PermissionActionKey }> {
  const seen = new Set<string>();
  const out: Array<{ module: ModuleKey; action: PermissionActionKey }> = [];
  for (const grant of grants) {
    const actions = grant.actions === 'ALL' ? PERMISSION_ACTIONS : grant.actions;
    for (const module of MODULES) {
      if (!grant.modules.some((p) => moduleMatches(p, module))) continue;
      for (const action of actions) {
        const key = `${module}:${action}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ module, action });
      }
    }
  }
  return out;
}
