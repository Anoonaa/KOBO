# Guide 3 - Quality Engineering Exercises

<p align="center">
  <img src="https://img.shields.io/badge/Duration-60_min-blue?style=for-the-badge" alt="Duration: 60 min" />
  <img src="https://img.shields.io/badge/Focus-Testing_&_Auditing-purple?style=for-the-badge" alt="Focus: Testing & Auditing" />
</p>

---

## Objective

In this guide you will validate the Kabu Retail API through functional testing, audit the database for integrity issues, and identify defects and risks in the system. The exercises are structured around three task areas that map directly to your assignment deliverables.

---

## Prerequisites

| Requirement | Details |
|:---|:---|
| **Guide 1 Completed** | Database is set up and populated |
| **Guide 2 Completed** | API is running on `http://localhost:3000` |
| **Swagger UI** | Open at `http://localhost:3000/api-docs` |
| **DB Browser for SQLite** | Open with `kabu.db` loaded |

---

## Task 2 - API Functional Validation

In this section you will test each API endpoint to verify it behaves correctly under normal conditions, edge cases, and error scenarios.

### 2.1 - Standard Validation

Use Swagger UI to test each endpoint below. For every test, record the **HTTP status code** and a summary of the **response body**.

#### GET Endpoints

| # | Endpoint | Input | Expected Status | What to Verify |
|:--|:---|:---|:---|:---|
| 1 | `GET /api/v1/customers` | None | `200` | Returns 55 customer records |
| 2 | `GET /api/v1/customers/1` | `id = 1` | `200` | Returns customer with loyalty account |
| 3 | `GET /api/v1/customers/9999` | `id = 9999` | `404` | Returns `Customer does not exist.` |
| 4 | `GET /api/v1/products` | None | `200` | Returns 12 products |
| 5 | `GET /api/v1/accounts/1` | `id = 1` | `200` | Returns account balance and owner |
| 6 | `GET /api/v1/accounts/9999` | `id = 9999` | `404` | Returns `Loyalty account does not exist.` |
| 7 | `GET /api/v1/orders` | None | `200` | Returns all orders |
| 8 | `GET /api/v1/orders?accountId=1` | `accountId = 1` | `200` | Returns orders for Account 1 only |
| 9 | `GET /api/v1/receipts` | None | `200` | Returns all receipts |

**Instructions:**

1. **Left-click** on the endpoint row in Swagger UI to expand it.
2. **Left-click** the **Try it out** button.
3. Enter any required parameters.
4. **Left-click** **Execute**.
5. Record the status code and response in a table for your submission.

#### POST Endpoint - Successful Sale

1. Expand **POST /api/v1/sales/process**.
2. **Left-click** **Try it out**.
3. Enter the following request body:

   ```json
   {
     "accountId": 1,
     "productId": 4,
     "reference": "TASK2-VALID-001"
   }
   ```

4. **Left-click** **Execute**.
5. Confirm the response has status `201` and includes a `receiptCode` and `status: "SUCCESS"`.
6. Note the account balance before and after by using **GET /api/v1/accounts/1**. Confirm the balance decreased by R20.00 (price of Bread).

#### POST Endpoint - Missing Fields

Test each of the following request bodies. Record the status code and error message for each.

| # | Request Body | Expected Status |
|:--|:---|:---|
| 1 | `{}` | `400` |
| 2 | `{ "accountId": 1 }` | `400` |
| 3 | `{ "productId": 4, "reference": "TEST" }` | `400` |
| 4 | `{ "accountId": 1, "productId": 4 }` | `400` |

---

### 2.2 - Business Logic Testing

These tests check whether the API enforces the financial and operational rules expected of a retail system.

#### Test A - Low-Balance Account

Account 10 (CustomerID 10) has been seeded with a balance of only **R5.00**. The cheapest product (Bread) costs R20.00.

1. Confirm the balance by calling **GET /api/v1/accounts/10**. Record the balance.
2. Attempt to process a sale:

   ```json
   {
     "accountId": 10,
     "productId": 4,
     "reference": "TASK2-LOWBAL-001"
   }
   ```

