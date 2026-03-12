# Guide 2 - API Setup and Exploration

<p align="center">
  <img src="https://img.shields.io/badge/Duration-30_min-blue?style=for-the-badge" alt="Duration: 30 min" />
  <img src="https://img.shields.io/badge/Tool-Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Tool: Node.js" />
  <img src="https://img.shields.io/badge/Tool-Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black" alt="Tool: Swagger" />
</p>

---

## Objective

In this guide you will explore all available API endpoints using the built-in Swagger documentation interface and verify that the Kabu Retail API is working correctly.

---

## Prerequisites

| Requirement | Details |
|:---|:---|
| **Guide 1 Completed** | The API server must be running and `kabu.db` must be populated |
| **Node.js** | Version 18 or later |
| **VS Code** | Visual Studio Code with a terminal |

> **Important** — If the server is not still running from Guide 1, navigate to `KABU/API` in a terminal and run `node server.js` before continuing.

---

## Part A - Open the Swagger Documentation

The API includes an interactive documentation interface powered by Swagger UI.

1. Open your web browser (Chrome, Edge, or Firefox).
2. In the address bar, type the following URL and press **Enter**:

   ```
   http://localhost:3000/api-docs
   ```

3. You should see the **Kabu Retail — Store & Loyalty Management API** documentation page with all endpoint groups listed.

---

## Part B - Authenticate with a JWT Token

Most endpoints require a valid JWT token. You will obtain one by logging in first.

### B.1 - Login as Admin

1. **Left-click** on **POST /api/v1/auth/login** to expand it.
2. **Left-click** the **Try it out** button.
3. Replace the request body with:

   ```json
   {
     "email": "naledi@kabu.co.za",
     "password": "Password123"
   }
   ```

4. **Left-click** **Execute**.
5. Copy the `token` value from the response body.

### B.2 - Authorise Swagger UI

1. **Left-click** the **Authorize** button (🔒 icon, top-right of the Swagger UI page).
2. In the **Value** field, paste your token.
3. **Left-click** **Authorize**, then **Left-click** **Close**.

> You are now authenticated. All protected endpoints will include your token automatically.

---

## Part C - Explore the Endpoints

Work through each endpoint below. For each one, **left-click** on the endpoint row to expand it, then **left-click** the **Try it out** button, fill in any required parameters, and **left-click** **Execute**.

### C.1 - List All Customers

| Field | Value |
|:---|:---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/customers` |
| **Parameters** | None |

1. Expand **GET /api/v1/customers**.
2. **Left-click** **Try it out**, then **Execute**.
3. Verify the response body contains 55 customer records.

### C.2 - Get a Single Customer

| Field | Value |
|:---|:---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/customers/{id}` |
| **Parameters** | `id` = `1` |

1. Expand **GET /api/v1/customers/{id}**.
2. **Left-click** **Try it out**.
3. In the `id` field, type `1`.
4. **Left-click** **Execute**.
5. Verify the response contains customer details including loyalty account information.

### C.3 - List All Products

| Field | Value |
|:---|:---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/products` |
| **Parameters** | None |

1. Expand **GET /api/v1/products**, **Try it out**, then **Execute**.
2. Verify you see 12 products across 5 suppliers (TechNova, FreshHarvest, StyleHub, HomeCraft, GlowUp).

### C.4 - Get a Loyalty Account

| Field | Value |
|:---|:---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/accounts/{id}` |
| **Parameters** | `id` = `1` |

1. Expand **GET /api/v1/accounts/{id}**.
2. **Left-click** **Try it out**, type `1`, then **Execute**.
3. Verify the response contains the account balance and owner details.

### C.5 - List Orders

| Field | Value |
|:---|:---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/orders` |
| **Parameters** | `accountId` = `1` (optional) |

1. Expand **GET /api/v1/orders**.
2. **Left-click** **Try it out**.
3. In the `accountId` field, type `1`.
4. **Left-click** **Execute**.
5. Verify orders filtered to AccountID 1 are returned.

### C.6 - Process a Sale

| Field | Value |
|:---|:---|
| **Method** | `POST` |
| **Endpoint** | `/api/v1/sales/process` |
| **Body** | See below |

1. Expand **POST /api/v1/sales/process**.
2. **Left-click** **Try it out**.
3. Replace the request body with:

   ```json
   {
     "accountId": 1,
     "productId": 4,
     "reference": "GUIDE2-TEST-001"
   }
   ```

   *(ProductID 4 = Bread at R20.00 — cheapest product)*

4. **Left-click** **Execute**.
5. Verify the response has status `201` and includes a `receiptCode` and `status: "SUCCESS"`.
6. Note the account balance before and after by using **GET /api/v1/accounts/1**. Confirm the balance decreased by R20.00 (the full unit price of Bread — the `DiscountAmount` is tracked separately but the full `UnitPrice` is deducted from `PointsBalance`).

1. Expand **GET /api/v1/receipts**.
2. **Left-click** **Try it out**, then **Execute**.
3. In the response, look for a receipt whose `OrderID` matches the `orderId` from step C.6.

---

## Part D - Test Error Handling

### D.1 - Request a Non-Existent Customer

1. Expand **GET /api/v1/customers/{id}**.
2. **Left-click** **Try it out**.
3. In the `id` field, type `9999`.
4. **Left-click** **Execute**.
5. Verify the response returns status `404` with message `Customer does not exist.`

### D.2 - Process a Sale with Missing Fields

1. Expand **POST /api/v1/sales/process**.
2. **Left-click** **Try it out**.
3. Replace the request body with:

   ```json
   {
     "accountId": 1
   }
   ```

4. **Left-click** **Execute**.
5. Verify the response returns status `400` with message `accountId, productId, and reference are required.`

---

## Part E - Explore Protected Endpoints

### E.1 - List All Stores (requires token)

1. Expand **GET /api/v1/stores**.
2. **Left-click** **Try it out**, then **Execute**.
3. Verify you receive 22 store records with manager and account details.

### E.2 - View the Admin Ledger

1. Expand **GET /api/v1/admin/ledger**.
2. **Left-click** **Try it out**, then **Execute**.
3. Verify the full sales ledger is returned with customer and product details.

---

## Completion Checklist

- [ ] API server started and showing `Kabu Retail Gateway: Port 3000`
- [ ] Swagger UI accessible at `http://localhost:3000/api-docs`
- [ ] Logged in and obtained JWT token
- [ ] Swagger UI authorised with token
- [ ] `GET /api/v1/customers` returned 55 records
- [ ] `GET /api/v1/products` returned 12 products
- [ ] `GET /api/v1/accounts/1` returned account balance
- [ ] `POST /api/v1/sales/process` — sale processed and receipt code returned
- [ ] Receipt verified in `GET /api/v1/receipts`
- [ ] Error handling tested (404 and 400 responses)

---

<p align="center">
  <img src="https://img.shields.io/badge/Next-Guide_3:_Quality_Engineering-blue?style=for-the-badge" alt="Next: Guide 3" />
</p>

Proceed to [Guide 3 - Quality Engineering Exercises](Guide3-QualityEngineering.md).
