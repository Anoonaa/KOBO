<p align="center">
  <img src="https://img.shields.io/badge/KOBO-Business-0066CC?style=for-the-badge&labelColor=003366" alt="Kobo Business" />
</p>

<h1 align="center">Kobo Business: Merchant & Settlement Gateway</h1>

<p align="center">
  A hands-on Quality Engineering project built around a simulated fintech distribution platform.<br/>
  Students set up a database, launch a REST API with JWT authentication and RBAC, and execute<br/>
  structured QE test exercises including API validation, E2E automation, and SQL auditing.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 18+" />
  <img src="https://img.shields.io/badge/SQL_Server-2019+-CC2927?style=flat-square&logo=microsoftsqlserver&logoColor=white" alt="SQL Server 2019+" />
  <img src="https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white" alt="Express 4.x" />
  <img src="https://img.shields.io/badge/Swagger-OpenAPI_3.0-85EA2D?style=flat-square&logo=swagger&logoColor=black" alt="Swagger" />
  <img src="https://img.shields.io/badge/JWT-Auth-F7DF1E?style=flat-square" alt="JWT" />
  <img src="https://img.shields.io/badge/License-Educational-blue?style=flat-square" alt="Educational" />
</p>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start Guide](#quick-start-guide)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Default Credentials](#default-credentials)
- [Guides](#guides)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Overview

Kobo Business is a simulated fintech distribution platform designed for Quality Engineering coursework. The system models a real-world merchant gateway where users hold digital wallets, merchants manage businesses with tiered commission structures, and the platform issues digital vouchers with full settlement processing.

This project provides students with a production-grade backend system supporting:

- **JWT Authentication & RBAC** — Role-based access control (Admin, Merchant, User)
- **Merchant Lifecycle Management** — Registration → Activation → Suspension → Deactivation
- **Commission Engine** — Per-product, per-tier percentage-based commissions
- **Settlement Processing** — Automated merchant settlement calculation
- **5,000+ Transaction Records** — With intentional data quality defects for auditing
- **40+ API Endpoints** — Sufficient for 50+ Postman requests and Playwright automation
- **10 Intentional Defects** — Security, financial, and data integrity flaws for discovery

---

## Architecture

```
+---------------------+         +---------------------+         +---------------------+
|                     |         |                     |         |                     |
|   Swagger UI /      | ------> |   Express API       | ------> |   SQL Server        |
|   Postman / PW      |  HTTP   |   (Node.js + JWT)   |  TCP/IP |   (KoboFintech DB)  |
|                     |         |                     |         |                     |
+---------------------+         +---------------------+         +---------------------+
   Port 3000/api-docs              Port 3000                       Port 1433
```

| Layer | Technology | Purpose |
|:---|:---|:---|
| **Testing** | Swagger UI / Postman / Playwright | API documentation, manual testing, E2E automation |
| **Backend** | Node.js + Express + JWT + bcrypt | REST API with authentication and role-based access |
| **Database** | Microsoft SQL Server | 10 tables, stored procedures, 5,200+ seeded transactions |

---

## Prerequisites

| # | Software | Version | Download Link |
|:---:|:---|:---|:---|
| 1 | **Microsoft SQL Server** | 2019 or later (Developer or Express) | [Download](https://www.microsoft.com/en-us/sql-server/sql-server-downloads) |
| 2 | **Node.js** | v18.0.0 or later | [Download](https://nodejs.org) |
| 3 | **Visual Studio Code** | Latest | [Download](https://code.visualstudio.com) |

---

## Quick Start Guide

### Step 1 — One-Time SQL Server Configuration

1. Open **VS Code** and connect to SQL Server via the SQL Server extension.
2. Open `Database/Setup.sql` and execute it against the **master** database.
3. Enable **TCP/IP** in SQL Server Configuration Manager and restart SQL Server.

### Step 2 — Create the Database

1. Open `Database/Kobo.sql` in VS Code.
2. Execute it against the **master** database.
3. The script creates the `KoboFintech` database with 10 tables and 5,200+ transactions.

Verify:

```sql
USE KoboFintech;
SELECT COUNT(*) AS UserCount FROM Users;             -- Expected: 55
SELECT COUNT(*) AS TxnCount FROM TransactionLedger;  -- Expected: 5200
SELECT COUNT(*) AS MerchantCount FROM Merchants;     -- Expected: 22
```

### Step 3 — Start the API

```bash
cd API
npm install
node server.js
```

Open `http://localhost:3000/api-docs` for the Swagger documentation.

---

## Default Credentials

All seeded users share the password: **`Password123`**

| Role | Email | UserID |
|:---|:---|:---:|
| **Admin** | `kabo@kobo.co.za` | 1 |
| **Admin** | `thandi@kobo.co.za` | 2 |
| **Admin** | `sipho@kobo.co.za` | 3 |
| **Merchant** | `merchant4@kobo.co.za` – `merchant25@kobo.co.za` | 4–25 |
| **User** | `user26@kobo.co.za` – `user55@kobo.co.za` | 26–55 |

### Login Example

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"kabo@kobo.co.za","password":"Password123"}'
```

Use the returned `token` in the `Authorization: Bearer <token>` header for protected endpoints.

---

## API Reference

All endpoints are accessible through Swagger UI at `http://localhost:3000/api-docs`.

### Auth (Public)

| Method | Endpoint | Description |
|:---:|:---|:---|
| `POST` | `/api/v1/auth/register` | Register a new user |
| `POST` | `/api/v1/auth/login` | Login and receive JWT token |
| `GET` | `/api/v1/auth/profile` | Get current user profile (🔒 Token) |

### Users

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/v1/users` | List all users |
| `GET` | `/api/v1/users/:id` | Get user by ID with wallet info |

### Merchants (🔒 Token Required)

| Method | Endpoint | Description |
|:---:|:---|:---|
| `POST` | `/api/v1/merchants/register` | Register merchant profile |
| `GET` | `/api/v1/merchants` | List all merchants |
| `GET` | `/api/v1/merchants/:id` | Get merchant details |
| `PUT` | `/api/v1/merchants/:id/activate` | Activate merchant (🔒 Admin) |
| `PUT` | `/api/v1/merchants/:id/suspend` | Suspend merchant (🔒 Admin) |
| `PUT` | `/api/v1/merchants/:id/deactivate` | Deactivate merchant (🔒 Admin) |
| `GET` | `/api/v1/merchants/:id/transactions` | Merchant transactions |
| `GET` | `/api/v1/merchants/:id/balance` | Merchant wallet balance |

### Products

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/v1/products` | List all products |
| `GET` | `/api/v1/products/:id` | Get product by ID |
| `POST` | `/api/v1/products` | Create product (🔒 Admin) |
| `PUT` | `/api/v1/products/:id` | Update product (🔒 Admin) |

### Wallets

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/v1/wallets/:id` | Get wallet by ID |
| `POST` | `/api/v1/wallets/:id/topup` | Top up wallet (🔒 Admin) |
| `GET` | `/api/v1/wallets/:id/history` | Wallet transaction history |

### Transactions

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/v1/transactions` | List transactions (filter: `?walletId=`, `?status=`) |
| `GET` | `/api/v1/transactions/:id` | Get transaction by EntryID |

### Vouchers

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/v1/vouchers` | List all vouchers |
| `GET` | `/api/v1/vouchers/:id` | Get voucher by ID |

### Distribution

| Method | Endpoint | Description |
|:---:|:---|:---|
| `POST` | `/api/v1/distribution/issue-voucher` | Issue a single voucher |
| `POST` | `/api/v1/distribution/bulk-issue` | Bulk voucher issuance (🔒 Token) |

### Commissions (🔒 Token Required)

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/v1/commissions` | List commission rules |
| `GET` | `/api/v1/commissions/:id` | Get commission rule |
| `POST` | `/api/v1/commissions` | Create commission (🔒 Admin) |
| `PUT` | `/api/v1/commissions/:id` | Update commission (🔒 Admin) |
| `DELETE` | `/api/v1/commissions/:id` | Delete commission (🔒 Admin) |

### Settlements (🔒 Token Required)

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/v1/settlements` | List all settlements |
| `GET` | `/api/v1/settlements/:id` | Get settlement by ID |
| `POST` | `/api/v1/settlements/calculate` | Calculate settlement (🔒 Admin) |

### Admin (🔒 Admin Only)

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/v1/admin/ledger` | Global transaction ledger |
| `GET` | `/api/v1/admin/users` | All users with sensitive data |
| `GET` | `/api/v1/admin/merchants` | All merchants with financials |
| `GET` | `/api/v1/admin/settlements` | All settlements |
| `GET` | `/api/v1/admin/reports/revenue` | Revenue report by provider |
| `GET` | `/api/v1/admin/reports/top-merchants` | Top 10 merchants by revenue |
| `PUT` | `/api/v1/admin/commission-rates` | Bulk-update commission rates |
| `GET` | `/api/v1/admin/audit-log` | View audit trail |

---

## Database Schema

| # | Table | Records | Purpose |
|:---:|:---|:---:|:---|
| 1 | `ServiceProviders` | 5 | Mobile & utility providers |
| 2 | `Users` | 55 | Admins, Merchants, Users with auth |
| 3 | `Merchants` | 22 | Business registration & lifecycle |
| 4 | `Wallets` | 55 | Financial balances (ZAR) |
| 5 | `Products` | 12 | Airtime & electricity products |
| 6 | `Commissions` | 37 | Per-product, per-tier percentages |
| 7 | `TransactionLedger` | 5,200 | Full transaction history |
| 8 | `DigitalVouchers` | ~4,800 | Issued voucher PINs |
| 9 | `Settlements` | 12 | Merchant settlement records |
| 10 | `AuditLog` | 5 | Admin action trail |

SQL audit queries should be saved in `Database/sql-queries/`.

---

## Guides

| # | Title | Duration | Description |
|:---:|:---|:---:|:---|
| 1 | [Database Setup](Guides/Guide1-DatabaseSetup.md) | 30 min | SQL Server configuration & verification |
| 2 | [API Setup](Guides/Guide2-APISetup.md) | 30 min | npm install, start server, explore endpoints |
| 3 | [QE Exercises](Guides/Guide3-QualityEngineering.md) | 60 min | API validation, DB auditing, defect identification |

---

## Project Structure

```
KOBO/
├── API/
│   ├── package.json              # Dependencies (express, jwt, bcrypt, mssql, swagger)
│   └── server.js                 # 40+ endpoint Express API with JWT auth & RBAC
│
├── Database/
│   ├── Setup.sql                 # One-time SQL Server configuration
│   ├── Database.sql              # Legacy schema (v1 — 50 users, 100 transactions)
│   ├── Kobo.sql                  # Expanded schema (v2 — 55 users, 5,200 transactions)
│   └── sql-queries/              # Student SQL audit queries (Task 4)
│       └── README.md
│
├── Guides/
│   ├── Guide1-DatabaseSetup.md
│   ├── Guide2-APISetup.md
│   └── Guide3-QualityEngineering.md
│
├── DEFECTS-EXAMPLE.md            # Example defect report template
└── README.md                     # This file
```

---

## Troubleshooting

| Problem | Solution |
|:---|:---|
| `Login failed for user 'sa'` | Run `Database/Setup.sql` against the master database |
| `TCP/IP connection refused` | Enable TCP/IP in SQL Server Configuration Manager, restart SQL Server |
| `npm install` fails | Ensure Node.js v18+ is installed |
| `node server.js` connection error | Ensure SQL Server is running and `Kobo.sql` has been executed |
| Port 3000 in use | Close other `node server.js` instances |
| Swagger UI doesn't load | Verify terminal shows `Kobo Business Gateway: Port 3000` |
| JWT token issues | Login via `POST /api/v1/auth/login` with valid credentials |
| `401 Unauthorized` | Include `Authorization: Bearer <token>` header |

---

<p align="center">
  <img src="https://img.shields.io/badge/Built_for-Quality_Engineering_Students-0066CC?style=for-the-badge" alt="Built for QE Students" />
</p>