3. **Left-click** **Execute**.
4. Record the response status and body.
5. Call **GET /api/v1/accounts/10** again. Record the new balance.
   > **Note**: The system deducts the full `UnitPrice` (R20.00) regardless of discount tier. Check whether the deduction occurred even when the balance was insufficient.
6. **Document your findings:**
   - Did the system allow the sale?
   - Did the account balance go negative?
   - Is this acceptable behaviour for a retail system? Why or why not?

#### Test B - Disabled Customer

Customers 5, 18, and 33 have `AccountStatus = 'Disabled'`.

1. Call **GET /api/v1/customers/5** and confirm the customer is disabled.
2. Note the `AccountID` from the response.
3. Attempt to process a sale using that account:

   ```json
   {
     "accountId": <AccountID from step 2>,
     "productId": 4,
     "reference": "TASK2-DISABLED-001"
   }
   ```

4. Record the response status and body.
5. **Document your findings:**
   - Did the system allow a sale for a disabled customer?
   - What should happen instead?
   - What is the business risk if disabled customers can process sales?

#### Test C - Invalid Data Types

| # | Request Body | What to Record |
|:--|:---|:---|
| 1 | `{ "accountId": "abc", "productId": 4, "reference": "TEST" }` | Status and error message |
| 2 | `{ "accountId": null, "productId": null, "reference": null }` | Status and error message |
| 3 | `{ "accountId": -1, "productId": -1, "reference": "TEST" }` | Status and error message |

---

## Task 3 - Database Audit (White-Box Testing)

In this section you will write and execute SQL queries against the Kabu database to audit data integrity, financial consistency, and data quality.

Open **DB Browser for SQLite**, load `KABU/API/kabu.db`, and go to the **Execute SQL** tab.

### 3.1 - Financial Reconciliation

This query compares each loyalty account's stored balance against the sum of its order amounts.

```sql
SELECT
    la.AccountID,
    c.FullName,
    la.PointsBalance AS StoredBalance,
    COALESCE(SUM(so.TotalAmount), 0) AS TotalOrdered,
    la.PointsBalance + COALESCE(SUM(so.TotalAmount), 0) AS ImpliedOriginalBalance
FROM LoyaltyAccounts la
JOIN Customers c ON la.CustomerID = c.CustomerID
LEFT JOIN SalesOrders so ON la.AccountID = so.AccountID
GROUP BY la.AccountID, c.FullName, la.PointsBalance
ORDER BY la.AccountID;
```

**Questions to answer:**
- Do the stored balances reconcile with the order history?
- Are there accounts where the implied original balance does not match the expected seed value?
- What could explain any discrepancies?

### 3.2 - Order Audit

This query checks for orders that reference accounts or products that do not exist.

```sql
-- Orphaned account references
SELECT so.OrderID, so.AccountID, so.ProductID, so.OrderStatus
FROM SalesOrders so
LEFT JOIN LoyaltyAccounts la ON so.AccountID = la.AccountID
WHERE la.AccountID IS NULL;

-- Orphaned product references
SELECT so.OrderID, so.AccountID, so.ProductID, so.OrderStatus
FROM SalesOrders so
LEFT JOIN Products p ON so.ProductID = p.ProductID
WHERE p.ProductID IS NULL;
```

**Questions to answer:**
- Are there any orphaned records?
- What does this tell you about the referential integrity of the database?

### 3.3 - Data Hygiene

```sql
-- Check for duplicate phone numbers
SELECT PhoneNumber, COUNT(*) AS Occurrences
FROM Customers
GROUP BY PhoneNumber
HAVING COUNT(*) > 1;

-- Check for customers without loyalty accounts
SELECT c.CustomerID, c.FullName
FROM Customers c
LEFT JOIN LoyaltyAccounts la ON c.CustomerID = la.CustomerID
WHERE la.AccountID IS NULL;

-- Check for loyalty accounts without owners
SELECT la.AccountID, la.PointsBalance
FROM LoyaltyAccounts la
LEFT JOIN Customers c ON la.CustomerID = c.CustomerID
WHERE c.CustomerID IS NULL;

-- Check for negative balances
SELECT la.AccountID, la.PointsBalance, c.FullName
FROM LoyaltyAccounts la
JOIN Customers c ON la.CustomerID = c.CustomerID
WHERE la.PointsBalance < 0;
```

