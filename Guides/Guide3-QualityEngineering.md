# Guide 3 - Quality Engineering Exercises

<p align="center">
  <img src="https://img.shields.io/badge/Duration-60_min-blue?style=for-the-badge" alt="Duration: 60 min" />
  <img src="https://img.shields.io/badge/Focus-Testing_&_Auditing-purple?style=for-the-badge" alt="Focus: Testing & Auditing" />
</p>

---

## Objective

In this guide you will validate the Kobo Fintech API through functional testing, audit the database for integrity issues, and identify defects and risks in the system. The exercises are structured around three task areas that map directly to your assignment deliverables.

---

## Prerequisites

| Requirement | Details |
|:---|:---|
| **Guide 1 Completed** | Database is set up and populated |
| **Guide 2 Completed** | API is running on `http://localhost:3000` |
| **Swagger UI** | Open at `http://localhost:3000/api-docs` |

---

## Task 2 - API Functional Validation

In this section you will test each API endpoint to verify it behaves correctly under normal conditions, edge cases, and error scenarios.

### 2.1 - Standard Validation

Use Swagger UI to test each endpoint below. For every test, record the **HTTP status code** and a summary of the **response body**.

#### GET Endpoints

| # | Endpoint | Input | Expected Status | What to Verify |
|:--|:---|:---|:---|:---|
| 1 | `GET /api/v1/users` | None | `200` | Returns 50 user records |
| 2 | `GET /api/v1/users/1` | `id = 1` | `200` | Returns user details with wallet info |
| 3 | `GET /api/v1/users/9999` | `id = 9999` | `404` | Returns `User does not exist.` |
| 4 | `GET /api/v1/products` | None | `200` | Returns 3 products |
| 5 | `GET /api/v1/wallets/1` | `id = 1` | `200` | Returns wallet balance and owner |
| 6 | `GET /api/v1/wallets/9999` | `id = 9999` | `404` | Returns `Wallet not found.` |
| 7 | `GET /api/v1/transactions` | None | `200` | Returns all transactions |
| 8 | `GET /api/v1/transactions?walletId=1` | `walletId = 1` | `200` | Returns transactions for Wallet 1 only |
| 9 | `GET /api/v1/vouchers` | None | `200` | Returns all vouchers |

**Instructions:**

1. **Left-click** on the endpoint row in Swagger UI to expand it.
2. **Left-click** the **Try it out** button.
3. Enter any required parameters.
4. **Left-click** **Execute**.
5. Record the status code and response in a table for your submission.

#### POST Endpoint - Successful Issuance

1. Expand **POST /api/v1/distribution/issue-voucher**.
2. **Left-click** **Try it out**.
3. Enter the following request body:

   ```json
   {
     "walletId": 1,
     "productId": 1,
     "reference": "TASK2-VALID-001"
   }
   ```

4. **Left-click** **Execute**.
5. Confirm the response has status `201` and includes a `pin` and `status: "SUCCESS"`.
6. Note the wallet balance before and after by using **GET /api/v1/wallets/1**. Confirm the balance decreased by R10.00.

#### POST Endpoint - Missing Fields

Test each of the following request bodies. Record the status code and error message for each.

| # | Request Body | Expected Status |
|:--|:---|:---|
| 1 | `{}` | `400` |
| 2 | `{ "walletId": 1 }` | `400` |
| 3 | `{ "productId": 1, "reference": "TEST" }` | `400` |
| 4 | `{ "walletId": 1, "productId": 1 }` | `400` |

---

### 2.2 - Business Logic Testing

These tests check whether the API enforces the financial rules expected of a fintech system.

#### Test A - Low-Balance Wallet

Wallet 10 has been seeded with a balance of only **R5.00**. The cheapest product (MTN R10 Airtime) costs R10.00.

1. Confirm the balance by calling **GET /api/v1/wallets/10**. Record the balance.
2. Attempt to issue a voucher:

   ```json
   {
     "walletId": 10,
     "productId": 1,
     "reference": "TASK2-LOWBAL-001"
   }
   ```

