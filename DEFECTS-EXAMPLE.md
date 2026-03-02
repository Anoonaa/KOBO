<p align="center">
  <img src="https://img.shields.io/badge/KOBO_FINTECH-Defect_Report-DC143C?style=for-the-badge&labelColor=8B0000" alt="Kobo Fintech Defect Report" />
</p>

<h1 align="center">🛡️ Task 4: Defect Identification &amp; Risk Assessment</h1>

<p align="center">
  <em>A comprehensive defect analysis of the Kobo Fintech Digital Distribution Platform</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Defects_Found-6-red?style=flat-square&logo=bugatti&logoColor=white" alt="6 Defects Found" />
  <img src="https://img.shields.io/badge/Critical-3-DC143C?style=flat-square" alt="3 Critical" />
  <img src="https://img.shields.io/badge/High-2-FF8C00?style=flat-square" alt="2 High" />
  <img src="https://img.shields.io/badge/Medium-1-FFD700?style=flat-square" alt="1 Medium" />
  <img src="https://img.shields.io/badge/Report_Date-2026--03--02-blue?style=flat-square" alt="Report Date" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tester-QA_Engineer-0066CC?style=flat-square&logo=checkmarx&logoColor=white" alt="QA Engineer" />
  <img src="https://img.shields.io/badge/Environment-localhost:3000-333333?style=flat-square&logo=express&logoColor=white" alt="Localhost" />
  <img src="https://img.shields.io/badge/Database-KoboFintech-CC2927?style=flat-square&logo=microsoftsqlserver&logoColor=white" alt="KoboFintech DB" />
</p>

---

## 📑 Table of Contents

