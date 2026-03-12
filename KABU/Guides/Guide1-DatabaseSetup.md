# Guide 1 - Database Setup and Verification

<p align="center">
  <img src="https://img.shields.io/badge/Duration-15_min-blue?style=for-the-badge" alt="Duration: 15 min" />
  <img src="https://img.shields.io/badge/Tool-SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="Tool: SQLite" />
</p>

---

## Objective

In this guide you will start the Kabu Retail API server, confirm that the **kabu.db** SQLite database has been automatically created and seeded, and verify the data using a SQLite query tool.

> **No SQL Server installation required.** Kabu uses SQLite — a lightweight, file-based database. The database file `kabu.db` is created automatically in the `KABU/API/` folder the first time you run the server.

---

## Prerequisites

| Requirement | Details |
|:---|:---|
| **Operating System** | Windows, macOS, or Linux |
| **Node.js** | Version 18 or later — download from [https://nodejs.org](https://nodejs.org) |
| **VS Code** | Visual Studio Code |
| **Repository** | This repository cloned to your local machine |

---

## Part A - Install the API Dependencies

1. Open **Visual Studio Code**.
2. Select **Terminal** from the top menu bar, then **left-click** **New Terminal**.
3. In the terminal, navigate to the Kabu API folder:

   ```
   cd KABU/API
   ```

4. Install the project dependencies:

   ```
   npm install
   ```

5. Wait for the installation to complete. You should see output ending with `added X packages`.

---

## Part B - Start the Server and Create the Database

1. In the same terminal (make sure you are still in the `KABU/API` folder), run:

   ```
   node server.js
   ```

2. You should see the following output:

   ```
   Seeding kabu.db …
   Database seeded successfully.
   Kabu Retail Gateway: Port 3000 | Docs: http://localhost:3000/api-docs
   ```

3. The `kabu.db` file has now been created in the `KABU/API/` folder with all tables and seed data.

4. **Do not close this terminal** — keep the server running for the rest of this guide.

> **On subsequent starts**, you will see `Database already seeded — skipping initialisation.` instead of the seeding messages. This is normal.

---

## Part C - Install DB Browser for SQLite

To inspect the database visually and run SQL queries, install **DB Browser for SQLite** (free, open source).

1. Go to [https://sqlitebrowser.org/dl/](https://sqlitebrowser.org/dl/)
2. Download the installer for your operating system.
3. Install and open **DB Browser for SQLite**.

> **Alternative**: If you prefer to stay in VS Code, install the **SQLite** extension by Alexcvzz (extension ID: `alexcvzz.vscode-sqlite`) from the Extensions Marketplace (`Ctrl+Shift+X`). Then right-click on `kabu.db` → Open Database.

---

## Part D - Open the Database and Verify Tables

1. In **DB Browser for SQLite**, **left-click** **Open Database** (top-left toolbar).
2. Navigate to the `KABU/API/` folder and **double-click** on `kabu.db`.
3. You should see the **Database Structure** tab showing all tables.

Verify the following 10 tables are present:

| Table | Expected Records |
|:---|:---:|
| `Suppliers` | 5 |
| `Customers` | 55 |
| `Stores` | 22 |
| `LoyaltyAccounts` | 55 |
| `Products` | 12 |
| `Discounts` | 37 |
| `SalesOrders` | 5,200 |
| `Receipts` | ~4,800 |
| `Returns` | 12 |
| `AuditLog` | 5 |

---

## Part E - Run Verification Queries

1. In DB Browser for SQLite, **left-click** the **Execute SQL** tab.
2. Run each query below by pasting it into the editor and clicking **Run** (▶ button or **F5**).

### Check 1: Verify all tables exist

```sql
SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;
```

**Expected result**: 10 rows listing all table names.

### Check 2: Verify customer count

```sql
SELECT COUNT(*) AS CustomerCount FROM Customers;
```

**Expected result**: `55`

### Check 3: Verify loyalty account balances

```sql
SELECT c.FullName, la.PointsBalance, la.CurrencyCode
FROM Customers c
JOIN LoyaltyAccounts la ON c.CustomerID = la.CustomerID
ORDER BY c.CustomerID
LIMIT 5;
```

**Expected result**: 5 rows showing customer names, balances, and currency code `ZAR`.

### Check 4: Verify disabled customers

```sql
SELECT CustomerID, FullName, AccountStatus
FROM Customers
WHERE AccountStatus = 'Disabled';
```

**Expected result**: 3 rows (CustomerIDs 5, 18, and 33).

### Check 5: Verify the low-balance account

```sql
SELECT la.AccountID, la.PointsBalance, c.FullName
FROM LoyaltyAccounts la
JOIN Customers c ON la.CustomerID = c.CustomerID
WHERE la.CustomerID = 10;
```

**Expected result**: `PointsBalance` of `5.00`.

### Check 6: Verify order count

```sql
SELECT COUNT(*) AS OrderCount FROM SalesOrders;
```

**Expected result**: `5200`

### Check 7: Verify receipt count (ghost orders check)

```sql
SELECT
    (SELECT COUNT(*) FROM SalesOrders  WHERE OrderStatus = 'Completed') AS CompletedOrders,
    (SELECT COUNT(*) FROM Receipts) AS TotalReceipts;
```

**Expected result**: `TotalReceipts` should be less than `CompletedOrders` (ghost orders have no receipt).

---

## Completion Checklist

- [ ] Node.js installed (v18+)
- [ ] `npm install` completed in `KABU/API`
- [ ] `node server.js` started successfully
- [ ] `kabu.db` created in `KABU/API/` folder
- [ ] DB Browser for SQLite installed (or VS Code SQLite extension)
- [ ] `kabu.db` opened in DB Browser
- [ ] All 10 tables verified
- [ ] 55 customers confirmed
- [ ] Disabled customers confirmed (CustomerIDs 5, 18, 33)
- [ ] Low-balance account confirmed (CustomerID 10, PointsBalance 5.00)
- [ ] 5,200 orders confirmed

---

<p align="center">
  <img src="https://img.shields.io/badge/Next-Guide_2:_API_Setup-blue?style=for-the-badge" alt="Next: Guide 2" />
</p>

Proceed to [Guide 2 - API Setup and Exploration](Guide2-APISetup.md).
