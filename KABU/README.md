<p align="center">
  <img src="https://img.shields.io/badge/KABU-Retail-FF6600?style=for-the-badge&labelColor=8B2500" alt="Kabu Retail" />
</p>

<h1 align="center">Kabu Retail: Store & Loyalty Management System</h1>

<p align="center">
  A hands-on Quality Engineering project built around a simulated retail management platform.<br/>
  Students set up a database, launch a REST API with JWT authentication and RBAC, and execute<br/>
  structured QE test exercises including API validation, E2E automation, and SQL auditing.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 18+" />
  <img src="https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite 3" />
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

Kabu Retail is a simulated South African retail management platform designed for Quality Engineering coursework. The system models a real-world retail chain where customers hold loyalty accounts, store managers manage locations with tiered discount structures, and the platform processes product sales with full receipt and return processing.

This project provides students with a production-grade backend system supporting:

- **JWT Authentication & RBAC** — Role-based access control (Admin, StoreManager, Customer)
- **Store Lifecycle Management** — Registration → Activation → Suspension → Deactivation
- **Discount Engine** — Per-product, per-membership-tier percentage-based discounts
- **Returns Processing** — Store return record calculation
- **5,200+ Sales Orders** — With intentional data quality defects for auditing
- **40+ API Endpoints** — Sufficient for 50+ Postman requests and Playwright automation
- **10 Intentional Defects** — Security, financial, and data integrity flaws for discovery
- **SQLite Database** — No server installation required; `kabu.db` is created automatically

---

## Architecture

```
+---------------------+         +---------------------+         +---------------------+
|                     |         |                     |         |                     |
|   Swagger UI /      | ------> |   Express API       | ------> |   SQLite            |
|   Postman / PW      |  HTTP   |   (Node.js + JWT)   |  File   |   (kabu.db)         |
|                     |         |                     |         |                     |
+---------------------+         +---------------------+         +---------------------+
   Port 3000/api-docs              Port 3000                    KABU/API/kabu.db
```

| Layer | Technology | Purpose |
|:---|:---|:---|
| **Testing** | Swagger UI / Postman / Playwright | API documentation, manual testing, E2E automation |
| **Backend** | Node.js + Express + JWT + bcrypt | REST API with authentication and role-based access |
| **Database** | SQLite 3 (kabu.db) | 10 tables, 5,200+ seeded sales orders |

---

## Prerequisites

