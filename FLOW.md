# ProBuild ERP — How it works (plain-language guide)

ProBuild is a **construction company's back office in one place**. It follows the money and materials of a building project from the first purchase request to the cost that lands on the project.

> Think of it like this: **someone asks for materials → the boss approves → we get prices from suppliers → we order → goods arrive and are checked → they sit in a warehouse → the site takes them out → the cost is charged to the project.**
> Every screen in the menu is one step of that story.

Demo logins are in `login.md` (the file is private and not committed). Sign in at the site's `/login` page.

---

## 1. The big picture

```
 SET UP (once)                          BUY                                   STORE                    USE
 ─────────────                          ───                                   ─────                    ───
 Customer ─► Project ─► Budget (BOQ)    Purchase Request ─► Approval          Goods Receipt ─► Stock   Material Request
 Suppliers   Cost codes                   │                                     (QC check)               │ approval
 Items       Team, WBS                    ▼                                       ▲                       ▼
 Warehouses                            RFQ ─► Quotations ─► Award            Warehouse             Material Issue
                                          │                                                            │
                                          ▼                                                            ▼
                                     Purchase Order ─► Approval ─► Sent ─────────┘            Cost charged to the PROJECT
                                                                                              (Budget vs Actual)
```

Three rules to remember:

1. **Nothing is typed twice.** A purchase order is built from a request or an awarded quotation, so supplier, items and prices are copied, not retyped.
2. **Big amounts need more approvals.** The more a document is worth, the more people must say yes (see section 5).
3. **Posted documents are never edited.** Receipts, issues and stock movements are a permanent history. A mistake is fixed with a new reversing entry, so the audit trail stays clean.

---

## 2. Who uses it (demo team)

| Person | Role | What they do in the demo story |
|---|---|---|
| System Admin | Company Admin | Sets everything up, can approve anything |
| Maria Santos | Project Manager | Runs the projects, approves requests |
| Jose Reyes | Procurement | Sends RFQs, compares quotes, raises purchase orders |
| Ana Cruz | Finance | Approves bigger purchase orders |
| Carlo Dizon | Warehouse Manager | Receives goods, checks quality, approves stock changes |
| Liza Garcia | Site Engineer | Asks for materials for the site |
| Ramon Bautista | Quantity Surveyor | Estimates and budgets |

You only see menu items your role is allowed to use.

---

## 3. Page by page

### Workspace

**Dashboard** (`/`) — your starting screen.
Shows what needs you today: approvals waiting, requests in approval, approved-but-not-yet-ordered requests, purchase orders waiting for approval or delivery, unread notifications, and whether the current accounting month is open. Every number is a link to the list behind it.

### Projects

**Projects** (`/projects`) — every job the company is doing.
The list shows code, client, status and contract value. Click a project to open its tabs:

| Tab | What it is for |
|---|---|
| Overview | Contract details, dates, retention, warranty |
| Financial | Contract value, budget, committed (ordered) and actual (used) cost |
| BOQ | The priced list of work the project is made of (Bill of Quantities), grouped into estimates |
| WBS | The work breakdown: the job split into parts, such as Foundation, Columns & Slabs |
| Procurement | Purchase requests for this project |
| Materials | What was issued to the site and what came back |
| Team | Who works on the project and in what role |
| Activity | A log of every change |

Project statuses: **Pipeline** (a bid we might win) → **Active** → **On Hold** → **Completed** → **Closed**. (Cancelled is possible from the first three.)
*Demo:* open **Metro Heights Tower A** (PRJ-2026-001) and look at Financial: budget vs committed vs actual.

**Customers** (`/customers`) — the clients who pay us. A customer must exist before a project can be created. The detail page holds contacts (people at the client) and payment terms.

**Cost Codes** (`/projects/cost-codes`) — the "buckets" every cost falls into, such as *Concrete & Masonry Materials* or *Direct Labor*. They keep costs comparable across projects and tie the budget to what is actually spent.

### Procurement (buying)

**Suppliers** (`/procurement/suppliers`) — the companies we buy from. Each has contacts, an **accreditation** (approved vendor status with an expiry date), performance evaluations and a purchase history. Only accredited suppliers should be invited to quote.
*Demo:* BrightWire Electrical is the one supplier that is **not** accredited.

**Requests** (`/procurement/requests`) — the **Purchase Requisition**: "the project needs these materials".
Statuses: **Draft** → **Submitted** → **Approved** (or **Rejected**), then **Partially Ordered / Ordered**, and finally **Closed** or **Cancelled**.
Steps: a person writes a request, submits it, and the approval route (section 5) decides who must approve. An approved request is the starting point for an RFQ or a purchase order.

