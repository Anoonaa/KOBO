# Guide 1 - Database Setup and Verification

<p align="center">
  <img src="https://img.shields.io/badge/Duration-30_min-blue?style=for-the-badge" alt="Duration: 30 min" />
  <img src="https://img.shields.io/badge/Tool-SQL_Server-red?style=for-the-badge&logo=microsoftsqlserver&logoColor=white" alt="Tool: SQL Server" />
</p>

---

## Objective

In this guide you will configure Microsoft SQL Server for API connectivity, run the provided scripts, and verify that the **LewisRetail** database has been created correctly with all tables and seed data.

---

## Prerequisites

| Requirement | Details |
|:---|:---|
| **Operating System** | Windows 10 or later |
| **SQL Server** | SQL Server 2019+ (Developer or Express edition) installed locally |
| **VS Code** | Visual Studio Code with the SQL Server extension |
| **Repository** | This repository cloned to your local machine |

---

## Part A - Connect VS Code to SQL Server

1. Open **Visual Studio Code**.
2. In the left sidebar, **left-click** on the **SQL Server** icon.
3. **Left-click** the **Add Connection** button (the plug icon with a `+` symbol).
4. When prompted:
   - **Server name**: Type `localhost` and press **Enter**.
   - **Database name**: Leave blank (press **Enter** to skip). This will connect to the **master** database by default.
   - **Authentication type**: Select **Windows Authentication**.
   - **Profile name**: Type `Local SQL Server` and press **Enter**.
5. You should now see a connection listed under the SQL Server panel. **Left-click** the connection to expand it and confirm it is connected.

---

## Part B - Run the Setup Script

The setup script enables SQL Authentication and configures the `sa` (system administrator) login that the API uses to connect to the database.

1. In the VS Code file explorer (left sidebar), navigate to the `Database` folder and **double-click** on `Setup.sql` to open it.
2. Before running, confirm you are connected to the **master** database. Check the database name shown in the VS Code status bar at the bottom of the window. If it does not say `master`, **left-click** the database name in the status bar and select `master` from the list.
3. **Right-click** anywhere inside the editor area.
4. From the context menu, **left-click** **Execute Query**.
5. If prompted to select a connection, **left-click** the **Local SQL Server** connection you created in Part A.
6. Verify the output panel at the bottom shows the message:
   `SQL Authentication is now enabled!`

---

## Part C - Enable TCP/IP and Restart SQL Server

The API connects to SQL Server over TCP/IP, which is disabled by default. You must enable it manually.

### Enable TCP/IP

1. Open the **Start Menu** (bottom-left of your screen).
2. Type `SQL Server Configuration Manager` and press **Enter** to open it.
3. In the left panel, **left-click** on **SQL Server Network Configuration** to expand it.
4. **Left-click** on **Protocols for MSSQLSERVER**.
5. In the right panel, find **TCP/IP** in the list.
6. **Right-click** on **TCP/IP**.
7. From the context menu, **left-click** **Enable**.
8. A dialog box will appear stating the changes will take effect after the service is restarted. **Left-click** **OK**.

### Restart the SQL Server Service

1. Open the **Start Menu**.
2. Type `Services` and press **Enter** to open the Services application.
3. Scroll down the list and find **SQL Server (MSSQLSERVER)**.
4. **Right-click** on **SQL Server (MSSQLSERVER)**.
5. From the context menu, **left-click** **Restart**.
6. Wait for the service status to return to **Running**.

---

## Part D - Create the LewisRetail Database

1. Return to **Visual Studio Code**.
2. In the file explorer (left sidebar), navigate to the `Database` folder and **double-click** on `LewisRetail.sql` to open it.
3. Before running, confirm you are connected to the **master** database. Check the status bar at the bottom of VS Code. The script will create the LewisRetail database and switch to it automatically.
4. **Right-click** anywhere inside the editor area.
5. **Left-click** **Execute Query**.
6. Select the **Local SQL Server** connection if prompted.
7. Wait for the script to complete. This creates:
   - The **LewisRetail** database
   - Eleven tables (`Departments`, `Users`, `Stores`, `Customers`, `CreditAccounts`, `Products`, `Inventory`, `VAT_Rates`, `PricingRules`, `Orders`, `AuditLog`)
   - 55 seed users with roles (Admin, StoreManager, Cashier)
   - 22 stores, 50 customers, 30 credit accounts
   - 15 products across 5 departments
   - 5,200+ sales order records
   - The `usp_ProcessSale` and `usp_CalculateStoreRevenue` stored procedures

---

## Part E - Verify the Database

First, switch to the **LewisRetail** database by **left-clicking** the database name in the VS Code status bar (bottom of the window) and selecting `LewisRetail` from the list.

To run each query below: open a new file from the **File** menu at the top, paste the query, then **right-click** inside the editor and select **Execute Query**.

### Check 1: Verify the tables exist

```sql
SELECT TABLE_NAME, TABLE_TYPE
FROM LewisRetail.INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE';
```

**Expected result**: 11 rows (Departments, Users, Stores, Customers, CreditAccounts, Products, Inventory, VAT_Rates, PricingRules, Orders, AuditLog).

### Check 2: Verify user count

```sql
SELECT COUNT(*) AS UserCount FROM LewisRetail.dbo.Users;
```

**Expected result**: `55`

### Check 3: Verify product and inventory records

```sql
SELECT p.SKU, p.Description, p.UnitPrice, i.QuantityOnHand
FROM LewisRetail.dbo.Products p
JOIN LewisRetail.dbo.Inventory i ON p.ProductID = i.ProductID
ORDER BY p.ProductID;
```

**Expected result**: 15 rows showing products with stock quantities and prices in ZAR.

### Check 4: Verify disabled users

```sql
SELECT UserID, FullName, ServiceStatus
FROM LewisRetail.dbo.Users
WHERE ServiceStatus = 'Disabled';
```

**Expected result**: 3 rows (UserIDs 5, 18, and 33).

### Check 5: Verify order count (5,000+)

```sql
SELECT COUNT(*) AS OrderCount FROM LewisRetail.dbo.Orders;
```

**Expected result**: `5200`

### Check 6: Verify credit accounts

```sql
SELECT ca.CreditAccountID, c.FullName, ca.CreditLimit, ca.CreditStatus, ca.ExpiryDate
FROM LewisRetail.dbo.CreditAccounts ca
JOIN LewisRetail.dbo.Customers c ON ca.CustomerID = c.CustomerID
ORDER BY ca.CreditAccountID;
```

**Expected result**: 30 rows with various credit statuses including Active, Expired, Frozen, and Suspended.

---

## Completion Checklist

Use this checklist to confirm you have completed all parts of this guide:

- [ ] VS Code connected to local SQL Server
- [ ] `Setup.sql` executed successfully against the master database
- [ ] TCP/IP enabled in SQL Server Configuration Manager
- [ ] SQL Server service restarted
- [ ] `LewisRetail.sql` executed successfully
- [ ] All 11 tables verified
- [ ] 55 users confirmed
- [ ] 5,200+ orders confirmed
- [ ] Disabled users confirmed (UserIDs 5, 18, 33)
- [ ] Credit accounts verified (30 records)

---

<p align="center">
  <img src="https://img.shields.io/badge/Next-Guide_2:_API_Setup-blue?style=for-the-badge" alt="Next: Guide 2" />
</p>

Proceed to [Guide 2 - API Setup and Exploration](Guide2-APISetup.md).