| # | Software | Version | Download Link |
|:---:|:---|:---|:---|
| 1 | **Node.js** | v18.0.0 or later | [Download](https://nodejs.org) |
| 2 | **Visual Studio Code** | Latest | [Download](https://code.visualstudio.com) |
| 3 | **DB Browser for SQLite** | Latest (optional) | [Download](https://sqlitebrowser.org/dl/) |

> No SQL Server, Docker, or any other database server is required. SQLite is bundled as an npm dependency.

---

## Quick Start Guide

### Step 1 — Install Dependencies and Start the API

```bash
cd KABU/API
npm install
node server.js
```

On first startup you will see:
```
Seeding kabu.db …
Database seeded successfully.
Kabu Retail Gateway: Port 3000 | Docs: http://localhost:3000/api-docs
```

The `kabu.db` file is created automatically in `KABU/API/`.

### Step 2 — Verify the Database

```bash
# Using sqlite3 command-line (optional)
sqlite3 KABU/API/kabu.db "SELECT COUNT(*) AS CustomerCount FROM Customers;"   -- Expected: 55
sqlite3 KABU/API/kabu.db "SELECT COUNT(*) AS OrderCount FROM SalesOrders;"    -- Expected: 5200
sqlite3 KABU/API/kabu.db "SELECT COUNT(*) AS StoreCount FROM Stores;"         -- Expected: 22
```

Open `http://localhost:3000/api-docs` for the Swagger documentation.

---

## Default Credentials

All seeded customers share the password: **`Password123`**

| Role | Email | CustomerID |
|:---|:---|:---:|
| **Admin** | `naledi@kabu.co.za` | 1 |
| **Admin** | `thabo@kabu.co.za` | 2 |
| **Admin** | `zanele@kabu.co.za` | 3 |
| **StoreManager** | `manager4@kabu.co.za` – `manager25@kabu.co.za` | 4–25 |
| **Customer** | `customer26@kabu.co.za` – `customer55@kabu.co.za` | 26–55 |

### Login Example

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"naledi@kabu.co.za","password":"Password123"}'
```

Use the returned `token` in the `Authorization: Bearer <token>` header for protected endpoints.

---

## API Reference

All endpoints are accessible through Swagger UI at `http://localhost:3000/api-docs`.

### Auth (Public)

| Method | Endpoint | Description |
|:---:|:---|:---|
| `POST` | `/api/v1/auth/register` | Register a new customer account |
| `POST` | `/api/v1/auth/login` | Login and receive JWT token |
| `GET` | `/api/v1/auth/profile` | Get current customer profile (🔒 Token) |

### Customers

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/v1/customers` | List all customers |
| `GET` | `/api/v1/customers/:id` | Get customer by ID with loyalty account info |

### Stores (🔒 Token Required)

| Method | Endpoint | Description |
|:---:|:---|:---|
| `POST` | `/api/v1/stores/register` | Register a new store |
| `GET` | `/api/v1/stores` | List all stores |
| `GET` | `/api/v1/stores/:id` | Get store details |
| `PUT` | `/api/v1/stores/:id/activate` | Activate store (🔒 Admin) |
| `PUT` | `/api/v1/stores/:id/suspend` | Suspend store (🔒 Admin) |
| `PUT` | `/api/v1/stores/:id/deactivate` | Deactivate store (🔒 Admin) |
| `GET` | `/api/v1/stores/:id/orders` | Store order history |
| `GET` | `/api/v1/stores/:id/balance` | Store manager loyalty balance |

### Products

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/v1/products` | List all products |
| `GET` | `/api/v1/products/:id` | Get product by ID |
| `POST` | `/api/v1/products` | Create product (🔒 Admin) |
| `PUT` | `/api/v1/products/:id` | Update product (🔒 Admin) |

### Loyalty Accounts

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/v1/accounts/:id` | Get loyalty account by ID |
| `POST` | `/api/v1/accounts/:id/topup` | Top up account (🔒 Admin) |
| `GET` | `/api/v1/accounts/:id/history` | Account order history |

### Orders

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/v1/orders` | List orders (filter: `?accountId=`, `?status=`) |
| `GET` | `/api/v1/orders/:id` | Get order by OrderID |

### Receipts

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/v1/receipts` | List all receipts |
| `GET` | `/api/v1/receipts/:id` | Get receipt by ID |

### Sales

| Method | Endpoint | Description |
|:---:|:---|:---|
| `POST` | `/api/v1/sales/process` | Process a single product sale |
| `POST` | `/api/v1/sales/bulk-purchase` | Bulk purchase (🔒 Token) |

### Discounts (🔒 Token Required)

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/v1/discounts` | List discount rules |
| `GET` | `/api/v1/discounts/:id` | Get discount rule |
| `POST` | `/api/v1/discounts` | Create discount (🔒 Admin) |
| `PUT` | `/api/v1/discounts/:id` | Update discount (🔒 Admin) |
| `DELETE` | `/api/v1/discounts/:id` | Delete discount (🔒 Admin) |

### Returns (🔒 Token Required)

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/v1/returns` | List all return records |
| `GET` | `/api/v1/returns/:id` | Get return record by ID |
| `POST` | `/api/v1/returns/calculate` | Calculate return for a store (🔒 Admin) |

### Admin (🔒 Admin Only)

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/v1/admin/ledger` | Global sales ledger |
| `GET` | `/api/v1/admin/customers` | All customers with sensitive data |
| `GET` | `/api/v1/admin/stores` | All stores with financials |
| `GET` | `/api/v1/admin/returns` | All return records |
| `GET` | `/api/v1/admin/reports/revenue` | Revenue report by supplier |
| `GET` | `/api/v1/admin/reports/top-stores` | Top 10 stores by revenue |
| `PUT` | `/api/v1/admin/discount-rates` | Bulk-update discount rates |
| `GET` | `/api/v1/admin/audit-log` | View audit trail |

---

## Database Schema

| # | Table | Records | Purpose |
|:---:|:---|:---:|:---|
| 1 | `Suppliers` | 5 | Product suppliers (Electronics, Groceries, Clothing, etc.) |
| 2 | `Customers` | 55 | Admins, StoreManagers, Customers with auth |
| 3 | `Stores` | 22 | Retail store registration & lifecycle |
| 4 | `LoyaltyAccounts` | 55 | Customer points balances (ZAR) |
| 5 | `Products` | 12 | Retail products with SKU and price |
| 6 | `Discounts` | 37 | Per-product, per-tier discount percentages |
| 7 | `SalesOrders` | 5,200 | Full sales transaction history |
| 8 | `Receipts` | ~4,800 | Issued sale receipts |
| 9 | `Returns` | 12 | Store return records |
| 10 | `AuditLog` | 5 | Admin action trail |

SQL audit queries should be saved in `Database/sql-queries/`.

---

## Guides

| # | Title | Duration | Description |
|:---:|:---|:---:|:---|
| 1 | [Database Setup](Guides/Guide1-DatabaseSetup.md) | 15 min | Start server, verify auto-created SQLite database |
| 2 | [API Setup](Guides/Guide2-APISetup.md) | 30 min | Explore endpoints with Swagger UI |
| 3 | [QE Exercises](Guides/Guide3-QualityEngineering.md) | 60 min | API validation, DB auditing, defect identification |

---

## Project Structure

```
KABU/
├── API/
│   ├── package.json              # Dependencies (express, jwt, bcrypt, sqlite, swagger)
│   ├── server.js                 # 40+ endpoint Express API with JWT auth & RBAC
│   └── kabu.db                   # SQLite database (auto-created on first startup)
│
├── Database/
│   ├── Kabu.sql                  # SQLite schema reference and verification queries
│   └── sql-queries/              # Student SQL audit queries (Task 3)
│       └── README.md
│
├── Guides/
│   ├── Guide1-DatabaseSetup.md
│   ├── Guide2-APISetup.md
│   └── Guide3-QualityEngineering.md
│
└── README.md                     # This file
```

---

## Troubleshooting

| Problem | Solution |
|:---|:---|
| `node server.js` fails on startup | Ensure you ran `npm install` in `KABU/API` first |
| `kabu.db` not created | Check that Node.js has write permission to `KABU/API/` |
| `npm install` fails | Ensure Node.js v18+ is installed (`node --version`) |
| Port 3000 in use | Close other `node server.js` instances; or set `PORT=3001 node server.js` |
| Swagger UI doesn't load | Verify terminal shows `Kabu Retail Gateway: Port 3000` |
| JWT token issues | Login via `POST /api/v1/auth/login` with valid credentials |
| `401 Unauthorized` | Include `Authorization: Bearer <token>` header |
| Want to reset the database | Delete `KABU/API/kabu.db` and restart the server |

---

<p align="center">
  <img src="https://img.shields.io/badge/Built_for-Quality_Engineering_Students-FF6600?style=for-the-badge" alt="Built for QE Students" />
</p>
