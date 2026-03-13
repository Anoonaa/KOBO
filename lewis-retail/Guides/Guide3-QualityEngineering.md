# Guide 3 - Quality Engineering Exercises

<p align="center">
  <img src="https://img.shields.io/badge/Duration-60_min-blue?style=for-the-badge" alt="Duration: 60 min" />
  <img src="https://img.shields.io/badge/Focus-Testing_&_Auditing-purple?style=for-the-badge" alt="Focus: Testing & Auditing" />
</p>

---

## Objective

In this guide you will validate the Lewis Retail Engine API through functional testing, audit the database for integrity issues, and identify defects and risks in the system. The exercises are structured around the task areas that map directly to your assignment deliverables.

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

### 2.1 - Stock & Inventory Validation (15 Requests)

Use Swagger UI or Postman to test each scenario below. For every test, record the **HTTP status code** and a summary of the **response body**.

#### GET Inventory Endpoints

| # | Endpoint | Input | Expected Status | What to Verify |
|:--|:---|:---|:---|:---|
| 1 | `GET /api/v1/inventory` | None | `200` | Returns all inventory records with product details |
| 2 | `GET /api/v1/inventory/1` | `id = 1` | `200` | Returns inventory for a specific product |
| 3 | `GET /api/v1/inventory/9999` | `id = 9999` | `404` | Returns `Inventory record not found.` |
| 4 | `GET /api/v1/inventory/low-stock` | None (auth required) | `200` | Returns items below reorder level |

#### Stock Update Scenarios

| # | Scenario | Request Body | What to Verify |
|:--|:---|:---|:---|
| 5 | Valid stock increase | `{ "productId": 1, "storeId": 1, "quantityChange": 50, "reason": "Delivery" }` | Stock increases, audit log created |
| 6 | Valid stock decrease | `{ "productId": 1, "storeId": 1, "quantityChange": -5, "reason": "Damaged" }` | Stock decreases |
| 7 | Negative stock test | `{ "productId": 3, "storeId": 1, "quantityChange": -9999, "reason": "Test" }` | Does the system allow negative stock? |
| 8 | Missing fields | `{ "productId": 1 }` | Returns `400` validation error |
| 9 | Non-existent product | `{ "productId": 9999, "storeId": 1, "quantityChange": 10, "reason": "Test" }` | How does the system handle this? |

#### SKU Validation

| # | Scenario | What to Verify |
|:--|:---|:---|
| 10-15 | Query products with various valid/invalid SKUs | Verify the system correctly handles queries for SKUs that do not exist |

---

### 2.2 - Pricing & Revenue Integrity (20 Requests)

#### Price Calculation Tests

| # | Scenario | Parameters | What to Verify |
|:--|:---|:---|:---|
| 1 | Standard customer, single item | `productId=1, customerId=1, quantity=1` | Correct base price and VAT |
| 2 | Premium customer, single item | Use a Premium-tier customer | Verify tier discount applied |
| 3 | VIP customer, single item | Use a VIP-tier customer | Verify VIP discount applied |
| 4 | Bulk quantity | `quantity=100` | Verify bulk discount and rounding |
| 5 | Zero quantity | `quantity=0` | Does it allow R0.00 total? |
| 6 | Negative quantity | `quantity=-1` | Error handling |
| 7 | Non-existent product | `productId=9999` | Error handling |
| 8 | Missing parameters | Omit productId | Error handling |

#### VAT Verification

| # | Scenario | What to Verify |
|:--|:---|:---|
| 9 | List all VAT rates | Verify Standard (15%), Zero-rated (0%), Reduced (5%) |
| 10 | Verify VAT on high-value item | Calculate: is the VAT exactly 15% of the discounted price? |
| 11 | Verify bulk quantity rounding | Check for floating-point precision loss |

#### Revenue Leakage Tests

| # | Scenario | What to Verify |
|:--|:---|:---|
| 12-20 | Various edge cases with pricing | Can any combination produce a R0.00 or negative total amount? |

---

### 2.3 - Credit & Debt Governance (15 Requests)

#### Credit Account Validation