| # | Section | Description |
|:---:|:---|:---|
| 1 | [Executive Summary](#-executive-summary) | High level overview of all findings |
| 2 | [4.1 Procedural Flaws](#-41-procedural-flaws--sql-logic-defects) | 3 critical flaws in `usp_IssueDigitalVoucher` |
| 3 | [4.2 Structural Flaws](#-42-structural-flaws--table--api-defects) | 3 flaws in table definitions and API setup |
| 4 | [4.3 Impact Mapping](#-43-impact-mapping) | Financial and legal impact of the 2 most critical findings |
| 5 | [Task 4 Question](#-task-4-question--dirty-data-analysis) | Dirty data analysis and recommended fix |
| 6 | [Risk Matrix](#-consolidated-risk-matrix) | Summary risk matrix for all 6 defects |
| 7 | [Appendix](#-appendix) | Evidence, SQL queries, and remediation scripts |

---

## 📋 Executive Summary

<table>
<tr>
<td width="80" align="center">
  <img src="https://img.shields.io/badge/!-ALERT-red?style=for-the-badge" alt="Alert" />
</td>
<td>
  <strong>The Kobo Fintech system contains 6 confirmed defects that pose severe financial, operational, and regulatory risk.</strong> Testing revealed that the core transaction engine (<code>usp_IssueDigitalVoucher</code>) lacks fundamental safeguards, and the underlying data architecture uses inappropriate data types for monetary operations. Left unresolved, these defects could result in direct financial loss, regulatory noncompliance, and data corruption under production load.
</td>
</tr>
</table>

### Findings at a Glance

| Defect ID | Title | Component | Severity |
|:---:|:---|:---|:---:|
| DEF‑001 | No Balance Validation Before Debit | Stored Procedure | ![Critical](https://img.shields.io/badge/-Critical-DC143C?style=flat-square) |
| DEF‑002 | No User Status Verification | Stored Procedure | ![Critical](https://img.shields.io/badge/-Critical-DC143C?style=flat-square) |
| DEF‑003 | No Transaction Atomicity (Missing ROLLBACK) | Stored Procedure | ![Critical](https://img.shields.io/badge/-Critical-DC143C?style=flat-square) |
| DEF‑004 | FLOAT Data Type Used for Financial Values | Database Schema | ![High](https://img.shields.io/badge/-High-FF8C00?style=flat-square) |
| DEF‑005 | No Duplicate Reference Guard on Ledger | Database Schema | ![High](https://img.shields.io/badge/-High-FF8C00?style=flat-square) |
| DEF‑006 | Hardcoded Production Credentials in Source Code | API Layer | ![Medium](https://img.shields.io/badge/-Medium-FFD700?style=flat-square) |

---

## 🔬 4.1 Procedural Flaws · SQL Logic Defects

> **Scope:** Analysis of the `usp_IssueDigitalVoucher` stored procedure in `Database/Database.sql`
>
> **Verdict:** This procedure is **unsafe for a high traffic production environment** for the following three reasons.

---

### DEF‑001 · No Balance Validation Before Debit

<table>
<tr>
<td width="160"><strong>Defect ID</strong></td><td>DEF‑001</td>
</tr>
<tr>
<td><strong>Title</strong></td><td>No Balance Validation Before Debit</td>
</tr>
<tr>
<td><strong>Component</strong></td><td>Stored Procedure: <code>usp_IssueDigitalVoucher</code></td>
</tr>
<tr>
<td><strong>Severity</strong></td><td><img src="https://img.shields.io/badge/-CRITICAL-DC143C?style=flat-square" alt="Critical" /></td>
</tr>
<tr>
<td><strong>Status</strong></td><td><img src="https://img.shields.io/badge/-OPEN-red?style=flat-square" alt="Open" /></td>
</tr>
</table>

#### 📝 Description

The stored procedure performs a wallet balance deduction **without first verifying** that the wallet contains sufficient funds. The `UPDATE` statement blindly subtracts the product's `FaceValue` from the wallet `Balance`, regardless of the current balance.

#### 🔍 Affected Code

```sql
-- Line 99 of Database.sql
UPDATE Wallets
SET Balance = Balance - (SELECT FaceValue FROM Products WHERE ProductID = @ProductID)
WHERE WalletID = @WalletID;
```

> ⚠️ **There is no `WHERE Balance >= FaceValue` guard or preliminary balance check anywhere in the procedure.**

#### 🧪 Steps to Reproduce

1. Confirm Wallet 10 has a balance of **R5.00** by calling `GET /api/v1/wallets/10`.
2. Issue a voucher for ProductID 1 (MTN R10 Airtime, FaceValue = R10.00):
   ```json
   {
     "walletId": 10,
     "productId": 1,
     "reference": "DEF001-TEST-001"
   }
   ```
3. Call `GET /api/v1/wallets/10` again to check the resulting balance.

#### ✅ Expected Result

The system should **reject the transaction** with a clear error message indicating insufficient funds. The wallet balance should remain at R5.00.

#### ❌ Actual Result

The transaction succeeds with HTTP `201`. The wallet balance drops to **negative R5.00** ( R5.00 minus R10.00 = negative R5.00). The user receives a valid voucher PIN despite having insufficient funds.

#### 📸 Evidence

<p align="center">
  <img src="https://img.shields.io/badge/Wallet_10_Before-R5.00-green?style=for-the-badge&logo=cash-app&logoColor=white" alt="Before: R5.00" />
  <img src="https://img.shields.io/badge/→_Transaction-R10.00_Debit-orange?style=for-the-badge" alt="R10 Debit" />
  <img src="https://img.shields.io/badge/Wallet_10_After-−R5.00-red?style=for-the-badge&logo=cash-app&logoColor=white" alt="After: -R5.00" />
</p>

**API Response (201 Created):**

```json
{
  "status": "SUCCESS",
  "pin": "1847293651",
  "traceId": "a3f8c912-7b4e-4d21-9e5a-6c8f0a3b7d12"
}
```

**Wallet State After Transaction:**

```json
{
  "data": {
    "WalletID": 10,
    "Balance": -5.00,
    "CurrencyCode": "ZAR",
    "FullName": "User_10",
    "ServiceStatus": "Active"
  }
}
```

#### 💰 Business Impact

| Dimension | Impact |
|:---|:---|
| **Financial** | Direct monetary loss: products distributed without payment |
| **Scale** | Every wallet in the system is vulnerable; 50 wallets at risk |
| **Regulatory** | Violates financial service minimum balance requirements |

#### 🔧 Recommended Fix

```sql
-- Add balance validation before debit
DECLARE @FaceValue FLOAT;
SELECT @FaceValue = FaceValue FROM Products WHERE ProductID = @ProductID;

IF (SELECT Balance FROM Wallets WHERE WalletID = @WalletID) < @FaceValue
BEGIN
    RAISERROR('Insufficient funds in wallet.', 16, 1);
    RETURN;
END;
```

---

### DEF‑002 · No User Status Verification

<table>
<tr>
<td width="160"><strong>Defect ID</strong></td><td>DEF‑002</td>
</tr>
<tr>
<td><strong>Title</strong></td><td>Disabled Users Can Issue Vouchers</td>
</tr>
<tr>
<td><strong>Component</strong></td><td>Stored Procedure: <code>usp_IssueDigitalVoucher</code></td>
</tr>
<tr>
<td><strong>Severity</strong></td><td><img src="https://img.shields.io/badge/-CRITICAL-DC143C?style=flat-square" alt="Critical" /></td>
</tr>
<tr>
<td><strong>Status</strong></td><td><img src="https://img.shields.io/badge/-OPEN-red?style=flat-square" alt="Open" /></td>
</tr>
</table>

#### 📝 Description

The `usp_IssueDigitalVoucher` procedure accepts a `@WalletID` parameter and immediately processes the transaction. It **never joins back to the `Users` table** to verify whether the account holder's `ServiceStatus` is `Active`. Users flagged as `Disabled` (UserIDs 5, 18, 33) can still successfully issue vouchers.

#### 🔍 Affected Code

```sql
-- The entire procedure operates solely on WalletID and ProductID
-- There is NO reference to the Users table or ServiceStatus column
CREATE PROCEDURE usp_IssueDigitalVoucher
    @WalletID INT,
    @ProductID INT,
    @Ref NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    -- Balance update (no user status check)
    UPDATE Wallets SET Balance = Balance - (SELECT FaceValue FROM Products WHERE ProductID = @ProductID)
    WHERE WalletID = @WalletID;
    ...
```

> ⚠️ **The `Users` table is never queried. The `ServiceStatus` column is completely ignored.**

#### 🧪 Steps to Reproduce

1. Confirm User 5 is disabled: call `GET /api/v1/users/5` and note `ServiceStatus: "Disabled"` and the associated `WalletID`.
2. Issue a voucher using that wallet:
   ```json
   {
     "walletId": 5,
     "productId": 1,
     "reference": "DEF002-DISABLED-001"
   }
   ```
3. Observe the response.

#### ✅ Expected Result

The system should **reject the transaction** with an error such as `"User account is disabled. Transaction not permitted."`

#### ❌ Actual Result

The transaction succeeds with HTTP `201`. A valid voucher PIN is generated, the wallet is debited, and a ledger entry is created for a disabled user.

#### 📸 Evidence

<p align="center">
  <img src="https://img.shields.io/badge/User_5-DISABLED-red?style=for-the-badge&logo=shield&logoColor=white" alt="User 5 Disabled" />
  <img src="https://img.shields.io/badge/→_Voucher-ISSUED-green?style=for-the-badge&logo=ticket&logoColor=white" alt="Voucher Issued" />
  <img src="https://img.shields.io/badge/⚠_This_Should-NOT_HAPPEN-red?style=for-the-badge" alt="Should Not Happen" />
</p>

**User 5 Profile:**

```json
{
  "data": {
    "UserID": 5,
    "MSISDN": "27711000005",
    "FullName": "User_5",
    "AccountTier": "Standard",
    "ServiceStatus": "Disabled",
    "WalletID": 5,
    "Balance": 577.50
  }
}
```

#### 💰 Business Impact

| Dimension | Impact |
|:---|:---|
| **Security** | Suspended/banned accounts remain fully operational |
| **Fraud** | Flagged accounts can continue transacting, enabling fraud |
| **Compliance** | Violates KYC/AML controls that require account suspension to be enforceable |

#### 🔧 Recommended Fix

```sql
-- Add user status validation at the start of the procedure
DECLARE @UserStatus NVARCHAR(20);
SELECT @UserStatus = u.ServiceStatus
FROM Users u
JOIN Wallets w ON u.UserID = w.UserID
WHERE w.WalletID = @WalletID;

IF @UserStatus != 'Active'
BEGIN
    RAISERROR('Account is not active. Transaction blocked.', 16, 1);
    RETURN;
END;
```

---

### DEF‑003 · No Transaction Atomicity (Missing ROLLBACK)

<table>
<tr>
<td width="160"><strong>Defect ID</strong></td><td>DEF‑003</td>
</tr>
<tr>
<td><strong>Title</strong></td><td>Three Step Operation Lacks Transaction Wrapping</td>
</tr>
<tr>
<td><strong>Component</strong></td><td>Stored Procedure: <code>usp_IssueDigitalVoucher</code></td>
</tr>
<tr>
<td><strong>Severity</strong></td><td><img src="https://img.shields.io/badge/-CRITICAL-DC143C?style=flat-square" alt="Critical" /></td>
</tr>
<tr>
<td><strong>Status</strong></td><td><img src="https://img.shields.io/badge/-OPEN-red?style=flat-square" alt="Open" /></td>
</tr>
</table>

#### 📝 Description

The stored procedure performs **three dependent write operations** in sequence:

| Step | Operation | Table Affected |
|:---:|:---|:---|
| 1️⃣ | Debit wallet balance | `Wallets` |
| 2️⃣ | Insert transaction record | `TransactionLedger` |
| 3️⃣ | Insert voucher record | `DigitalVouchers` |

These operations are **not wrapped** in a `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK` block. If step 3 fails (e.g., due to a constraint violation, deadlock, or server crash), the wallet has already been debited and the ledger entry already exists, but **no voucher is generated**. The user loses money without receiving their product.

#### 🔍 Affected Code

```sql
CREATE PROCEDURE usp_IssueDigitalVoucher
    @WalletID INT,
    @ProductID INT,
    @Ref NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    -- ❌ No BEGIN TRANSACTION here

    -- Step 1: Debit (executes immediately, no rollback possible)
    UPDATE Wallets SET Balance = Balance - (SELECT FaceValue FROM Products WHERE ProductID = @ProductID)
    WHERE WalletID = @WalletID;

    DECLARE @NewEntryID UNIQUEIDENTIFIER = NEWID();

    -- Step 2: Ledger entry (executes independently)
    INSERT INTO TransactionLedger (EntryID, WalletID, ProductID, Amount, ExternalReference, ProcessingStatus)
    VALUES (@NewEntryID, @WalletID, @ProductID,
            (SELECT FaceValue FROM Products WHERE ProductID = @ProductID), @Ref, 'Completed');

    -- Step 3: Voucher creation (if this fails, Steps 1 & 2 are already committed)
    INSERT INTO DigitalVouchers (EntryID, PinData, ExpiryDate)
    VALUES (@NewEntryID, CAST(ABS(CHECKSUM(NEWID())) AS NVARCHAR),
            DATEADD(YEAR, 1, GETDATE()));

    -- ❌ No COMMIT or ROLLBACK
    SELECT PinData FROM DigitalVouchers WHERE EntryID = @NewEntryID;
END;
```

#### 🧪 Failure Scenario

```
Timeline of a crash mid-transaction:

  [T+0ms]  Step 1 executes ✅  Wallet debited by R10.00
  [T+2ms]  Step 2 executes ✅  Ledger entry created (status: 'Completed')
  [T+3ms]  ⚡ SERVER CRASH / DEADLOCK / CONSTRAINT ERROR
  [T+3ms]  Step 3 FAILS    ❌  No voucher record created

  Result: Customer charged R10.00 but received NOTHING.
           Ledger says 'Completed' but no voucher exists.
           Data is now inconsistent across 3 tables.
```

#### 📸 Evidence: The Missing Safety Net

<p align="center">
  <img src="https://img.shields.io/badge/Step_1-Wallet_Debited_✓-green?style=for-the-badge" alt="Step 1 OK" />
  <img src="https://img.shields.io/badge/Step_2-Ledger_Written_✓-green?style=for-the-badge" alt="Step 2 OK" />
  <img src="https://img.shields.io/badge/Step_3-Voucher_FAILED_✗-red?style=for-the-badge" alt="Step 3 Failed" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/⚠_RESULT-Money_Lost_+_No_Product-black?style=for-the-badge&labelColor=DC143C" alt="Money Lost" />
</p>

#### 💰 Business Impact

| Dimension | Impact |
|:---|:---|
| **Financial** | Customers debited without receiving products; refund liability |
| **Data Integrity** | Ledger records marked "Completed" with no corresponding voucher |
| **Customer Trust** | Users lose confidence in the platform after unexplained balance deductions |
| **Audit Risk** | Inconsistent records make financial audits unreliable |

#### 🔧 Recommended Fix

```sql
CREATE PROCEDURE usp_IssueDigitalVoucher
    @WalletID INT,
    @ProductID INT,
    @Ref NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- All three operations inside one atomic unit
        UPDATE Wallets SET Balance = Balance - (SELECT FaceValue FROM Products WHERE ProductID = @ProductID)
        WHERE WalletID = @WalletID;

        DECLARE @NewEntryID UNIQUEIDENTIFIER = NEWID();
        INSERT INTO TransactionLedger (...) VALUES (...);
        INSERT INTO DigitalVouchers (...) VALUES (...);

        COMMIT TRANSACTION;

        SELECT PinData FROM DigitalVouchers WHERE EntryID = @NewEntryID;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
```

---

## 🏗️ 4.2 Structural Flaws · Table &amp; API Defects

> **Scope:** Analysis of the database schema (`Database.sql`) and REST API (`API/server.js`)
>
> **Verdict:** Three structural flaws violate Quality Engineering standards and introduce systemic risk.

---

### DEF‑004 · FLOAT Data Type Used for Financial Values

<table>
<tr>
<td width="160"><strong>Defect ID</strong></td><td>DEF‑004</td>
</tr>
<tr>
<td><strong>Title</strong></td><td>FLOAT Data Type Used for Monetary Columns</td>
</tr>
<tr>
<td><strong>Component</strong></td><td>Database Schema: <code>Wallets</code>, <code>Products</code>, <code>TransactionLedger</code></td>
</tr>
<tr>
<td><strong>Severity</strong></td><td><img src="https://img.shields.io/badge/-HIGH-FF8C00?style=flat-square" alt="High" /></td>
</tr>
<tr>
<td><strong>Status</strong></td><td><img src="https://img.shields.io/badge/-OPEN-red?style=flat-square" alt="Open" /></td>
</tr>
</table>

#### 📝 Description

Three tables store financial values using the `FLOAT` data type, which is an **IEEE 754 binary floating point** representation. This data type is inherently unsuitable for financial calculations because it cannot precisely represent most decimal fractions (e.g., 0.10 in binary is a repeating fraction). Over thousands of transactions, rounding errors accumulate and produce incorrect balances.

#### 🔍 Affected Columns

| Table | Column | Current Type | Correct Type |
|:---|:---|:---:|:---:|
| `Wallets` | `Balance` | `FLOAT` | `DECIMAL(18,2)` |
| `Products` | `FaceValue` | `FLOAT` | `DECIMAL(18,2)` |
| `TransactionLedger` | `Amount` | `FLOAT` | `DECIMAL(18,2)` |

#### 🧪 Demonstration of Precision Loss

```sql
-- FLOAT cannot precisely represent 0.1 + 0.2
SELECT CAST(0.1 AS FLOAT) + CAST(0.2 AS FLOAT);
-- Returns: 0.30000000000000004  (NOT 0.30)

-- DECIMAL handles it correctly
SELECT CAST(0.1 AS DECIMAL(18,2)) + CAST(0.2 AS DECIMAL(18,2));
-- Returns: 0.30  ✓
```

#### 📸 Why This Matters in Production

<p align="center">
  <img src="https://img.shields.io/badge/1_Transaction-Error_≈_R0.00-green?style=for-the-badge" alt="1 TXN" />
  <img src="https://img.shields.io/badge/1,000_Transactions-Error_≈_R0.01-yellow?style=for-the-badge" alt="1K TXN" />
  <img src="https://img.shields.io/badge/1,000,000_Transactions-Error_≈_R12.50+-red?style=for-the-badge" alt="1M TXN" />
</p>

> 📊 **At scale, floating point errors compound.** A fintech platform processing millions of transactions per month could accumulate tens of thousands of Rands in untracked discrepancies, making financial audits fail and reconciliation impossible.

#### 💰 Business Impact

| Dimension | Impact |
|:---|:---|
| **Financial** | Accumulated rounding errors cause unbalanced books |
| **Audit** | Financial reconciliation queries produce mismatched totals |
| **Regulatory** | South African Reserve Bank (SARB) requires precise record keeping |

#### 🔧 Recommended Fix

```sql
-- Migrate all financial columns to DECIMAL(18,2)
ALTER TABLE Wallets ALTER COLUMN Balance DECIMAL(18,2);
ALTER TABLE Products ALTER COLUMN FaceValue DECIMAL(18,2);
ALTER TABLE TransactionLedger ALTER COLUMN Amount DECIMAL(18,2);
```

---

### DEF‑005 · No Duplicate Reference Guard on Transaction Ledger

<table>
<tr>
<td width="160"><strong>Defect ID</strong></td><td>DEF‑005</td>
</tr>
<tr>
<td><strong>Title</strong></td><td>ExternalReference Column Allows Duplicate Values</td>
</tr>
<tr>
<td><strong>Component</strong></td><td>Database Schema: <code>TransactionLedger</code></td>
</tr>
<tr>
<td><strong>Severity</strong></td><td><img src="https://img.shields.io/badge/-HIGH-FF8C00?style=flat-square" alt="High" /></td>
</tr>
<tr>
<td><strong>Status</strong></td><td><img src="https://img.shields.io/badge/-OPEN-red?style=flat-square" alt="Open" /></td>
</tr>
</table>

#### 📝 Description

The `ExternalReference` column on the `TransactionLedger` table has **no UNIQUE constraint**. This means the same reference string can be submitted multiple times, and each submission will create a new transaction, debit the wallet again, and generate another voucher. In a production environment, network retries, double clicks, or malicious replay attacks would result in **duplicate charges**.

#### 🔍 Affected Schema

```sql
-- Current definition (Database.sql, Lines 41-49)
CREATE TABLE TransactionLedger (
    EntryID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    WalletID INT FOREIGN KEY REFERENCES Wallets(WalletID),
    ProductID INT FOREIGN KEY REFERENCES Products(ProductID),
    Amount FLOAT NOT NULL,
    ExternalReference NVARCHAR(100),     -- ❌ No UNIQUE constraint!
    ProcessingStatus NVARCHAR(20),
    CreatedTimestamp DATETIME DEFAULT GETDATE()
);
```

#### 🧪 Steps to Reproduce

1. Issue a voucher with reference `"DUPLICATE-TEST-001"`:
   ```json
   { "walletId": 1, "productId": 1, "reference": "DUPLICATE-TEST-001" }
   ```
2. Submit the **exact same request** a second time.
3. Both requests succeed with HTTP `201`.
4. The wallet is debited **twice** (R20.00 total for two R10.00 transactions).
5. Two separate vouchers are generated for the same reference.

#### 📸 Evidence

<p align="center">
  <img src="https://img.shields.io/badge/Request_1-201_Created-green?style=for-the-badge" alt="Request 1" />
  <img src="https://img.shields.io/badge/Request_2_(Same_Ref)-201_Created-green?style=for-the-badge" alt="Request 2" />
  <img src="https://img.shields.io/badge/⚠_Double_Charge-R20.00_Debited-red?style=for-the-badge" alt="Double Charge" />
</p>

**Query Showing Duplicate References:**

```sql
SELECT ExternalReference, COUNT(*) AS Occurrences
FROM TransactionLedger
GROUP BY ExternalReference
HAVING COUNT(*) > 1;
```

#### 💰 Business Impact

| Dimension | Impact |
|:---|:---|
| **Financial** | Customers charged multiple times for a single purchase |
| **Reputation** | Double billing erodes customer trust and increases chargebacks |
| **Legal** | Duplicate charges may violate Consumer Protection Act provisions |

#### 🔧 Recommended Fix

```sql
-- Add a unique constraint to prevent duplicate references
ALTER TABLE TransactionLedger
ADD CONSTRAINT UQ_ExternalReference UNIQUE (ExternalReference);
```

---

### DEF‑006 · Hardcoded Database Credentials in Source Code

<table>
<tr>
<td width="160"><strong>Defect ID</strong></td><td>DEF‑006</td>
</tr>
<tr>
<td><strong>Title</strong></td><td>Production Database Password Exposed in Source Code</td>
</tr>
<tr>
<td><strong>Component</strong></td><td>API Layer: <code>API/server.js</code></td>
</tr>
<tr>
<td><strong>Severity</strong></td><td><img src="https://img.shields.io/badge/-MEDIUM-FFD700?style=flat-square" alt="Medium" /></td>
</tr>
<tr>
<td><strong>Status</strong></td><td><img src="https://img.shields.io/badge/-OPEN-orange?style=flat-square" alt="Open" /></td>
</tr>
</table>

#### 📝 Description

The API server configuration in `server.js` contains **hardcoded database credentials** as fallback values. While environment variables are supported, the fallback defaults expose the `sa` (System Administrator) username and password directly in the source code. If this repository is made public or shared, anyone can read the credentials and gain full administrative access to the database.

#### 🔍 Affected Code

```javascript
// API/server.js, Lines 15-25
const dbConfig = {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'KoboFintech',
    user: process.env.DB_USER || 'sa',                    // ❌ SA account exposed
    password: process.env.DB_PASSWORD || 'Password123',    // ❌ Password in plain text
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: false,                                    // ❌ Encryption disabled
        trustServerCertificate: true
    }
};
```

> ⚠️ **Three issues in one block:** SA credentials in code, weak password, and encryption disabled.

#### 📸 Security Concern Visualization

<p align="center">
  <img src="https://img.shields.io/badge/User-sa_(System_Admin)-red?style=for-the-badge&logo=key&logoColor=white" alt="SA User" />
  <img src="https://img.shields.io/badge/Password-Password123-red?style=for-the-badge&logo=lock&logoColor=white" alt="Weak Password" />
  <img src="https://img.shields.io/badge/Encryption-DISABLED-red?style=for-the-badge&logo=shield&logoColor=white" alt="No Encryption" />
</p>

#### 💰 Business Impact

| Dimension | Impact |
|:---|:---|
| **Security** | Full database admin access available to anyone with source code access |
| **Compliance** | Violates POPIA (Protection of Personal Information Act) data handling requirements |
| **Operations** | Using the `sa` account for application access is a well known antipattern |

#### 🔧 Recommended Fix

```javascript
// Use environment variables exclusively, fail fast if not provided
const dbConfig = {
    server: requireEnv('DB_SERVER'),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    port: parseInt(requireEnv('DB_PORT')),
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

function requireEnv(name) {
    if (!process.env[name]) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return process.env[name];
}
```

---

## 🗺️ 4.3 Impact Mapping

> For the **two most critical findings**, below is the full chain of impact from technical fault to business consequence.

---

### 🔴 Critical Finding 1: No Balance Validation (DEF‑001)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        IMPACT CHAIN: DEF‑001                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🔧 Technical Fault                                                        │
│  │  No balance check in usp_IssueDigitalVoucher                           │
│  │                                                                         │
│  ▼                                                                         │
│  ⚙️ System Behavior                                                        │
│  │  Wallet balance goes negative; products issued without payment          │
│  │                                                                         │
│  ▼                                                                         │
│  👤 User Impact                                                            │
│  │  Users can obtain unlimited vouchers regardless of their balance        │
│  │                                                                         │
│  ▼                                                                         │
│  💼 Business Consequence                                                   │
│     • Direct financial loss on every negative balance transaction          │
│     • At scale: If 1,000 users exploit this, each issuing one R100        │
│       voucher on empty wallets = R100,000 in unrecoverable losses         │
│     • Kobo Fintech absorbs the cost of products distributed               │
│       to service providers (MTN, Vodacom, Eskom) without payment          │
│     • Potential breach of service level agreements with providers          │
│                                                                             │
│  ⚖️ Legal/Regulatory Exposure                                              │
│     • South African Reserve Bank (SARB) can impose penalties for           │
│       financial control failures in licensed fintech operations            │
│     • Service providers may pursue breach of contract claims               │
│     • Shareholders can allege negligence in fiduciary duty                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

<p align="center">
  <img src="https://img.shields.io/badge/Financial_Risk-R100,000+_Potential_Loss-DC143C?style=for-the-badge&logo=trending-down&logoColor=white" alt="Financial Risk" />
  <img src="https://img.shields.io/badge/Legal_Risk-Regulatory_Penalties-DC143C?style=for-the-badge&logo=scale-balanced&logoColor=white" alt="Legal Risk" />
</p>

---

### 🔴 Critical Finding 2: No Transaction Atomicity (DEF‑003)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        IMPACT CHAIN: DEF‑003                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🔧 Technical Fault                                                        │
│  │  Three SQL operations not wrapped in a transaction block                │
│  │                                                                         │
│  ▼                                                                         │
│  ⚙️ System Behavior                                                        │
│  │  Partial writes: money deducted, ledger recorded as "Completed",       │
│  │  but no voucher generated                                               │
│  │                                                                         │
│  ▼                                                                         │
│  👤 User Impact                                                            │
│  │  Customer pays but receives no product; support tickets flood in       │
│  │                                                                         │
│  ▼                                                                         │
│  💼 Business Consequence                                                   │
│     • Mandatory refund processing for every failed transaction             │
│     • Under high traffic (e.g., month end salary day), failure rate        │
│       increases due to deadlocks and resource contention                   │
│     • If 0.5% of 100,000 daily transactions fail mid way,                 │
│       that is 500 refund cases per day = operational bottleneck            │
│     • TransactionLedger records "Completed" for failed transactions,       │
│       making automated reconciliation unreliable                           │
│                                                                             │
│  ⚖️ Legal/Regulatory Exposure                                              │
│     • Consumer Protection Act Section 54: consumers entitled to            │
│       services paid for; failure to deliver is a statutory violation       │
│     • SARB reporting requirements demand accurate transaction records;     │
│       "ghost" completed entries constitute inaccurate reporting            │
│     • Class action risk if pattern of failed deliveries emerges            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

<p align="center">
  <img src="https://img.shields.io/badge/Operational_Risk-500+_Daily_Refund_Cases-DC143C?style=for-the-badge&logo=support&logoColor=white" alt="Operational Risk" />
  <img src="https://img.shields.io/badge/Legal_Risk-Consumer_Protection_Violation-DC143C?style=for-the-badge&logo=scale-balanced&logoColor=white" alt="Legal Risk" />
</p>

---

## ❓ Task 4 Question · Dirty Data Analysis

<table>
<tr>
<td width="80" align="center">
  <img src="https://img.shields.io/badge/Q-?-blue?style=for-the-badge" alt="Question" />
</td>
<td>
  <strong>If the system crashed mid transaction, which table is most likely to end up with "Dirty Data" based on the current logic? How would you fix this?</strong>
</td>
</tr>
</table>

---

### 🎯 Answer: The `TransactionLedger` Table

The **`TransactionLedger`** table is the most likely to contain dirty data after a mid transaction crash. Here is why:

#### Execution Order Analysis

```
 STEP    TABLE               OPERATION              CRASH VULNERABILITY
┌─────┬───────────────────┬──────────────────────┬──────────────────────────┐
│  1  │ Wallets           │ UPDATE Balance       │ Low (first operation)    │
├─────┼───────────────────┼──────────────────────┼──────────────────────────┤
│  2  │ TransactionLedger │ INSERT new record    │ ⚠️ HIGH (middle step)    │
│     │                   │ Status: 'Completed'  │                          │
├─────┼───────────────────┼──────────────────────┼──────────────────────────┤
│  3  │ DigitalVouchers   │ INSERT voucher       │ Medium (last step)       │
└─────┴───────────────────┴──────────────────────┴──────────────────────────┘
```

#### Why `TransactionLedger` Gets the Dirty Data

<p align="center">
  <img src="https://img.shields.io/badge/1-Wallet_Debited-green?style=for-the-badge" alt="Step 1" />
  <img src="https://img.shields.io/badge/2-Ledger_Says_'Completed'-orange?style=for-the-badge" alt="Step 2" />
  <img src="https://img.shields.io/badge/3-No_Voucher_Exists-red?style=for-the-badge" alt="Step 3" />
</p>

The `TransactionLedger` receives a record with `ProcessingStatus = 'Completed'` in **Step 2**, which is the middle operation. If a crash occurs between Step 2 and Step 3:

| Condition | State |
|:---|:---|
| Wallet balance | ✅ Debited (Step 1 committed) |
| Ledger record | ⚠️ Exists with status `'Completed'` (Step 2 committed) |
| Voucher record | ❌ Does not exist (Step 3 never executed) |

**This makes the `TransactionLedger` the source of dirty data because:**

1. **False Status:** The record claims the transaction is `'Completed'`, but it is not. No voucher was delivered.
2. **Orphaned Reference:** The `EntryID` in the ledger has no matching entry in `DigitalVouchers`, breaking referential expectations.
3. **Audit Poison:** Any automated reconciliation process that trusts `ProcessingStatus = 'Completed'` will produce incorrect financial reports.
4. **Recovery Difficulty:** Unlike `Wallets` (where the balance can be recalculated from transaction history), a "completed" ledger entry with no voucher is ambiguous. Was it a legitimate failure or intentional?

#### Detection Query

```sql
-- Find "Completed" transactions with no corresponding voucher (dirty data)
SELECT
    t.EntryID,
    t.WalletID,
    t.ProductID,
    t.Amount,
    t.ExternalReference,
    t.ProcessingStatus,
    t.CreatedTimestamp
FROM TransactionLedger t
LEFT JOIN DigitalVouchers v ON t.EntryID = v.EntryID
WHERE t.ProcessingStatus = 'Completed'
  AND v.VoucherID IS NULL;
```

> ⚠️ **Any rows returned by this query represent dirty data: the system recorded them as completed, but no voucher was ever issued.**

---

### 🔧 The Fix: Three Layer Protection

#### Layer 1: Transaction Atomicity

Wrap all three operations in a single transaction block so they either all succeed or all fail together.

```sql
BEGIN TRY
    BEGIN TRANSACTION;
        -- Step 1: Debit wallet
        -- Step 2: Insert ledger entry with status 'Processing'
        -- Step 3: Insert voucher
        -- Step 4: Update ledger status to 'Completed'
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    -- Log error details
    THROW;
END CATCH
```

#### Layer 2: Deferred Status Update

Do not set `ProcessingStatus = 'Completed'` until **all** operations have succeeded. Use a two phase approach:

```sql
-- Insert ledger entry with 'Processing' status (not 'Completed')
INSERT INTO TransactionLedger (..., ProcessingStatus)
VALUES (..., 'Processing');

-- ... perform voucher insert ...

-- Only mark as 'Completed' after voucher is confirmed
UPDATE TransactionLedger
SET ProcessingStatus = 'Completed'
WHERE EntryID = @NewEntryID;
```

#### Layer 3: Cleanup Job

Create a scheduled reconciliation job that detects and resolves orphaned records:

```sql
-- Automated cleanup: flag stale 'Processing' records as 'Failed'
UPDATE TransactionLedger
SET ProcessingStatus = 'Failed'
WHERE ProcessingStatus = 'Processing'
  AND CreatedTimestamp < DATEADD(MINUTE, -5, GETDATE());
```

---

## 📊 Consolidated Risk Matrix

<table>
<thead>
<tr>
<th align="center">Defect ID</th>
<th>Title</th>
<th align="center">Likelihood</th>
<th align="center">Impact</th>
<th align="center">Risk Level</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center"><strong>DEF‑001</strong></td>
<td>No Balance Validation Before Debit</td>
<td align="center"><img src="https://img.shields.io/badge/-High-FF4500?style=flat-square" alt="High" /></td>
<td align="center"><img src="https://img.shields.io/badge/-Critical-DC143C?style=flat-square" alt="Critical" /></td>
<td align="center">🔴 <strong>Critical</strong></td>
</tr>
<tr>
<td align="center"><strong>DEF‑002</strong></td>
<td>Disabled Users Can Issue Vouchers</td>
<td align="center"><img src="https://img.shields.io/badge/-High-FF4500?style=flat-square" alt="High" /></td>
<td align="center"><img src="https://img.shields.io/badge/-Critical-DC143C?style=flat-square" alt="Critical" /></td>
<td align="center">🔴 <strong>Critical</strong></td>
</tr>
<tr>
<td align="center"><strong>DEF‑003</strong></td>
<td>No Transaction Atomicity</td>
<td align="center"><img src="https://img.shields.io/badge/-Medium-FFA500?style=flat-square" alt="Medium" /></td>
<td align="center"><img src="https://img.shields.io/badge/-Critical-DC143C?style=flat-square" alt="Critical" /></td>
<td align="center">🔴 <strong>Critical</strong></td>
</tr>
<tr>
<td align="center"><strong>DEF‑004</strong></td>
<td>FLOAT for Financial Values</td>
<td align="center"><img src="https://img.shields.io/badge/-High-FF4500?style=flat-square" alt="High" /></td>
<td align="center"><img src="https://img.shields.io/badge/-High-FF8C00?style=flat-square" alt="High" /></td>
<td align="center">🟠 <strong>High</strong></td>
</tr>
<tr>
<td align="center"><strong>DEF‑005</strong></td>
<td>No Duplicate Reference Guard</td>
<td align="center"><img src="https://img.shields.io/badge/-High-FF4500?style=flat-square" alt="High" /></td>
<td align="center"><img src="https://img.shields.io/badge/-High-FF8C00?style=flat-square" alt="High" /></td>
<td align="center">🟠 <strong>High</strong></td>
</tr>
<tr>
<td align="center"><strong>DEF‑006</strong></td>
<td>Hardcoded Credentials in Source</td>
<td align="center"><img src="https://img.shields.io/badge/-Medium-FFA500?style=flat-square" alt="Medium" /></td>
<td align="center"><img src="https://img.shields.io/badge/-Medium-FFD700?style=flat-square" alt="Medium" /></td>
<td align="center">🟡 <strong>Medium</strong></td>
</tr>
</tbody>
</table>

### Risk Heat Map

```
                          I M P A C T
                 Low      Medium      High      Critical
            ┌──────────┬──────────┬──────────┬──────────┐
    High    │          │          │ DEF‑004  │ DEF‑001  │
            │          │          │ DEF‑005  │ DEF‑002  │
 L  ────────┼──────────┼──────────┼──────────┼──────────┤
 I  Medium  │          │ DEF‑006  │          │ DEF‑003  │
 K  ────────┼──────────┼──────────┼──────────┼──────────┤
 E  Low     │          │          │          │          │
 L  ────────┴──────────┴──────────┴──────────┴──────────┘
 I           ✅ Accept    🟡 Monitor  🟠 Mitigate  🔴 Urgent
 H
 O
 O
 D
```

---

## 📎 Appendix

### A. Full Impact Maps (All 6 Defects)

<details>
<summary>🔴 DEF‑001: No Balance Validation</summary>

```
No balance check in stored procedure
  → Wallet balance can go negative
    → Users receive products without paying
      → Direct financial loss for Kobo Fintech
```

</details>

<details>
<summary>🔴 DEF‑002: No User Status Check</summary>

```
ServiceStatus column never queried during voucher issuance
  → Disabled/suspended users can issue vouchers
    → Fraud prevention controls rendered ineffective
      → Regulatory noncompliance; fraud exposure
```

</details>

<details>
<summary>🔴 DEF‑003: No Transaction Atomicity</summary>

```
Three write operations without BEGIN TRANSACTION / ROLLBACK
  → Partial writes on crash: money gone, no voucher
    → Customers charged without receiving products
      → Refund liability; reputational damage; legal exposure
```

</details>

<details>
<summary>🟠 DEF‑004: FLOAT for Financial Values</summary>

```
FLOAT used for Balance, FaceValue, and Amount columns
  → Binary floating point cannot represent decimals precisely
    → Rounding errors accumulate over thousands of transactions
      → Financial records become inaccurate; audits fail
```

</details>

<details>
<summary>🟠 DEF‑005: No Duplicate Reference Guard</summary>

```
ExternalReference has no UNIQUE constraint
  → Same reference can generate multiple transactions
    → Double/triple charging on network retries
      → Customer trust erosion; chargeback costs; legal risk
```

</details>

<details>
<summary>🟡 DEF‑006: Hardcoded Credentials</summary>

```
SA password embedded as fallback in server.js
  → Anyone with source code access can read database credentials
    → Unauthorized full admin database access
      → Data breach risk; POPIA noncompliance
```

</details>

---

### B. Testing Environment

| Component | Details |
|:---|:---|
| **API Server** | Node.js Express on `localhost:3000` |
| **Database** | SQL Server `KoboFintech` on `localhost:1433` |
| **Test Interface** | Swagger UI at `/api-docs` |
| **Test Data** | 50 users, 3 products, 100 seeded transactions |
| **Key Test Wallets** | Wallet 10 (R5.00 balance), Wallets 5/18/33 (disabled owners) |

### C. References

| Standard | Relevance |
|:---|:---|
| **OWASP Top 10** | A07:2021 Identification and Authentication Failures (DEF‑006) |
| **ISO 27001** | A.14 System Acquisition, Development and Maintenance (DEF‑003, DEF‑006) |
| **PCI DSS v4.0** | Req. 6.2 Secure Software Development (DEF‑001, DEF‑003) |
| **POPIA** | Section 19: Security Safeguards (DEF‑006) |
| **IEEE 754** | Floating Point Arithmetic Standard (DEF‑004) |

---

<p align="center">
  <img src="https://img.shields.io/badge/Report_Status-COMPLETE-green?style=for-the-badge" alt="Report Complete" />
  <img src="https://img.shields.io/badge/Defects_Logged-6_of_6-blue?style=for-the-badge" alt="6 of 6" />
  <img src="https://img.shields.io/badge/Next_Step-Remediation_Sprint-purple?style=for-the-badge" alt="Next Step" />
</p>

<p align="center">
  <em>This report was prepared as part of the Kobo Fintech Quality Engineering assessment.<br/>
  All defects should be resolved before the system is promoted to a production environment.</em>
</p>