**RFQs** (`/procurement/rfqs`) — **Request for Quotation**: asking several suppliers for prices on the same list.
Statuses: **Draft** → **Sent** → **Quoted** (at least one price is in) → **Awarded** (a winner is chosen) → Closed.
On the RFQ page you record each supplier's quotation, see a **side-by-side comparison**, and **award** the winner with a written reason.

**Quotations** (`/procurement/quotations`) — a read-and-search list of every price offer received, marked *Submitted*, *Awarded* or *Not awarded*.

**Purchase Orders** (`/procurement/orders`) — the official order sent to a supplier.
Statuses: **Draft** → **Pending Approval** → **Approved** → **Sent** → **Partially Received** → **Received** → **Closed**. (Rejected and Cancelled are possible.)
Two ways to create one: from an **awarded quotation** (normal) or straight from an approved request (when no competition is needed). A **Receive goods** button takes you to a goods receipt.

### Inventory (stock)

**Items** (`/inventory/items`) — the catalogue of materials: code (SKU), name, unit, category, minimum stock level and cost. Some items are tracked more closely: **by batch with expiry date** (for example grout) or **by serial number** (for example a power drill).

**Warehouses** (`/inventory/warehouses`) — the places stock lives: the main warehouse, a site store, a yard, a tool room, a quarantine area. A warehouse can be linked to a project and can have storage spots (zone → rack → shelf).

**Goods Receipts** (`/inventory/receipts`) — recording a delivery against a purchase order.
Steps:
1. **Create** the receipt from the PO: quantities delivered, truck, driver, supplier delivery-receipt number. Anything damaged at the dock is entered as *rejected*.
2. **Inspect (QC)** each line: **Pass**, **Fail** or **Partial** (with accepted / rejected / quarantined quantities and a reason).
3. **Post**: accepted goods enter stock, and the PO becomes *Partially Received* or *Received*.
Quarantined goods are held until someone decides to accept or reject them.
*Demo:* GRN-2026-00001 had 8 bars rejected; GRN-2026-00004 is still a **draft** waiting for inspection.

**Stock** (`/inventory/stock`) — how much of each item is in each warehouse right now, split into *Available*, *Quarantine*, *Damaged* and *In transit*, with value. Filter to see items **below their minimum**.

**Stock Movements** (`/inventory/movements`) — the permanent ledger of every in and out: receipts, issues, returns, transfers, adjustments and counts. This is where you see the **effect** of everything that happens in the store.

**Material Requests** (`/inventory/material-requests`) — the site asking the warehouse for materials: "send 400 bags of cement for the column pour".
Statuses: Draft → Submitted → **Approved** (the approver may lower quantities) → Closed.

**Material Issues** (`/inventory/material-issues`) — the warehouse **handing materials to the project**.
Two kinds: **against an approved request** (the normal way) or a **direct issue** (urgent, needs a written reason). Posting an issue **reduces stock and books the cost to the project**. A posted issue shows what was returned later.

### Finance

**Accounting Periods** (`/finance/accounting-periods`) — the months of the year, *Open* or *Closed*. Documents can only be posted in an open month. Closing a month locks it so past figures cannot change. (Demo: the early months are closed, the current month is open.)

### Administration

| Page | What it is for |
|---|---|
| **Company** | Legal name, tax number, permits, address and the receiving tolerance (how much over the ordered quantity is allowed) |
| **Branches** | Offices of the company: Head Office, Cebu, Laguna |
| **Users** | Create people and give them roles |
| **Roles** | See and adjust what each role may view, create, approve or post |
| **Approvals** | **Your inbox**: everything waiting for your yes or no. Open an item to see its steps and approve or reject (a reason is required when rejecting) |
| **Approval Workflows** | Set the rules: for each document type, which amount range needs which roles, in what order |

### Your account

Open your name menu: **Sessions and devices** lists where you are signed in and lets you sign out of other devices, and **Change password** is there too.

---

## 4. The story you can follow in the demo data

**A. Steel for Level 3 (the full buying chain)** — project *Metro Heights Tower A*
1. `PR-2026-00001` request for rebar and tie wire → approved.
2. `RFQ-2026-00001` sent to three suppliers; all three quoted; **Luzon Steel** won on price.
3. `PO-2026-00001` created from that quotation, approved, sent.
4. `GRN-2026-00001` first delivery: some bars were bent and rejected, the rest passed QC and were posted. The PO shows **Partially Received** because more is still coming.

**B. Concrete materials (buy without an RFQ)** — `PR-2026-00002` → `PO-2026-00002` → fully received (`GRN-2026-00002`).

**C. Special items** — `PO-2026-00003`: grout received **with a batch number and expiry date**, and two drills received **with serial numbers**.

