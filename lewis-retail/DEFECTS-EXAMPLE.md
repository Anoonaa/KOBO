<p align="center">
  <img src="https://img.shields.io/badge/LEWIS_RETAIL-Defect_Report-DC143C?style=for-the-badge&labelColor=8B0000" alt="Lewis Retail Defect Report" />
</p>

<h1 align="center">Defect Report Example</h1>

<p align="center">
  <em>An example defect report for the Lewis Retail Engine Platform</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Defects-1-red?style=flat-square" alt="1 Defect" />
  <img src="https://img.shields.io/badge/Severity-High-FF8C00?style=flat-square" alt="High" />
  <img src="https://img.shields.io/badge/Status-Open-red?style=flat-square" alt="Open" />
</p>

---

## Defect Summary

| Field | Detail |
|:---|:---|
| **Defect ID** | DEF‑001 |
| **Title** | Negative Stock Quantities Allowed in Inventory Table |
| **Component** | Database Schema · `Inventory` table |
| **Severity** | ![High](https://img.shields.io/badge/-High-FF8C00?style=flat-square) |
| **Status** | ![Open](https://img.shields.io/badge/-Open-red?style=flat-square) |
| **Reported** | 2026-03-02 |
| **Environment** | `localhost:3000` · LewisRetail DB |

---

## Description

The `Inventory` table allows `QuantityOnHand` to contain **negative values**. When the `POST /api/v1/stock/update` endpoint processes a stock reduction, there is no constraint or validation preventing the quantity from dropping below zero. Additionally, the `usp_ProcessSale` stored procedure deducts stock without first checking whether sufficient inventory exists, meaning a sale can be processed for items that are out of stock.

---

## Steps to Reproduce

1. Open Swagger UI at `http://localhost:3000/api-docs`.
2. Execute `GET /api/v1/inventory` and note a product with low `QuantityOnHand` (e.g., 2 units).
3. Execute `POST /api/v1/orders` with a `quantity` of 10 for that product.
4. Execute `GET /api/v1/inventory` again and observe the `QuantityOnHand` has gone negative.

---

## Expected vs Actual

<table>
<tr>
<td width="50%" valign="top">

### ✅ Expected

The system should **reject orders** when `QuantityOnHand` would drop below zero. A `CHECK` constraint (`QuantityOnHand >= 0`) should prevent negative stock at the database level, and the API should validate available stock before processing the sale.

</td>
<td width="50%" valign="top">

### ❌ Actual

The order is processed successfully, inventory goes negative, and no error or warning is returned. The customer receives a confirmation for items that may not physically exist in the store.

</td>
</tr>
</table>

---

## Evidence

**Sample inventory record after over-selling:**

```json
{
  "InventoryID": 3,
  "ProductID": 3,
  "QuantityOnHand": -8,
  "QuantityReserved": 0,
  "ReorderLevel": 10,
  "SKU": "LEW-HP499",
  "Description": "Headphones Wireless BT"
}
```

<p align="center">
  <img src="https://img.shields.io/badge/QuantityOnHand--8-red?style=for-the-badge" alt="Negative Stock" />
  <img src="https://img.shields.io/badge/No_Constraint-No_Validation-orange?style=for-the-badge" alt="No Validation" />
</p>

> QuantityOnHand is -8, meaning 8 more units were sold than physically available — this is a critical stock integrity failure.

---

## Business Impact

| Dimension | Detail |
|:---|:---|
| **Customer Experience** | Customers receive order confirmations for items that cannot be fulfilled, leading to delayed deliveries and complaints |
| **Financial** | Revenue is recorded for items that may need to be refunded, creating accounting discrepancies |
| **Legal** | Selling goods that do not exist may violate the Consumer Protection Act (CPA) and National Credit Regulations |
| **Operational** | Store staff cannot trust inventory counts, leading to manual stock checks and lost productivity |

---

## Impact Chain

```
No stock validation before sale
  → Inventory quantity goes negative
    → Orders placed for non-existent stock
      → Fulfilment failures and customer refunds
        → Revenue loss and reputational damage
```

---

## Risk Assessment

| Likelihood | Impact | Risk Level |
|:---:|:---:|:---:|
| ![High](https://img.shields.io/badge/-High-FF4500?style=flat-square) | ![Critical](https://img.shields.io/badge/-Critical-DC143C?style=flat-square) | ![Critical](https://img.shields.io/badge/-●_Critical-DC143C?style=flat-square) |

> **Likelihood is High** because every sale transaction interacts with inventory, and no safeguard exists to prevent over-selling.

---

## Recommended Fix

Add a `CHECK` constraint and pre-sale validation:

```sql
-- Option A: Add a CHECK constraint to prevent negative stock
ALTER TABLE Inventory ADD CONSTRAINT CK_Inventory_NonNegative
CHECK (QuantityOnHand >= 0);
```

```sql
-- Option B: Add stock validation to the stored procedure
IF (SELECT QuantityOnHand FROM Inventory WHERE ProductID = @ProductID) < @Quantity
BEGIN
    RAISERROR('Insufficient stock for this product.', 16, 1);
    RETURN;
END
```

---

<p align="center">
  <img src="https://img.shields.io/badge/Report_Status-Complete-green?style=for-the-badge" alt="Complete" />
</p>

<p align="center">
  <em>This is an example defect report prepared as part of the Lewis Retail Engine Quality Engineering project.</em>
</p>
