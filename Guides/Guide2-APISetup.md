# Guide 2 -- API Setup and Exploration

<p align="center">
  <img src="https://img.shields.io/badge/Duration-30_min-blue?style=for-the-badge" alt="Duration: 30 min" />
  <img src="https://img.shields.io/badge/Tool-Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Tool: Node.js" />
  <img src="https://img.shields.io/badge/Tool-Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black" alt="Tool: Swagger" />
</p>

---

## Objective

In this guide you will install the project dependencies, start the Kobo Fintech API server, and explore all available endpoints using the built-in Swagger documentation interface.

---

## Prerequisites

| Requirement | Details |
|:---|:---|
| **Guide 1 Completed** | The KoboFintech database must be running and populated |
| **Node.js** | Version 18 or later -- download from [https://nodejs.org](https://nodejs.org) |
| **VS Code** | Visual Studio Code with a terminal |

> **Important** -- Verify Node.js is installed by opening a terminal and running `node --version`. You should see `v18.x.x` or higher.

---

## Part A -- Install Dependencies

1. Open **Visual Studio Code**.
2. Select **Terminal** from the top menu bar, then **left-click** **New Terminal**.
3. In the terminal, navigate to the API folder by typing the following command and pressing **Enter**:

   ```
   cd API
   ```

4. Install the project dependencies by typing the following command and pressing **Enter**:

   ```
   npm install
   ```

5. Wait for the installation to complete. You should see output ending with `added X packages`.

> **Note** -- If you see permission errors on Windows, try running VS Code as Administrator. **Right-click** the VS Code shortcut and select **Run as administrator**.

---

## Part B -- Start the API Server

1. In the same terminal (make sure you are still in the `API` folder), type the following command and press **Enter**:

   ```
   node server.js
   ```

2. You should see the following output:

   ```
   Kobo Services: Port 3000
   ```

3. The API is now running. **Do not close this terminal** -- the server needs to remain running for the rest of this guide.

> **Troubleshooting** -- If you see a connection error mentioning SQL Server, verify that:
> - SQL Server is running (check Windows Services)
> - TCP/IP is enabled (see Guide 1, Part C)
> - You ran `Setup.sql` and `Database.sql` successfully

---

## Part C -- Open the Swagger Documentation

The API includes an interactive documentation interface powered by Swagger UI.

1. Open your web browser (Chrome, Edge, or Firefox).
2. In the address bar, type the following URL and press **Enter**:

   ```
   http://localhost:3000/api-docs
   ```

3. You should see the **Kobo Fintech Distribution API** documentation page with a list of endpoints grouped by category.

---

## Part D -- Explore the Endpoints

Work through each endpoint below. For each one, **left-click** on the endpoint row to expand it, then **left-click** the **Try it out** button, fill in any required parameters, and **left-click** **Execute**.

### D.1 -- List All Users

| Field | Value |
|:---|:---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/users` |
| **Parameters** | None |

1. **Left-click** on **GET /api/v1/users** to expand it.
2. **Left-click** the **Try it out** button.
3. **Left-click** the **Execute** button.
4. Scroll down to the **Response body** section.
5. Verify you see a JSON response containing 50 user records.

### D.2 -- Get a Single User

| Field | Value |
|:---|:---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/users/{id}` |
| **Parameters** | `id` = `1` |

1. **Left-click** on **GET /api/v1/users/{id}** to expand it.
2. **Left-click** the **Try it out** button.
3. In the `id` field, type `1`.
4. **Left-click** the **Execute** button.
5. Verify the response contains user details including wallet information.

### D.3 -- List All Products

| Field | Value |
|:---|:---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/products` |
| **Parameters** | None |

1. **Left-click** on **GET /api/v1/products** to expand it.
2. **Left-click** the **Try it out** button.
3. **Left-click** the **Execute** button.
4. Verify you see 3 products: MTN R10 Airtime, Vodacom R20 Airtime, and Eskom R100 Electricity.

### D.4 -- Get a Wallet

| Field | Value |
|:---|:---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/wallets/{id}` |
| **Parameters** | `id` = `1` |

1. **Left-click** on **GET /api/v1/wallets/{id}** to expand it.
2. **Left-click** the **Try it out** button.
3. In the `id` field, type `1`.
4. **Left-click** the **Execute** button.
5. Verify the response contains wallet balance and owner details.

### D.5 -- List Transactions

| Field | Value |
|:---|:---|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/transactions` |
| **Parameters** | `walletId` = `1` (optional) |

1. **Left-click** on **GET /api/v1/transactions** to expand it.
2. **Left-click** the **Try it out** button.
3. In the `walletId` field, type `1`.
4. **Left-click** the **Execute** button.
5. Verify the response contains transaction records filtered to WalletID 1.

### D.6 -- Issue a Digital Voucher

| Field | Value |
|:---|:---|
| **Method** | `POST` |
| **Endpoint** | `/api/v1/distribution/issue-voucher` |
| **Body** | See below |

1. **Left-click** on **POST /api/v1/distribution/issue-voucher** to expand it.
2. **Left-click** the **Try it out** button.
3. In the request body editor, replace the existing JSON with:

   ```json
   {
     "walletId": 1,
     "productId": 1,
     "reference": "GUIDE2-TEST-001"
   }
   ```

4. **Left-click** the **Execute** button.
5. Verify the response has status `201` and includes a `pin` value and `status: "SUCCESS"`.

### D.7 -- Verify the Voucher Was Created

1. Go back to the **GET /api/v1/vouchers** endpoint.
2. **Left-click** to expand it, then **left-click** **Try it out**, then **left-click** **Execute**.
3. In the response, look for a voucher with `ExternalReference: "GUIDE2-TEST-001"`.

---

## Part E -- Test Error Handling

### E.1 -- Request a Non-Existent User

1. Expand **GET /api/v1/users/{id}**.
2. **Left-click** **Try it out**.
3. In the `id` field, type `9999`.
4. **Left-click** **Execute**.
5. Verify the response returns status `404` with the message `User does not exist.`

### E.2 -- Issue a Voucher with Missing Fields

1. Expand **POST /api/v1/distribution/issue-voucher**.
2. **Left-click** **Try it out**.
3. Replace the request body with:

   ```json
   {
     "walletId": 1
   }
   ```

4. **Left-click** **Execute**.
5. Verify the response returns status `400` with the message `walletId, productId, and reference are required.`

---

## Completion Checklist

- [ ] Dependencies installed with `npm install`
- [ ] API server started and showing `Kobo Services: Port 3000`
- [ ] Swagger UI accessible at `http://localhost:3000/api-docs`
- [ ] All 6 GET endpoints tested and returning data
- [ ] POST endpoint tested -- voucher issued successfully
- [ ] Voucher verified in the vouchers list
- [ ] Error handling tested (404 and 400 responses)

---

<p align="center">
  <img src="https://img.shields.io/badge/Next-Guide_3:_Quality_Engineering-blue?style=for-the-badge" alt="Next: Guide 3" />
</p>

Proceed to [Guide 3 -- Quality Engineering Exercises](Guide3-QualityEngineering.md).