| # | Scenario | What to Verify |
|:--|:---|:---|
| 1 | List all credit accounts | Returns accounts with various statuses |
| 2 | Get specific credit account | Returns full credit details |
| 3 | Apply for credit | Valid application creates new account |
| 4 | Apply with zero limit | `{ "customerId": X, "requestedLimit": 0 }` |
| 5 | Apply with negative limit | `{ "customerId": X, "requestedLimit": -1000 }` |

#### Risk Validation Tests

| # | Scenario | What to Verify |
|:--|:---|:---|
| 6 | Order for customer with Expired credit | Does the system block the transaction? |
| 7 | Order for customer with Frozen credit | Does the system block the transaction? |
| 8 | Order for customer with zero credit limit | Does the system allow it? |
| 9 | Order for customer with Disabled account status | Does the system check AccountStatus? |
| 10-15 | Various combinations of credit status + order attempts | Document all cases where transactions succeed when they should fail |

---

## Task 3 - Database Audit (White-Box Testing)

Open a new query file in VS Code. Make sure you are connected to the **LewisRetail** database (check the status bar at the bottom of VS Code).

### 3.1 - Stock Reconciliation (15 Queries)

This query identifies stock mismatches between the Inventory table and Order records.

```sql
-- Stock mismatch: Inventory vs Orders
SELECT
    p.ProductID,
    p.SKU,
    p.Description,
    i.QuantityOnHand AS PhysicalStock,
    ISNULL(SUM(o.Quantity), 0) AS TotalSold,
    i.QuantityOnHand + ISNULL(SUM(o.Quantity), 0) AS ImpliedOriginalStock
FROM Products p
JOIN Inventory i ON p.ProductID = i.ProductID
LEFT JOIN Orders o ON p.ProductID = o.ProductID AND o.OrderStatus = 'Completed'
GROUP BY p.ProductID, p.SKU, p.Description, i.QuantityOnHand
ORDER BY p.ProductID;
```

**Questions to answer:**
- Does the `QuantityOnHand` reconcile with total orders processed?
- Are there products where inventory shows a different quantity than what the order history implies?
- Are there any negative stock values? What does this mean?

### 3.2 - Pricing Audit (15 Queries)

This query verifies VAT and discount rules across the most recent 1,000 sales.

```sql
-- Pricing verification: Orders vs VAT_Rates and PricingRules
SELECT TOP 1000
    o.OrderID,
    p.SKU,
    p.UnitPrice AS CataloguePrice,
    o.UnitPrice AS ChargedPrice,
    o.Quantity,
    o.DiscountAmount,
    o.VATAmount,
    o.TotalAmount,
    (o.UnitPrice * o.Quantity) - o.DiscountAmount + o.VATAmount AS CalculatedTotal,
    o.TotalAmount - ((o.UnitPrice * o.Quantity) - o.DiscountAmount + o.VATAmount) AS Discrepancy
FROM Orders o
JOIN Products p ON o.ProductID = p.ProductID
ORDER BY o.CreatedTimestamp DESC;
```

**Questions to answer:**
- Are there records where `TotalAmount` does not match the calculated total?
- What is the financial impact of the discrepancies across all records?
- Which data type is causing precision loss?

### 3.3 - Data Hygiene & Constraints (10 Queries)

```sql
-- Duplicate SKU codes
SELECT SKU, COUNT(*) AS Occurrences
FROM Products
GROUP BY SKU
HAVING COUNT(*) > 1;

-- Negative price values
SELECT ProductID, SKU, UnitPrice, CostPrice
FROM Products
WHERE UnitPrice < 0 OR CostPrice < 0;

-- Invalid customer phone formats
SELECT CustomerID, FullName, Phone
FROM Customers
WHERE LEN(Phone) < 10 OR LEN(Phone) > 12 OR Phone LIKE '%[^0-9]%';

-- Duplicate order references
SELECT OrderReference, COUNT(*) AS Occurrences
FROM Orders
GROUP BY OrderReference
HAVING COUNT(*) > 1;
```

**Questions to answer:**
- Are there any duplicate SKU codes?
- Are there products with negative or zero prices?
- Are there customers with invalid phone numbers?
- Are there duplicate order references?

### 3.4 - Business Intelligence Reporting (10 Queries)