**Questions to answer:**
- Are there any duplicate phone numbers?
- Are there any customers without loyalty accounts, or accounts without customers?
- What risks do negative balances pose in a production system?

### 3.4 - Revenue Analysis

```sql
SELECT
    p.ProductName AS Product,
    p.UnitPrice,
    COUNT(so.OrderID) AS TimesOrdered,
    SUM(so.TotalAmount) AS TotalRevenue,
    SUM(so.DiscountAmount) AS TotalDiscounts
FROM Products p
LEFT JOIN SalesOrders so ON p.ProductID = so.ProductID
GROUP BY p.ProductName, p.UnitPrice
ORDER BY TotalRevenue DESC;
```

**Questions to answer:**
- Which product generates the most revenue?
- Are order amounts consistent with product prices?
- If not, what does this indicate about data integrity?

### 3.5 - Ghost Order Analysis

```sql
-- Orders with no matching receipt (ghost orders)
SELECT so.OrderID, so.AccountID, so.ProductID, so.TotalAmount, so.OrderStatus
FROM SalesOrders so
LEFT JOIN Receipts r ON so.OrderID = r.OrderID
WHERE r.ReceiptID IS NULL
  AND so.OrderStatus = 'Completed'
ORDER BY so.CreatedAt;
```

**Questions to answer:**
- How many completed orders have no matching receipt?
- What is the financial risk of ghost orders in a retail system?
- If a customer's account was debited but no receipt was issued, what recourse do they have?

---

## Task 4 - Defect Identification and Risk Assessment

In this section you will examine the sale processing code and API to identify defects, then assess their impact on the business.

### 4.1 - Sale Processing Code Review

Open `KABU/API/server.js` and locate the `processSale` function near the top of the file. Read through it carefully and answer the following questions.

**Questions to consider:**

1. **Balance validation** — Does the function check whether the account has enough points before deducting? What happens if the balance is insufficient?

2. **Customer status check** — Does the function verify whether the customer's `AccountStatus` is `Active` before processing? What happens if a disabled customer's account is used?

3. **Transaction safety** — Are the three operations (balance update, order insert, receipt insert) wrapped in a database transaction? What happens if the receipt insert fails after the balance has already been deducted?

4. **Data type choice** — The `PointsBalance` and `UnitPrice` columns use the `REAL` data type. Research why floating-point types are problematic for financial calculations. What data type should be used instead?

5. **Input validation** — Does the function check whether the provided `accountId` and `productId` actually exist before using them?

### 4.2 - Defect Documentation

For each defect you identified in section 4.1, write a defect report using the template below. You should identify **at least three defects**.

```
Defect ID:         [QE-001]
Title:             [Short description of the defect]
Component:         [Sale Processing / API / Database Schema]
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
Technical Fault → System Behaviour → Customer Impact → Business Consequence
```

**Example:**
```
No balance check in processSale
  → Account balance can go negative
    → Customers receive products without sufficient points
      → Direct financial loss for Kabu Retail
```

Write an impact map for each of your identified defects.

---

## Completion Checklist

- [ ] All GET endpoints tested with valid and invalid inputs
- [ ] POST endpoint tested with valid data, missing fields, and invalid types
- [ ] Low-balance scenario tested and findings documented
- [ ] Disabled customer scenario tested and findings documented
- [ ] Financial reconciliation query executed and analysed
- [ ] Order audit query executed and analysed
- [ ] Data hygiene queries executed and analysed
- [ ] Revenue analysis query executed and analysed
- [ ] Ghost order analysis query executed and analysed
- [ ] `processSale` function reviewed for defects
- [ ] At least 3 defect reports written
- [ ] Risk matrix completed
- [ ] Impact maps written for each defect

---

<p align="center">
  <img src="https://img.shields.io/badge/Guides_Complete-Well_Done-green?style=for-the-badge" alt="Guides Complete" />
</p>

You have now completed all three guides. Return to the [main README](../README.md) for a project summary.
