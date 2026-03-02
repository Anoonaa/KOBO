# Lab 1 -- Database Setup and Verification

<p align="center">
  <img src="https://img.shields.io/badge/Difficulty-Beginner-green?style=for-the-badge" alt="Difficulty: Beginner" />
  <img src="https://img.shields.io/badge/Duration-30_min-blue?style=for-the-badge" alt="Duration: 30 min" />
  <img src="https://img.shields.io/badge/Tool-SQL_Server-red?style=for-the-badge&logo=microsoftsqlserver&logoColor=white" alt="Tool: SQL Server" />
</p>

---

## Objective

In this lab you will install and configure Microsoft SQL Server on your local machine, run the setup scripts provided in this repository, and verify that the **KoboFintech** database has been created correctly with all tables and seed data.

---

## Prerequisites

| Requirement | Details |
|:---|:---|
| **Operating System** | Windows 10 or later |
| **SQL Server** | SQL Server 2019+ (Developer or Express edition) installed locally |
| **VS Code** | Visual Studio Code with the **SQL Server (mssql)** extension installed |
| **Repository** | This repository cloned to your local machine |

> <img src="https://img.shields.io/badge/!-Important-red?style=flat-square" alt="Important" /> If you have not yet installed SQL Server, download the free Developer edition from [https://www.microsoft.com/en-us/sql-server/sql-server-downloads](https://www.microsoft.com/en-us/sql-server/sql-server-downloads).

---

## Part A -- Connect VS Code to SQL Server

1. Open **Visual Studio Code**.
2. In the left sidebar, **left-click** on the **Extensions** icon (the square icon with four squares).
3. In the search bar at the top, type `SQL Server (mssql)` and press **Enter**.
4. **Left-click** the **Install** button next to the **SQL Server (mssql)** extension by Microsoft.
5. Once installed, **left-click** the **SQL Server** icon that now appears in the left sidebar.
6. In the SQL Server panel, **left-click** the **Add Connection** button (the plug icon with a `+` symbol).
7. When prompted:
   - **Server name**: Type `localhost` and press **Enter**.
   - **Database name**: Leave blank (press **Enter** to skip).
   - **Authentication type**: Select **Windows Authentication**.
   - **Profile name**: Type `Local SQL Server` and press **Enter**.
8. You should now see a connection listed under the SQL Server panel. **Left-click** the connection to expand it and confirm it is connected.

---

## Part B -- Run the Setup Script

The setup script enables SQL Authentication and configures the `sa` (system administrator) login that the API uses to connect to the database.

1. In VS Code, press **Ctrl + O** to open a file.
2. Navigate to the repository folder, then open `Database/Setup.sql`.
3. With the file open, **right-click** anywhere inside the editor area.
4. From the context menu, **left-click** **Execute Query**.
5. If prompted to select a connection, **left-click** the **Local SQL Server** connection you created in Part A.
6. Verify the output panel at the bottom shows the message:  
   `SQL Authentication is now enabled!`

> <img src="https://img.shields.io/badge/!-Note-blue?style=flat-square" alt="Note" /> Make sure you are connected to the **master** database when running Setup.sql. You can verify this in the status bar at the bottom of VS Code.

---

## Part C -- Enable TCP/IP and Restart SQL Server

The API connects to SQL Server over TCP/IP, which is disabled by default. You must enable it manually.

### Step 1: Enable TCP/IP

1. **Left-click** the Windows **Start Menu** button (bottom-left corner of your screen).
2. Type `SQL Server Configuration Manager` and press **Enter** to open it.
3. In the left panel, **left-click** on **SQL Server Network Configuration** to expand it.
4. **Left-click** on **Protocols for MSSQLSERVER**.
5. In the right panel, find **TCP/IP** in the list.
6. **Right-click** on **TCP/IP**.
7. From the context menu, **left-click** **Enable**.
8. A dialog box will appear stating the changes will take effect after the service is restarted. **Left-click** **OK**.

### Step 2: Restart the SQL Server Service

1. **Left-click** the Windows **Start Menu** button.
2. Type `Services` and press **Enter** to open the Services application.
3. Scroll down the list and find **SQL Server (MSSQLSERVER)**.
4. **Right-click** on **SQL Server (MSSQLSERVER)**.
5. From the context menu, **left-click** **Restart**.
6. Wait for the service status to return to **Running**.

---

## Part D -- Create the KoboFintech Database

1. Return to **Visual Studio Code**.
2. Press **Ctrl + O** and open the file `Database/Database.sql`.
3. **Right-click** anywhere inside the editor area.
4. **Left-click** **Execute Query**.
5. Select the **Local SQL Server** connection if prompted.
6. Wait for the script to complete. This creates:
   - The **KoboFintech** database
   - Six tables (`ServiceProviders`, `Users`, `Wallets`, `Products`, `TransactionLedger`, `DigitalVouchers`)
   - 50 seed users with wallets
   - 3 service providers and 3 products
   - 100 sample transactions
   - The `usp_IssueDigitalVoucher` stored procedure

---

## Part E -- Verify the Database

Run the following queries to confirm everything was set up correctly. Open a new SQL file in VS Code (**Ctrl + N**), paste each query, and **right-click** then **left-click** **Execute Query**.

### Check 1: Verify the tables exist

```sql
SELECT TABLE_NAME, TABLE_TYPE
FROM KoboFintech.INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE';
```

**Expected result**: 6 rows (ServiceProviders, Users, Wallets, Products, TransactionLedger, DigitalVouchers).

### Check 2: Verify user count

```sql
SELECT COUNT(*) AS UserCount FROM KoboFintech.dbo.Users;
```

**Expected result**: `50`

### Check 3: Verify wallet balances

```sql
SELECT TOP 5 u.FullName, w.Balance, w.CurrencyCode
FROM KoboFintech.dbo.Users u
JOIN KoboFintech.dbo.Wallets w ON u.UserID = w.UserID
ORDER BY u.UserID;
```

**Expected result**: 5 rows showing user names, balances, and currency code `ZAR`.

### Check 4: Verify disabled users

```sql
SELECT UserID, FullName, ServiceStatus
FROM KoboFintech.dbo.Users
WHERE ServiceStatus = 'Disabled';
```

**Expected result**: 3 rows (UserIDs 5, 18, and 33).

### Check 5: Verify the low-balance wallet

```sql
SELECT w.WalletID, w.Balance, u.FullName
FROM KoboFintech.dbo.Wallets w
JOIN KoboFintech.dbo.Users u ON w.UserID = u.UserID
WHERE w.WalletID = 10;
```

**Expected result**: Balance of `5.00`.

---

## Completion Checklist

Use this checklist to confirm you have completed all parts of Lab 1:

- [ ] VS Code SQL Server extension installed and connected
- [ ] `Setup.sql` executed successfully against the master database
- [ ] TCP/IP enabled in SQL Server Configuration Manager
- [ ] SQL Server service restarted
- [ ] `Database.sql` executed successfully
- [ ] All 6 tables verified
- [ ] 50 users confirmed
- [ ] Disabled users confirmed (UserIDs 5, 18, 33)
- [ ] Low-balance wallet confirmed (WalletID 10, Balance 5.00)

---

<p align="center">
  <img src="https://img.shields.io/badge/Next_Lab-Lab_2:_API_Setup-blue?style=for-the-badge" alt="Next: Lab 2" />
</p>

Proceed to [Lab 2 -- API Setup and Exploration](Lab2-APISetup.md).
