# Phase 2-5 directive: first complete vertical slice

Goal: a real user can log into the web app and perform, on real shared data with no fake UI:

Supplier / Item / Warehouse / Project setup -> PR -> Approval -> RFQ -> Supplier quotation (+ comparison) -> PO -> Approval -> GRN (partial + remaining) -> QC -> Stock -> Material Request -> Approval -> Material Issue -> Project Cost.

Development model per domain: design system -> backend -> UI -> integration tests -> polish. Do not build payroll, AI, portals or advanced reporting until this chain works. Phase 1 (foundation) is done; do not redo it unless a regression or security-critical defect is found.

## Build order

- Stage A: design system, application shell, authentication UI, company/branch context
- Stage B: suppliers, items, warehouses, projects (+ WBS, cost codes, minimal BOQ)
- Stage C: purchase requisition + approval
- Stage D: RFQ, supplier quotation, comparison
- Stage E: purchase order + approval
- Stage F: goods receipt + QC
- Stage G: inventory, stock ledger, stock balance
- Stage H: material request + approval
- Stage I: material issue + project cost
- Stage J: end-to-end test, UX polish, performance, security review

## Domain requirements

Suppliers: list/search/filter; detail tabs Overview, Contacts, Documents, Purchase History, Performance, Activity; payment terms, tax info, evaluation.

Items: list, category, SKU, UOM + conversion, min stock, reorder point, preferred supplier, batch/serial tracking. Detail tabs Overview, Stock, Locations, Batches, Serials, Suppliers, Purchase History, Usage, Activity. Show On Hand / Reserved / Committed / Available. FIFO is NOT implemented and must not be selectable; only weighted/moving average and standard cost are exposed.

Warehouses: list, detail (Overview, Locations, Stock, Transfers, Receipts, Issues, Counts, Activity), locations/bins, project and branch association.

Projects: code, name, client, branch, manager, dates, status, contract, WBS, cost codes. Detail tabs Overview, Financial, BOQ, WBS, Procurement, Materials, Documents, Activity. Must feel like a construction management workspace.

Purchase requisition: create, edit draft, submit, approval, reject, cancel, close. Lines: item, description, qty, UOM, required date, warehouse, project, WBS, cost code, BOQ item, justification. UI is an editable line table (add/duplicate/remove line, item search, keyboard navigation, inline validation) with a summary panel; not one giant form.

Approval UI (reusable): current status, steps, approver, decision, timestamp, comments, approve/reject only when authorized.

RFQ: created from approved PR; selected items, suppliers, deadline, delivery requirements, notes.

Quotation: supplier, item, qty, unit price, tax, discount, delivery date, payment terms, validity. Comparison matrix (Item | Required | Supplier A | B | C) highlighting lowest price, fastest delivery, preferred supplier, variance, with restrained color.

Purchase order: a business-document page. Header PO number, status, supplier, project, warehouse, date, expected delivery, total. Tabs Overview, Items, Approvals, Receipts, Invoice Match, Accounting, Documents, Activity. Actions Edit, Submit, Approve, Reject, Cancel, Print, Export.

Goods receipt (from PO): partial/full receipt, location, batch, serial, QC status, received and rejected quantity. Show Ordered / Previously Received / Remaining / Receiving Now. Over-receipt only via an explicit controlled override.

QC: inspection, pass/fail/partial acceptance, rejection reason, notes, attachments. QC decides whether stock becomes available (rejected/quarantined quantities never become AVAILABLE).

Inventory: all stock changes go through the immutable stock ledger; balances are derived. Stock list shows Item, SKU, Warehouse, Location, On Hand, Reserved, Committed, Available, Value. Item/stock movement timeline shows Date, Transaction, Reference, Quantity, Balance, User.

Material request: project, WBS, cost code, requesting employee, warehouse, required date, items, quantities, purpose; approval -> issue.

Material issue: validate authorization, project, warehouse, available quantity; create immutable stock ledger transaction; update derived balance; create project cost ledger entry (project, WBS, BOQ, cost code, item, warehouse, quantity, unit cost, total, source document); full audit. Show Requested / Approved / Issued / Remaining; prevent over-issue.

