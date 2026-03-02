# Lab 3 -- Quality Engineering Exercises

<p align="center">
  <img src="https://img.shields.io/badge/Difficulty-Intermediate-yellow?style=for-the-badge" alt="Difficulty: Intermediate" />
  <img src="https://img.shields.io/badge/Duration-60_min-blue?style=for-the-badge" alt="Duration: 60 min" />
  <img src="https://img.shields.io/badge/Focus-Testing-purple?style=for-the-badge" alt="Focus: Testing" />
</p>

---

## Objective

In this lab you will apply quality engineering practices to the Kobo Fintech system. You will design test cases, execute them against the running API, identify edge cases and boundary conditions, and document defects.

---

## Prerequisites

| Requirement | Details |
|:---|:---|
| **Lab 1 Completed** | Database is set up and populated |
| **Lab 2 Completed** | API is running on `http://localhost:3000` |
| **Browser** | Chrome, Edge, or Firefox with Swagger UI open |

---

## Part A -- Boundary Value Analysis

Boundary value analysis involves testing at the edges of valid input ranges. Use the Swagger UI or a tool such as Postman to execute the following test cases.

### A.1 -- User ID Boundaries

Open the Swagger UI at `http://localhost:3000/api-docs` and test the **GET /api/v1/users/{id}** endpoint with the following values. Record the HTTP status code and response for each.

| Test Case | Input `id` | Expected Status | Expected Behavior |
|:---|:---|:---|:---|
| Minimum valid ID | `1` | `200` | Returns user data |
| Maximum valid ID | `50` | `200` | Returns user data |
| Just below minimum | `0` | `404` | User does not exist |
| Just above maximum | `51` | `404` | User does not exist |
| Negative value | `-1` | `404` | User does not exist |
| Very large value | `999999` | `404` | User does not exist |

**Instructions:**

1. **Left-click** on **GET /api/v1/users/{id}** in Swagger UI.
2. **Left-click** **Try it out**.
3. Enter each `id` value from the table above, one at a time.
4. **Left-click** **Execute** after each entry.
5. Record the actual status code and response body.

### A.2 -- Wallet ID Boundaries

Repeat the same boundary testing for **GET /api/v1/wallets/{id}**:

| Test Case | Input `id` | Expected Status | Expected Behavior |
|:---|:---|:---|:---|
| Minimum valid ID | `1` | `200` | Returns wallet data |
| Maximum valid ID | `50` | `200` | Returns wallet data |
| Zero | `0` | `404` | Wallet does not exist |
| Negative value | `-1` | `404` | Wallet does not exist |

---

## Part B -- Equivalence Partitioning

Equivalence partitioning divides inputs into groups that should be treated the same way. Test one value from each partition.

### B.1 -- Transaction Filtering

Test the **GET /api/v1/transactions** endpoint with the `walletId` query parameter:

| Partition | Input `walletId` | Expected Behavior |
|:---|:---|:---|
| Valid wallet with transactions | `1` | Returns transactions for wallet 1 |
| Valid wallet (may have no transactions) | `50` | Returns transactions or empty array |
| No filter | _(leave empty)_ | Returns all transactions |
| Invalid wallet | `9999` | Returns empty array |

**Instructions:**

1. **Left-click** on **GET /api/v1/transactions** in Swagger UI.
2. **Left-click** **Try it out**.
3. Enter the `walletId` value.
4. **Left-click** **Execute**.
5. Examine the response and record the number of transactions returned.

---

## Part C -- Business Logic Testing

### C.1 -- Voucher Issuance with Sufficient Balance

1. First, check the balance of Wallet 1. Use **GET /api/v1/wallets/1** and note the current balance.
2. Issue a voucher using **POST /api/v1/distribution/issue-voucher** with:

   ```json
   {
     "walletId": 1,
     "productId": 1,
     "reference": "QE-TEST-SUFFICIENT"
   }
   ```

3. **Left-click** **Execute**.
4. Record the response status and pin.
5. Check the balance of Wallet 1 again. The balance should be reduced by R10.00 (the face value of Product 1).

### C.2 -- Voucher Issuance with Low Balance

Wallet 10 has been seeded with a balance of only R5.00.

1. Check the balance: Use **GET /api/v1/wallets/10**.
2. Attempt to issue a voucher for a R10 product:

   ```json
   {
     "walletId": 10,
     "productId": 1,
     "reference": "QE-TEST-LOWBALANCE"
   }
   ```

3. **Left-click** **Execute**.
4. Document what happens:
   - Does the API allow the transaction?
   - Does the wallet balance go negative?
   - Is this the expected behavior for a fintech application?

> <img src="https://img.shields.io/badge/!-Discussion_Point-orange?style=flat-square" alt="Discussion Point" /> This test case reveals whether the system has proper balance validation. If the balance goes negative, this is a potential defect that should be logged.

### C.3 -- Disabled User Testing

Users 5, 18, and 33 have a `ServiceStatus` of `Disabled`.

1. Use **GET /api/v1/users/5** to confirm the user is disabled.
2. Find the wallet for this user (check the `WalletID` in the response).
3. Attempt to issue a voucher using that wallet:

   ```json
   {
     "walletId": <WalletID from step 2>,
     "productId": 1,
     "reference": "QE-TEST-DISABLED"
   }
   ```

4. Document what happens:
   - Does the API allow voucher issuance for a disabled user?
   - Should it?

---

## Part D -- Input Validation Testing

### D.1 -- Missing Required Fields

Test **POST /api/v1/distribution/issue-voucher** with each of the following bodies:

| Test Case | Request Body | Expected Status |
|:---|:---|:---|
| Missing all fields | `{}` | `400` |
| Missing productId and reference | `{ "walletId": 1 }` | `400` |
| Missing walletId | `{ "productId": 1, "reference": "TEST" }` | `400` |
| All fields provided | `{ "walletId": 1, "productId": 1, "reference": "TEST" }` | `201` |

### D.2 -- Invalid Data Types

| Test Case | Request Body | Document the Response |
|:---|:---|:---|
| String as walletId | `{ "walletId": "abc", "productId": 1, "reference": "TEST" }` | Record status and error |
| Null values | `{ "walletId": null, "productId": null, "reference": null }` | Record status and error |
| Negative IDs | `{ "walletId": -1, "productId": -1, "reference": "TEST" }` | Record status and error |

---

## Part E -- Defect Reporting

Based on your testing in Parts A through D, identify at least **two potential defects** and document them using the template below.

### Defect Report Template

```
Defect ID:       [QE-001]
Title:           [Short description]
Severity:        [Critical / High / Medium / Low]
Steps to Reproduce:
  1. [Step 1]
  2. [Step 2]
  3. [Step 3]
Expected Result: [What should happen]
Actual Result:   [What actually happened]
Environment:     Windows / SQL Server / Node.js v18+
Evidence:        [Screenshot or response body]
```

---

## Completion Checklist

- [ ] Boundary value tests executed for Users endpoint
- [ ] Boundary value tests executed for Wallets endpoint
- [ ] Equivalence partitioning tests executed for Transactions endpoint
- [ ] Voucher issuance tested with sufficient balance
- [ ] Low-balance scenario tested and documented
- [ ] Disabled user scenario tested and documented
- [ ] Missing field validation tested (4 test cases)
- [ ] Invalid data type tests executed (3 test cases)
- [ ] At least 2 defect reports written using the template

---

<p align="center">
  <img src="https://img.shields.io/badge/Labs_Complete-Well_Done-green?style=for-the-badge" alt="Labs Complete" />
</p>

You have now completed all three practical labs. Return to the [main README](../README.md) for a summary of the project and additional resources.
