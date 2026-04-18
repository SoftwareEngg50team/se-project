# EventFlow - Sound & Light Rental Operations Platform

A platform to manage events, equipment inventory, staff assignments, invoices, and vendor payments for a sound & light rental business.

## Tech Stack

- **Next.js 16** - Full-stack React framework
- **React 19** - UI library
- **TailwindCSS v4** - Utility-first CSS
- **Framer Motion** - Animation and micro-interactions
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **Drizzle ORM** - TypeScript-first ORM
- **PostgreSQL** - Database
- **Better Auth** - Authentication with organisation-based RBAC
- **shadcn/ui** - Shared UI component library
- **Bun** - JavaScript runtime and package manager

## Prerequisites

Make sure you have the following installed before starting:

1. **[Bun](https://bun.sh/)** (v1.3.0 or later)
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **[Docker](https://docs.docker.com/get-docker/)** - for running PostgreSQL

3. **[Git](https://git-scm.com/)** - for cloning the repository

## How to Run (Step by Step)

### Step 1: Clone the repository

```bash
git clone <repository-url>
cd se-project
```

### Step 2: Install dependencies

```bash
bun install
```

### Step 3: Start the PostgreSQL database

Make sure Docker is running, then:

```bash
bun run db:start
```

This starts a PostgreSQL container with:
- **Database:** se-project
- **User:** postgres
- **Password:** password
- **Port:** 5432

### Step 4: Create the environment file

Create the file `apps/web/.env` with the following content:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/se-project
BETTER_AUTH_SECRET=your-secret-key-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3001

# Optional invoice branding/payment fields
INVOICE_BRAND_COLOR=#0ea5e9
INVOICE_COMPANY_ADDRESS=
INVOICE_COMPANY_EMAIL=
INVOICE_COMPANY_PHONE=
INVOICE_COMPANY_TAX_ID=
INVOICE_COMPANY_WEBSITE=
INVOICE_BANK_ACCOUNT_NAME=
INVOICE_BANK_ACCOUNT_NUMBER=
INVOICE_BANK_IFSC=
INVOICE_BANK_NAME=
INVOICE_PAYMENT_NOTES=
INVOICE_PAYMENT_TERMS=
INVOICE_UPI_ID=
INVOICE_UPI_NAME=

# Required for Gmail invoice sending feature
GMAIL_USER=your-account@gmail.com
GMAIL_APP_PASSWORD=your-16-char-google-app-password
GMAIL_FROM_NAME=EventFlow Billing
```

### Gmail Setup Notes

- Enable 2-Step Verification on the Gmail account.
- Generate an App Password in Google Account Security settings.
- Use that App Password in `GMAIL_APP_PASSWORD` (do not use your normal Gmail password).
- If Gmail vars are missing, the app still runs, but invoice email sending will fail.

### Step 5: Push the database schema

```bash
bun run db:push
```

### Step 6: Start the development server

```bash
bun run dev
```

### Step 7: Open the application

Open [http://localhost:3001](http://localhost:3001) in your browser.

You can create a new account from the sign-up page and start using the application.

## What Is Included (Latest)

- **RBAC with organization auto-bootstrap**
   - New users are automatically ensured to belong to an organization during permission checks.
   - Role hierarchy: `owner` > `event_head` > `staff`.

- **Profile and payment settings**
   - User profile page with editable details and business billing/payment settings.
   - Optional UPI/bank/company details are used in invoice exports.

- **Invoice operations**
   - PDF and Excel invoice export.
   - Invoice send-to-Gmail from invoice detail view (with attachment).

- **Command palette**
   - Shortcut: `Ctrl/Cmd + K`.
   - Fast navigation to major modules and creation pages.

- **Data export center**
   - CSV export endpoints for operational datasets.

- **Assistant (chat + actions)**
   - Dashboard assistant can answer summary questions and execute commands.
   - Supported command intents include creating events, adding equipment/vendors, and recording payments.

- **UI/UX improvements**
   - Enhanced animations and loading states.
   - Improved category visuals and premium dashboard polish.
   - Animated landing page with counters, parallax, carousel, and text transitions.

## Assistant Command Examples

Use key/value style commands in the assistant page:

```text
create event name=Corporate Meetup, start=2026-05-10T10:00, end=2026-05-10T18:00, location=Expo Hall, client=Acme, revenue=500000
add equipment name=JBL Speaker, category=Speakers, status=available, purchaseCost=250000
add vendor name=Star Catering, type=food, phone=9876543210, email=team@star.com
record payment invoice=INV-12345, amount=150000, type=customer_payment, method=upi
```

General prompts also work, e.g. `show dashboard summary`.

## Troubleshooting

- **`bun run dev` exits quickly with code 1**
   - Ensure `apps/web/.env` exists and has required values.
   - Confirm PostgreSQL is running (`bun run db:start`).
   - Re-push schema after changes: `bun run db:push`.
   - Run `bun run build` to surface compile-time errors.

- **Port already in use**
   - Stop old dev servers and restart.

- **Invoice send fails**
   - Verify Gmail env vars and App Password configuration.
   - Confirm recipient email exists on invoice/event data.

## Stopping the Application

1. Press `Ctrl+C` in the terminal to stop the dev server.

2. Stop the database:
   ```bash
   bun run db:stop
   ```

3. To completely remove the database container and data:
   ```bash
   bun run db:down
   ```

## Project Structure

```
se-project/
├── apps/
│   └── web/           # Next.js fullstack application
│       └── src/
│           ├── app/   # Pages and routes
│           ├── components/  # App-specific components
│           ├── utils/ # oRPC client, auth client
│           └── lib/   # Utilities
├── packages/
│   ├── ui/            # Shared shadcn/ui components (29 components)
│   ├── api/           # API layer with 12 routers (oRPC)
│   ├── auth/          # Authentication config & RBAC (3 roles)
│   ├── db/            # Database schema (18 tables) & Drizzle config
│   ├── env/           # Environment variable validation (Zod)
│   └── config/        # Shared TypeScript config
```

## Available Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start all apps in development mode |
| `bun run build` | Build all applications |
| `bun run dev:web` | Start only the web application |
| `bun run check-types` | Check TypeScript types across all packages |
| `bun run db:start` | Start PostgreSQL via Docker |
| `bun run db:stop` | Stop PostgreSQL container |
| `bun run db:down` | Remove PostgreSQL container and data |
| `bun run db:push` | Push schema changes to database |
| `bun run db:generate` | Generate database migrations |
| `bun run db:migrate` | Run database migrations |
| `bun run db:studio` | Open Drizzle Studio (database GUI) |

---

## API Reference

The API is built with [oRPC](https://orpc.unnoq.com) — a type-safe RPC framework with native OpenAPI 3.1 support. All procedures are served at `/api/rpc` and an interactive API reference is available at `/api/rpc/api-reference` when the dev server is running.

All requests use `POST` with a JSON body. Every procedure is namespaced under its router (e.g. `POST /api/rpc/events/list`).

### Role-Based Access Control

Access to procedures is controlled by four middleware levels:

| Middleware | Who can call it |
|---|---|
| `publicProcedure` | Anyone (no auth required) |
| `protectedProcedure` | Any authenticated user (staff, event head, owner) |
| `staffProcedure` | Authenticated user with `event:read` permission |
| `eventHeadProcedure` | Authenticated user with `event:create` permission |
| `ownerProcedure` | Authenticated user with `organization:update` permission |

Three organisation roles map to these permissions: **owner** > **event_head** > **staff**.

#### Role Matrix

| ROLE | ACCESS LEVEL | CAN PERFORM |
|---|---|---|
| `owner` | Full access | All operations + delete events, manage organization |
| `event_head` | Management | Create/update events, assign staff & equipment, manage finances |
| `staff` | Read-only | View assignments, attendance, and event details |

---

### Health Check

| Procedure | Access | Description |
|---|---|---|
| `healthCheck` | public | Returns `"OK"`. Used to verify the API is up. |

---

### Events — `appRouter.events`

| Procedure | Access | Input | Output | Notes |
|---|---|---|---|---|
| `list` | protected | `status?`, `search?`, `page` (default 1), `limit` (default 10, max 100) | `{ events[], total }` | Filters by status enum: `upcoming \| in_progress \| completed \| cancelled` |
| `getById` | protected | `id: UUID` | Event with creator | Throws `NOT_FOUND` if missing |
| `create` | eventHead | `name`, `startDate`, `endDate`, `location`, `clientName`, `clientPhone?`, `clientEmail?`, `notes?`, `totalRevenue?` | Event | `createdBy` is set from the session automatically |
| `update` | eventHead | `id: UUID` + any event fields (all optional) | Event | Partial update — only provided fields are changed |
| `updateStatus` | eventHead | `id: UUID`, `status: enum` | Event | Status enum: `upcoming \| in_progress \| completed \| cancelled` |
| `delete` | owner | `id: UUID` | `{ success: true }` | Restricted to owners only |
| `getEventSummary` | protected | `id: UUID` | `{ event, totalExpenses, profit }` | Calculates profit as `totalRevenue - totalExpenses` |

---

### Equipment — `appRouter.equipment`

| Procedure | Access | Input | Output | Notes |
|---|---|---|---|---|
| `list` | protected | `status?`, `categoryId?`, `search?`, `page` (default 1), `limit` (default 10) | `{ items[], total }` | Status enum: `available \| assigned \| in_transit \| at_event \| under_repair` |
| `getById` | protected | `id: UUID` | Item with category and assignments | — |
| `create` | eventHead | `name`, `categoryId: UUID`, `status?` (default `available`), `purchaseDate?`, `purchaseCost?`, `notes?` | Equipment item | Validates that the category exists |
| `update` | eventHead | `id: UUID` + any fields (all optional) | Equipment item | Validates category if `categoryId` is provided |
| `updateStatus` | eventHead | `id: UUID`, `status: enum` | Equipment item | — |
| `listCategories` | protected | — | Categories with their items | — |
| `createCategory` | eventHead | `name`, `description?` | Equipment category | — |

---

### Equipment Assignments — `appRouter.equipmentAssignments`

| Procedure | Access | Input | Output | Notes |
|---|---|---|---|---|
| `assign` | eventHead | `eventId: UUID`, `equipmentId: UUID` | Assignment | Equipment must have status `available`. Status is updated to `assigned` automatically. |
| `recordReturn` | eventHead | `assignmentId: UUID`, `returnStatus: enum`, `damageNotes?` | Assignment | Return status: `returned \| missing \| damaged`. Damaged items are set to `under_repair`; others revert to `available`. |
| `getByEvent` | protected | `eventId: UUID` | Assignments with equipment and assignedByUser | — |

---

### Staff — `appRouter.staff`

| Procedure | Access | Input | Output | Notes |
|---|---|---|---|---|
| `list` | protected | `role?`, `search?`, `page` (default 1), `limit` (default 10) | `{ users: [{ ...user, role }], total }` | Role enum: `owner \| event_head \| staff`. Joins user and organisation membership tables. |
| `getById` | protected | `id: string` | User with role | Returns the user's role from their first organisation membership |

---

### Staff Assignments — `appRouter.staffAssignments`

| Procedure | Access | Input | Output | Notes |
|---|---|---|---|---|
| `assign` | eventHead | `eventId: UUID`, `userId: string` | Staff assignment | `assignedBy` is set from the session automatically |
| `remove` | eventHead | `id: UUID` | `{ success: true }` | — |
| `getByEvent` | protected | `eventId: UUID` | Assignments with user details | — |
| `getByStaff` | staff | `userId: string` | Assignments with event details | Staff members can look up their own event schedule |

---

### Attendance — `appRouter.attendance`

| Procedure | Access | Input | Output | Notes |
|---|---|---|---|---|
| `record` | eventHead | `eventId: UUID`, `userId: string`, `date`, `present: boolean`, `hoursWorked?` | Attendance record | Upserts — creates or updates the record for that event + user + date combination |
| `getByEvent` | protected | `eventId: UUID` | Attendance with user | — |
| `getByStaff` | staff | `userId: string`, `startDate?`, `endDate?` | Attendance with event | Optional date range filtering |

---

### Expenses — `appRouter.expenses`

| Procedure | Access | Input | Output | Notes |
|---|---|---|---|---|
| `create` | eventHead | `eventId: UUID`, `category: enum`, `amount: int (min 1)`, `description?`, `vendorId?` | Expense | Category enum: `salary \| food \| transportation \| equipment_repair \| miscellaneous`. Validates vendor if provided. |
| `list` | protected | `eventId: UUID`, `category?`, `page` (default 1), `limit` (default 10) | `{ expenses[], total }` | — |
| `update` | eventHead | `id: UUID` + any fields (all optional) | Expense | Validates vendor if `vendorId` is provided |
| `delete` | eventHead | `id: UUID` | `{ success: true }` | — |
| `getEventExpenseSummary` | protected | `eventId: UUID` | `{ total, byCategory: [{ category, total }] }` | Useful for event cost breakdowns |

---

### Vendors — `appRouter.vendors`

| Procedure | Access | Input | Output | Notes |
|---|---|---|---|---|
| `list` | protected | `search?`, `type?`, `page` (default 1), `limit` (default 10) | `{ vendors[], total }` | Type enum: `food \| transportation \| repair \| other` |
| `create` | eventHead | `name`, `phone?`, `email?`, `type: enum` | Vendor | — |
| `update` | eventHead | `id: UUID` + any fields (all optional) | Vendor | — |
| `getById` | protected | `id: UUID` | Vendor with expenses and payments | — |

---

### Invoices — `appRouter.invoices`

| Procedure | Access | Input | Output | Notes |
|---|---|---|---|---|
| `create` | eventHead | `eventId: UUID`, `amount: int (min 1)`, `dueDate` | Invoice | Invoice number is auto-generated as `INV-{timestamp}`. `createdBy` is set from session. |
| `list` | protected | `eventId?`, `status?`, `overdueDays?`, `page` (default 1), `limit` (default 10) | `{ invoices[], total }` | Status enum: `draft \| sent \| partial \| paid \| overdue`. Includes event and payments relations. |
| `getById` | protected | `id: UUID` | Invoice with event, payments, and creator | — |
| `update` | eventHead | `id: UUID`, `status?`, `amount?`, `dueDate?` | Invoice | — |
| `getOverdue` | protected | `days: int` (default 15) | Overdue invoices | Returns all unpaid invoices overdue by at least N days |

---

### Payments — `appRouter.payments`

| Procedure | Access | Input | Output | Notes |
|---|---|---|---|---|
| `recordPayment` | eventHead | `eventId: UUID`, `invoiceId?`, `vendorId?`, `amount: int (min 1)`, `paymentDate`, `paymentMethod?`, `type: enum`, `notes?` | Payment | Type enum: `customer_advance \| customer_payment \| vendor_payment`. Auto-updates linked invoice status to `paid` or `partial`. |
| `list` | protected | `eventId?`, `invoiceId?`, `vendorId?`, `page` (default 1), `limit` (default 10) | `{ payments[], total }` | Includes event, invoice, and vendor relations |
| `getEventBalance` | protected | `eventId: UUID` | `{ totalDue, totalPaid, balance }` | Sums all invoices (totalDue) and customer payments (totalPaid) for the event |

---

### Dashboard — `appRouter.dashboard`

| Procedure | Access | Input | Output | Notes |
|---|---|---|---|---|
| `getFinancialSummary` | protected | — | `{ totalRevenue, totalExpenses, totalCustomerPayments, totalVendorPayments, outstandingInvoices }` | Aggregates data across all events |
| `getUpcomingEvents` | protected | `limit` (default 5, max 20) | Events ordered by `startDate` | — |
| `getRecentActivity` | protected | `limit` (default 10, max 50) | Recent payments with event relations | — |

---

### Notifications — `appRouter.notifications`

| Procedure | Access | Input | Output | Notes |
|---|---|---|---|---|
| `list` | protected | `unreadOnly?`, `page` (default 1), `limit` (default 10, max 100) | `{ notifications[], total }` | Scoped to the current user's session |
| `markRead` | protected | `ids: UUID[] (min 1)` | `{ success: true }` | Validates that the notifications belong to the calling user |
| `getUnreadCount` | protected | — | `{ count }` | Efficient unread badge count |

---

### Common Validation Rules

- **IDs** — all use `z.string().uuid()`
- **Pagination** — `page` starts at 1; `limit` defaults to 10, max varies per router (100 for most)
- **Amounts** — integer with `min(1)` for all financial fields
- **Dates** — `z.coerce.date()` accepts ISO strings or Date objects
- **Strings** — most use `z.string().min(1)` to reject empty values
- **Enums** — strict validation; passing an unlisted value throws a validation error

### Error Codes

oRPC errors follow a standard structure. Common codes used across routers:

| Code | Meaning |
|---|---|
| `UNAUTHORIZED` | Request is not authenticated |
| `FORBIDDEN` | Authenticated but insufficient role/permission |
| `NOT_FOUND` | Requested resource does not exist |
| `CONFLICT` | Operation would create a conflicting state |
| `INTERNAL_SERVER_ERROR` | Unhandled server-side error |
