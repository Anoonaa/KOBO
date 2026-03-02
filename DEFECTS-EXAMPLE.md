<p align="center">
  <img src="https://img.shields.io/badge/KOBO_FINTECH-Defect_Report-DC143C?style=for-the-badge&labelColor=8B0000" alt="Kobo Fintech Defect Report" />
</p>

<h1 align="center">Defect Report Example</h1>

<p align="center">
  <em>An example defect report for the Kobo Fintech Digital Distribution Platform</em>
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
| **Title** | Expired Vouchers Included in Active Voucher Count on Dashboard |
| **Component** | API Layer · `GET /api/v1/vouchers` |
| **Severity** | ![High](https://img.shields.io/badge/-High-FF8C00?style=flat-square) |
| **Status** | ![Open](https://img.shields.io/badge/-Open-red?style=flat-square) |
| **Reported** | 2026-03-02 |
| **Environment** | `localhost:3000` · KoboFintech DB |

---

## Description

The `GET /api/v1/vouchers` endpoint returns **all voucher records** regardless of their expiry date. Vouchers with an `ExpiryDate` in the past are included alongside valid vouchers in the response. Any downstream system or dashboard that counts the total vouchers returned would display an **inflated number of active vouchers**, misrepresenting the true inventory of redeemable vouchers.

---

## Steps to Reproduce

1. Open Swagger UI at `http://localhost:3000/api-docs`.
2. Expand **GET /api/v1/vouchers** and click **Try it out**, then **Execute**.
3. In the response body, look at the `ExpiryDate` field on each voucher record.
4. Observe that vouchers with past expiry dates are still returned in the list alongside valid ones.

---

## Expected vs Actual

<table>
<tr>
<td width="50%" valign="top">

### ✅ Expected

The endpoint should **only return vouchers where `ExpiryDate` is in the future**, or at minimum include a status field (e.g. `"Active"` / `"Expired"`) so consumers can filter appropriately.

</td>
<td width="50%" valign="top">

### ❌ Actual

All vouchers are returned with no filtering or status indicator. An expired voucher from 6 months ago appears identically to one issued today.

</td>
</tr>
</table>

---

## Evidence

**Sample response from `GET /api/v1/vouchers` (truncated):**

```json
[
  {
    "VoucherID": 12,
    "PinData": "8374621950",
    "ExpiryDate": "2025-08-14T00:00:00.000Z",
    "EntryID": "c4a1e8b2-..."
  },
  {
    "VoucherID": 47,
    "PinData": "2918374650",
    "ExpiryDate": "2027-01-22T00:00:00.000Z",
    "EntryID": "f7d3b9a1-..."
  }
]
```

<p align="center">
  <img src="https://img.shields.io/badge/Voucher_12-Expired_(2025--08--14)-red?style=for-the-badge" alt="Expired" />
  <img src="https://img.shields.io/badge/Voucher_47-Valid_(2027--01--22)-green?style=for-the-badge" alt="Valid" />
  <img src="https://img.shields.io/badge/Both_Returned-No_Distinction-orange?style=for-the-badge" alt="No Distinction" />
</p>

> Voucher 12 expired on 2025-08-14 but is still returned in the active voucher list — this inflates the count and misleads any reporting built on this endpoint.

---

## Business Impact

| Dimension | Detail |
|:---|:---|
| **Reporting** | Dashboards overstate the number of redeemable vouchers, leading to incorrect business decisions |
| **Customer Experience** | A customer presented with an expired voucher PIN will experience a failed redemption |
| **Financial** | Overstated voucher liabilities on the balance sheet if expired vouchers are counted as outstanding obligations |

---

## Impact Chain

```
Expired vouchers not filtered from API response
  → Dashboard shows inflated active voucher count
    → Business overestimates outstanding voucher liability
      → Inaccurate financial reporting and poor decision-making
```

---

## Risk Assessment

| Likelihood | Impact | Risk Level |
|:---:|:---:|:---:|
| ![High](https://img.shields.io/badge/-High-FF4500?style=flat-square) | ![High](https://img.shields.io/badge/-High-FF8C00?style=flat-square) | ![High](https://img.shields.io/badge/-●_High-FF8C00?style=flat-square) |

> **Likelihood is High** because the endpoint is called every time voucher data is viewed, and expired records accumulate over time.

---

## Recommended Fix

Add a `WHERE` clause to filter by expiry date, or include a computed status field:

```sql
-- Option A: Filter expired vouchers from the default response
SELECT v.VoucherID, v.PinData, v.ExpiryDate, t.ExternalReference
FROM DigitalVouchers v
JOIN TransactionLedger t ON v.EntryID = t.EntryID
WHERE v.ExpiryDate >= GETDATE();
```

```sql
-- Option B: Add a computed status field so consumers can filter client-side
SELECT
    v.VoucherID,
    v.PinData,
    v.ExpiryDate,
    CASE WHEN v.ExpiryDate >= GETDATE() THEN 'Active' ELSE 'Expired' END AS VoucherStatus
FROM DigitalVouchers v;
```

---

<p align="center">
  <img src="https://img.shields.io/badge/Report_Status-Complete-green?style=for-the-badge" alt="Complete" />
</p>

<p align="center">
  <em>This is an example defect report prepared as part of the Kobo Fintech Quality Engineering project.</em>
</p>