3. **Left-click** **Execute**.
4. Record the response status and body.
5. Call **GET /api/v1/wallets/10** again. Record the new balance.
6. **Document your findings:**
   - Did the system allow the transaction?
   - Did the wallet balance go negative?
   - Is this acceptable behavior for a fintech application? Why or why not?

#### Test B - Disabled User

Users 5, 18, and 33 have `ServiceStatus = 'Disabled'`.

1. Call **GET /api/v1/users/5** and confirm the user is disabled.
2. Note the `WalletID` from the response.
3. Attempt to issue a voucher using that wallet:

   ```json
   {
     "walletId": <WalletID from step 2>,
     "productId": 1,
     "reference": "TASK2-DISABLED-001"
   }
   ```

4. Record the response status and body.
5. **Document your findings:**
   - Did the system allow voucher issuance for a disabled user?
   - What should happen instead?
   - What is the business risk if disabled users can issue vouchers?

#### Test C - Invalid Data Types

| # | Request Body | What to Record |
|:--|:---|:---|
| 1 | `{ "walletId": "abc", "productId": 1, "reference": "TEST" }` | Status and error message |
| 2 | `{ "walletId": null, "productId": null, "reference": null }` | Status and error message |
| 3 | `{ "walletId": -1, "productId": -1, "reference": "TEST" }` | Status and error message |

---

## Task 3 - Database Audit (White-Box Testing)

In this section you will write and execute SQL queries against the KoboFintech database to audit data integrity, financial consistency, and data quality.

Open a new query file in VS Code. Make sure you are connected to the **KoboFintech** database (check the status bar at the bottom of the VS Code window).

### 3.1 - Financial Reconciliation

This query compares each wallet's stored balance against the sum of its transaction amounts.

```sql
SELECT
    w.WalletID,
    u.FullName,
    w.Balance AS StoredBalance,
    ISNULL(SUM(t.Amount), 0) AS TotalTransacted,
    w.Balance + ISNULL(SUM(t.Amount), 0) AS ImpliedOriginalBalance
FROM Wallets w
JOIN Users u ON w.UserID = u.UserID
LEFT JOIN TransactionLedger t ON w.WalletID = t.WalletID
GROUP BY w.WalletID, u.FullName, w.Balance
ORDER BY w.WalletID;
```

**Questions to answer:**
- Do the stored balances reconcile with the transaction history?
- Are there wallets where the implied original balance does not match the expected seed value?
- What could explain any discrepancies?

### 3.2 - Transaction Audit

This query checks for transactions that reference wallets or products that do not exist.

```sql
-- Orphaned wallet references
SELECT t.EntryID, t.WalletID, t.ProductID, t.ProcessingStatus
FROM TransactionLedger t
LEFT JOIN Wallets w ON t.WalletID = w.WalletID
WHERE w.WalletID IS NULL;

-- Orphaned product references
SELECT t.EntryID, t.WalletID, t.ProductID, t.ProcessingStatus
FROM TransactionLedger t
LEFT JOIN Products p ON t.ProductID = p.ProductID
WHERE p.ProductID IS NULL;
```

**Questions to answer:**
- Are there any orphaned records?
- What does this tell you about the referential integrity of the database?

### 3.3 - Data Hygiene

```sql
-- Check for duplicate MSISDN values
SELECT MSISDN, COUNT(*) AS Occurrences
FROM Users
GROUP BY MSISDN
HAVING COUNT(*) > 1;

-- Check for users without wallets
SELECT u.UserID, u.FullName
FROM Users u
LEFT JOIN Wallets w ON u.UserID = w.UserID
WHERE w.WalletID IS NULL;

-- Check for wallets without owners
SELECT w.WalletID, w.Balance
FROM Wallets w
LEFT JOIN Users u ON w.UserID = u.UserID
WHERE u.UserID IS NULL;
```

**Questions to answer:**
- Are there any duplicate phone numbers?
- Are there any users without wallets, or wallets without users?
- What risks would these data issues pose in a production system?

### 3.4 - Revenue Analysis

