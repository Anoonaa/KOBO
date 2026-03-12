# SQL Queries — Kabu Retail Audit

This folder is where you save your SQL audit queries for **Task 3** of the QE assignment.

## How to Run Queries

1. Start the API server: `node server.js` (this creates `kabu.db`)
2. Open **DB Browser for SQLite** → File → Open Database → select `KABU/API/kabu.db`
3. Click the **Execute SQL** tab
4. Paste your query and click **Run** (▶)

Alternatively, use the VS Code **SQLite** extension or run `sqlite3 kabu.db` in the terminal.

## Suggested File Naming

| File | Content |
|:---|:---|
| `01-financial-reconciliation.sql` | Compare account balances vs order totals |
| `02-order-audit.sql` | Check for orphaned orders |
| `03-data-hygiene.sql` | Duplicate phone numbers, missing accounts |
| `04-revenue-analysis.sql` | Revenue by product and supplier |

## Quick Reference — Table Names

| Table | Description |
|:---|:---|
| `Customers` | 55 customers (Admin, StoreManager, Customer) |
| `Stores` | 22 Kabu store locations |
| `LoyaltyAccounts` | One per customer — points balance |
| `Products` | 12 retail products |
| `Suppliers` | 5 product suppliers |
| `Discounts` | Per-product, per-tier discount rules |
| `SalesOrders` | 5,200 sales transactions |
| `Receipts` | ~4,800 issued receipts |
| `Returns` | 12 store return records |
| `AuditLog` | Admin action trail |