## Data integrity

As modules are built, replace plain-string dimensions with real foreign keys through careful additive migrations (ProjectCostLedger: branch, department, subcontractor, warehouse, item; JournalLine dimensions where appropriate). Do not break existing data.

## API rules for every endpoint

Authentication, authorization (deny by default, scoped), company scope, project scope where applicable, Zod validation, cursor pagination, filtering, sorting, audit, consistent RFC 9457 errors. Use the Idempotency-Key mechanism for PR submission, approval actions, PO creation, PO approval, GRN posting and material issue.

## Transaction boundaries

A GRN, for example, validates the PO and quantities, creates the GRN and lines, QC state, stock ledger rows, balances, project cost where appropriate and audit entries in ONE database transaction. Any failure leaves nothing half-created.

## Testing

For every endpoint: success, validation failure, unauthenticated, unauthorized, wrong company, wrong project, invalid state, duplicate request, concurrent request where applicable.

Final acceptance test (automated, realistic Philippine construction company): create company, branch, project, customer, supplier, warehouse, location, item, cost code, WBS, BOQ item; create PR, submit, approve; RFQ with suppliers and quotations, compare; create PO, approve; receive partial, QC, post accepted stock, verify stock; receive remainder, verify; material request, approve, issue; verify inventory, project cost ledger and audit trail. Plus: cross-company access, unauthorized approval, over-receipt, over-issue, duplicate requests, concurrent issue and receipt, invalid workflow transitions.

## Frontend standard

Serious B2B construction ERP: calm, information-dense, polished, fast; not an AI-generated admin template. Avoid generic Tailwind dashboards, default shadcn look with no identity, excessive rounded cards or gradients, giant headings, oversized KPI cards, decorative charts, giant stacked forms, identical-looking pages. Strong hierarchy, restrained semantic colors (primary, neutral, success, warning, danger, info, pending, approved, rejected, overdue), consistent spacing/radius, subtle borders, sparing shadows. Financial numbers right-aligned with tabular numerals, PHP formatting, Asia/Manila dates. Every data view has loading (skeleton), empty (explains what to do + CTA), error and permission states. Desktop first but usable on tablet/mobile. Accessible (keyboard, focus, labels, ARIA). Permission-aware navigation and actions (backend remains the authority). No fake metrics/charts/activity, no dead buttons, no "coming soon" pages presented as functional; build fewer screens that really work. Documents are workflow-aware, not List/Add/Edit/Delete CRUD: PR is a workflow, PO is a document, GRN and material issue are warehouse transactions, project is a workspace.

Reusable components required: Button, IconButton, Input, Select, Combobox, DatePicker, CurrencyInput, QuantityInput, Textarea, Checkbox, Radio, Switch, Badge, StatusBadge, Tooltip, Popover, Dialog, Drawer, Tabs, Dropdown, Toast, Alert, Skeleton, EmptyState, ErrorState, DataTable (sorting, filtering, column visibility, search, pagination, row selection, sticky header), Pagination, FilterBar, Search, FormSection, PageHeader, Breadcrumbs, Timeline, ActivityFeed, Stat, ChartContainer, FileUploader, ApprovalTimeline.

Shell: collapsible sidebar (grouped, permission-aware navigation), top bar, company/branch selector, project context, global search (command palette), notifications, user/session menu, breadcrumbs, page title and actions.

Navigation groups: Workspace (Dashboard); Projects (Projects, Contracts, BOQ, Budgets, WBS); Procurement (Requests, RFQs, Quotations, Purchase Orders, Goods Receipts); Inventory (Items, Warehouses, Stock, Material Requests, Material Issues, Transfers, Stock Counts); Finance (Accounts, Journals, AP, AR, Payments, Reports); People; Equipment; Subcontractors; Documents; Administration (Company, Branches, Users, Roles, Approvals, Settings, Audit Log). Only entries that work are linked; unbuilt areas are not shown as working.