```sql
SELECT
    p.Description AS Product,
    p.FaceValue,
    COUNT(t.EntryID) AS TimesIssued,
    SUM(t.Amount) AS TotalRevenue
FROM Products p
LEFT JOIN TransactionLedger t ON p.ProductID = t.ProductID
GROUP BY p.Description, p.FaceValue
ORDER BY TotalRevenue DESC;
```

**Questions to answer:**
- Which product generates the most revenue?
- Are transaction amounts consistent with product face values?
- If not, what does this indicate about data integrity?

---

## Task 4 - Defect Identification and Risk Assessment

In this section you will examine the stored procedure and API code to identify defects, then assess their impact on the business.

### 4.1 - Stored Procedure Review

Open `Database/Database.sql` and locate the `usp_IssueDigitalVoucher` stored procedure near the bottom of the file. Read through it carefully and answer the following questions.

**Questions to consider:**

1. **Balance validation** - Does the procedure check whether the wallet has enough funds before deducting? What happens if the balance is insufficient?

2. **User status check** - Does the procedure verify whether the user's `ServiceStatus` is `Active` before processing? What happens if a disabled user's wallet is used?

3. **Transaction safety** - Are the three operations (balance update, ledger insert, voucher insert) wrapped in a database transaction? What happens if the voucher insert fails after the balance has already been deducted?

4. **Data type choice** - The `Balance` and `FaceValue` columns use the `FLOAT` data type. Research why `FLOAT` is problematic for financial calculations. What data type should be used instead?

5. **Input validation** - Does the procedure check whether the provided `@WalletID` and `@ProductID` actually exist before using them?

### 4.2 - Defect Documentation

For each defect you identified in section 4.1, write a defect report using the template below. You should identify **at least three defects**.

```
Defect ID:         [QE-001]
Title:             [Short description of the defect]
Component:         [Stored Procedure / API / Database Schema]
Severity:          [Critical / High / Medium / Low]
Description:       [Detailed explanation of the defect]
Steps to Reproduce:
  1. [Step 1]
  2. [Step 2]
  3. [Step 3]
Expected Result:   [What should happen]
Actual Result:     [What actually happens]
Business Impact:   [How this affects the business or end users]
Recommended Fix:   [Brief description of how to fix the defect]
```

### 4.3 - Risk Assessment

Create a risk matrix for the defects you identified. For each defect, rate the **likelihood** (how likely it is to occur in production) and the **impact** (how severe the consequences are).

| Defect ID | Title | Likelihood | Impact | Risk Level |
|:---|:---|:---|:---|:---|
| QE-001 | _Example_ | High | Critical | **Critical** |
| QE-002 | | | | |
| QE-003 | | | | |

Use the following scale:

- **Likelihood**: Low, Medium, High
- **Impact**: Low, Medium, High, Critical
- **Risk Level**: Combine likelihood and impact (e.g., High likelihood + Critical impact = Critical risk)

### 4.4 - Impact Mapping

For each defect, describe the chain of impact from the technical fault to the business consequence. Use the format:

```
Technical Fault → System Behavior → User Impact → Business Consequence
```

**Example:**
```
No balance check in stored procedure
  → Wallet balance can go negative
    → Users receive products without paying
      → Direct financial loss for Kobo Fintech
```

Write an impact map for each of your identified defects.

---

## Completion Checklist

- [ ] All GET endpoints tested with valid and invalid inputs
- [ ] POST endpoint tested with valid data, missing fields, and invalid types
- [ ] Low-balance scenario tested and findings documented
- [ ] Disabled user scenario tested and findings documented
- [ ] Financial reconciliation query executed and analyzed
- [ ] Transaction audit query executed and analyzed
- [ ] Data hygiene queries executed and analyzed
- [ ] Revenue analysis query executed and analyzed
- [ ] Stored procedure reviewed for defects
- [ ] At least 3 defect reports written
- [ ] Risk matrix completed
- [ ] Impact maps written for each defect

---

<p align="center">
  <img src="https://img.shields.io/badge/Guides_Complete-Well_Done-green?style=for-the-badge" alt="Guides Complete" />
</p>

You have now completed all three guides. Return to the [main README](../README.md) for a project summary.