**D. Things in progress** (so every status is visible)
- `RFQ-2026-00003` sent, **no quotes yet**; `RFQ-2026-00002` has **one quote**.
- `PO-2026-00004` sent, delivery not yet checked (draft receipt `GRN-2026-00004`).
- `PO-2026-00005` still a **draft**; `PO-2026-00006` **waiting for approval**.
- Requests in every state: draft, waiting for approval (`PR-2026-00007`), rejected (`PR-2026-00009`), cancelled (`PR-2026-00010`).

**E. From warehouse to project cost**
1. `MR-2026-00001` site asks for cement, sand and rebar → approved → `MIV-2026-00001` issued. The cost is charged to the project.
2. 40 bags came back unused and were **returned** to stock.
3. `MR-2026-00002` was approved but only **partly issued** (1,800 of 3,000 blocks).
4. Direct issues: urgent cement to the road project, and one serialized drill to the culvert crew.
5. `MR-2026-00004` is waiting for approval; `MR-2026-00005` is a draft.

**F. Stock housekeeping** (shows up on *Stock* and *Stock Movements*)
- A **transfer** moved blocks and cement from the main warehouse to the tower site store.
- A **stock adjustment** wrote off 12 rain-damaged cement bags; a second one is waiting for approval.
- A **cycle count** found a small difference and corrected it.

**G. The result** — open **Metro Heights Tower A → Financial** and **Materials**: budget, what is committed (ordered), what is actually used, and what the project got back.

### A 10-minute demo script
1. **Dashboard** — point at "waiting on you" and the pending order.
2. **Approvals** — approve one item and show the step history.
3. **Requests → PR-2026-00001** — the approval trail, then **RFQs → RFQ-2026-00001** and its **comparison** screen.
4. **Purchase Orders → PO-2026-00001** — *Partially Received*, then open its goods receipt and the QC result.
5. **Stock** and **Stock Movements** — see the receipts and issues in the ledger.
6. **Material Requests → MR-2026-00001** → **Material Issues** — the cost reaching the project.
7. **Projects → Metro Heights Tower A → Financial / Materials** — budget vs actual.
8. **Accounting Periods** — closed months vs the open month.

---

## 5. Approval rules (who must say yes)

When a document is **submitted**, the system looks at its total amount and picks the matching rule. Each step names a role, in order. A person cannot approve their own request (only the system admin can). The default rules (editable on *Approval Workflows*):

| Document | Amount (PHP) | Approvers, in order |
|---|---|---|
| Purchase request | up to 50,000 | Project Manager |
| | up to 250,000 | Project Manager → Procurement |
| | above | Project Manager → Finance → Company Admin |
| Purchase order | up to 100,000 | Procurement |
| | up to 500,000 | Procurement → Finance |
| | above | Procurement → Finance → Company Admin |
| Material request | up to 100,000 | Project Manager |
| | above | Project Manager → Procurement |
| Stock adjustment / Stock count | up to 50,000 | Warehouse Manager |
| | above | Warehouse Manager → Finance |

---

## 6. Status cheat sheet

| Document | Statuses, in order |
|---|---|
| Purchase request | Draft → Submitted → Approved → Partially Ordered → Ordered → Closed (or Rejected / Cancelled) |
| RFQ | Draft → Sent → Quoted → Awarded → Closed (or Cancelled) |
| Purchase order | Draft → Pending Approval → Approved → Sent → Partially Received → Received → Closed (or Rejected / Cancelled) |
| Goods receipt | Draft → Posted (or Cancelled) |
| Material request | Draft → Submitted → Approved → Closed (or Rejected / Cancelled) |
| Material issue | Draft → Posted (or Cancelled) |
| Project | Pipeline → Active → On Hold / Completed → Closed (or Cancelled) |
| Accounting period | Open ⇄ Closed |

---

## 7. What is not in the menu yet

The system already stores and calculates these, but their screens are still being built:

- **Transfers, Stock Adjustments, Stock Counts, Material Returns** — the demo data for them exists and appears on **Stock**, **Stock Movements** and the item pages, but there is no dedicated page to create them yet.
- **Finance:** Chart of Accounts, Journals, Accounts Payable / Receivable, Payments, Reports.
- **People, Equipment, Subcontractors, Documents, Settings, Audit Log** (hidden in the menu until ready).
- Supplier invoices and three-way matching exist in the database only.

---

## 8. Reloading the demo data (for developers)

From the repository root, with the API reachable and the base seed already run:

```
pnpm --filter @probuild/api prisma:seed             # company, roles, admin, approval rules
pnpm --filter @probuild/api prisma:seed:demo        # customers, suppliers, items, projects
pnpm --filter @probuild/api prisma:seed:demo-data   # branches, users, projects set-up and every document flow above
```

`prisma:seed:demo-data` talks to the real API (set `API_BASE`, for example `http://localhost:4000/v1`), so numbering, approvals, stock and project cost behave exactly like real use. It is safe to run twice: master data is found-or-created and the document flows are skipped if they already exist.