```sql
-- Highest Revenue SKUs
SELECT
    p.SKU,
    p.Description,
    d.DepartmentName,
    COUNT(o.OrderID) AS TimesSold,
    SUM(o.TotalAmount) AS TotalRevenue
FROM Products p
JOIN Departments d ON p.DepartmentID = d.DepartmentID
LEFT JOIN Orders o ON p.ProductID = o.ProductID AND o.OrderStatus = 'Completed'
GROUP BY p.SKU, p.Description, d.DepartmentName
ORDER BY TotalRevenue DESC;

-- Slow-Moving Stock (fewest orders)
SELECT
    p.SKU,
    p.Description,
    i.QuantityOnHand,
    COUNT(o.OrderID) AS TimesOrdered
FROM Products p
JOIN Inventory i ON p.ProductID = i.ProductID
LEFT JOIN Orders o ON p.ProductID = o.ProductID
GROUP BY p.SKU, p.Description, i.QuantityOnHand
ORDER BY TimesOrdered ASC;
```

**Questions to answer:**
- Which product generates the most revenue?
- Which products are slow-moving and should be considered for clearance?
- What strategic recommendations would you give to retail buyers?

---

## Task 4 - Defect Identification and Risk Assessment

### 4.1 - Stored Procedure Review

Open `Database/LewisRetail.sql` and locate the `usp_ProcessSale` stored procedure near the bottom of the file. Read through it carefully and answer the following questions.

**Questions to consider:**

1. **Stock validation** - Does the procedure check whether sufficient inventory exists before processing the sale? What happens if there is no stock?

2. **Credit status check** - Does the procedure verify whether the customer's credit account status is `Active` before processing? What happens if a customer with `Expired` credit buys on account?

3. **Transaction safety** - Are the operations (inventory update, order insert) wrapped in a database transaction? What happens if the order insert fails after inventory has already been deducted?

4. **Data type choice** - The `UnitPrice`, `TotalAmount`, and related columns use the `FLOAT` data type. Research why `FLOAT` is problematic for financial calculations. What data type should be used instead?

5. **Input validation** - Does the procedure check whether the provided `@CustomerID`, `@ProductID`, and `@StoreID` actually exist before using them?

### 4.2 - Defect Documentation

For each defect you identified in section 4.1, write a defect report using the template below. You should identify **at least three defects**. See [DEFECTS-EXAMPLE.md](../DEFECTS-EXAMPLE.md) for an example.

```
Defect ID:         [DEF-001]
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
Business Impact:   [How this affects the business, revenue, or legal compliance]
Recommended Fix:   [Brief description of how to fix the defect]
```

### 4.3 - Risk Assessment

Create a risk matrix for the defects you identified. For each defect, rate the **likelihood** and the **impact**.

| Defect ID | Title | Likelihood | Impact | Risk Level |
|:---|:---|:---|:---|:---|
| DEF-001 | _Example_ | High | Critical | **Critical** |
| DEF-002 | | | | |
| DEF-003 | | | | |

### 4.4 - Impact Mapping

For each defect, describe the chain of impact:

```
Technical Fault → System Behavior → User Impact → Business Consequence
```

**Example:**
```
No stock validation before sale
  → Inventory quantity goes negative
    → Orders placed for non-existent stock
      → Fulfilment failures, refunds, and CPA violations
```

---

## Completion Checklist

- [ ] Stock & Inventory — 15 requests tested and documented
- [ ] Pricing & Revenue — 20 requests tested, VAT verified, revenue leakage checked
- [ ] Credit & Debt — 15 requests tested, expired/frozen/zero-limit scenarios documented
- [ ] Stock reconciliation queries executed and analyzed
- [ ] Pricing audit queries executed (1,000+ records verified)
- [ ] Data hygiene queries executed (duplicates, negatives, invalid formats)
- [ ] BI reports generated (highest revenue, slow-moving stock)
- [ ] Stored procedure reviewed for defects
- [ ] At least 10 defect reports written
- [ ] Risk matrix completed
- [ ] Impact maps written for each defect

---

<p align="center">
  <img src="https://img.shields.io/badge/Guides_Complete-Well_Done-green?style=for-the-badge" alt="Guides Complete" />
</p>

You have now completed all three guides. Return to the [main README](../README.md) for a project summary.
