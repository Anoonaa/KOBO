<p align="center">
  <img src="https://img.shields.io/badge/LEWIS_RETAIL_ENGINE-Integration_&_Revenue_Audit-0066CC?style=for-the-badge&labelColor=003366" alt="Lewis Retail Engine" />
</p>

<h1 align="center">Lewis Retail Engine</h1>

<p align="center">
  <em>Technical Project Charter: Integration & Revenue Audit — Quality Engineering Sprint</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Stack-Node.js_+_SQL_Server-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Database-SQL_Server-CC2927?style=flat-square&logo=microsoftsqlserver&logoColor=white" alt="SQL Server" />
  <img src="https://img.shields.io/badge/Docs-Swagger_UI-85EA2D?style=flat-square&logo=swagger&logoColor=black" alt="Swagger" />
  <img src="https://img.shields.io/badge/Testing-Postman-FF6C37?style=flat-square&logo=postman&logoColor=white" alt="Postman" />
</p>

---

## Overview

The **Lewis Retail Engine** is a full-stack retail management platform designed for Quality Engineering exercises. It consists of:

- A **SQL Server** database (`LewisRetail`) with 11 tables, 5,000+ records, and intentionally embedded data-quality defects
- A **Node.js REST API** with 40+ endpoints covering stock management, pricing, credit governance, and revenue operations
- Built-in **Swagger documentation** for interactive API exploration

> ⚠️ This system contains **intentional defects** for educational purposes. Your task is to find, document, and assess them.

---

## Project Structure

```
lewis-retail/
├── API/                        # Node.js REST API
│   ├── server.js               # API server with 40+ endpoints
│   └── package.json            # Dependencies
├── Database/                   # SQL Server scripts
│   ├── Setup.sql               # SQL Auth configuration (run first)
│   ├── LewisRetail.sql          # Lewis Retail schema & seed data
│   └── sql-queries/            # Your Task 3 audit queries go here
├── Automation/                 # Your Task 2 Postman collection
├── Guides/                     # Setup and exercise guides
│   ├── Guide1-DatabaseSetup.md
│   ├── Guide2-APISetup.md
│   └── Guide3-QualityEngineering.md
├── CONTRIBUTIONS.md            # Team work-log and task question answers
├── DEFECTS-EXAMPLE.md          # Example defect report
└── README.md                   # This file
```

---

## Quick Start

### 1. Database Setup

```bash
# In VS Code with SQL Server extension:
# 1. Connect to localhost using Windows Authentication
# 2. Execute Database/Setup.sql against master database
# 3. Enable TCP/IP and restart SQL Server
# 4. Execute Database/LewisRetail.sql to create LewisRetail database
```

See [Guide 1 — Database Setup](Guides/Guide1-DatabaseSetup.md) for detailed instructions.

### 2. API Setup

```bash
cd API
npm install
node server.js
# → Lewis Retail Engine: Port 3000 | Docs: http://localhost:3000/api-docs
```

See [Guide 2 — API Setup](Guides/Guide2-APISetup.md) for detailed instructions.

---

## API Endpoint Summary

| Category | Endpoints | Description |
|:---|:---:|:---|
| **Auth** | 3 | Register, login, profile |
| **Users** | 2 | List and retrieve users |
| **Customers** | 7 | Register, list, CRUD, customer orders |
| **Products** | 4 | List, retrieve, create, update |
| **Inventory / Stock** | 4 | Stock levels, updates, low-stock alerts |
| **Pricing** | 6 | Price calculator, VAT rates, discount rules |
| **Credit** | 4 | Credit accounts, applications, status |
| **Orders** | 4 | Sales transactions, single and bulk |
| **Stores** | 2 | Store listing and details |
| **Admin** | 7 | Ledger, reports, audit log |
| **Total** | **43** | |

---

## Database Schema

| Table | Records | Description |
|:---|:---:|:---|
| `Departments` | 5 | Product categories (Electronics, Clothing, etc.) |
| `Users` | 55 | Staff: 3 Admin, 22 StoreManager, 30 Cashier |
| `Stores` | 22 | Retail store locations with managers |
| `Customers` | 50 | Retail customers with tier levels |
| `CreditAccounts` | 30 | Customer credit facilities |
| `Products` | 15 | Retail products across 5 departments |
| `Inventory` | 15 | Stock levels per product |
| `VAT_Rates` | 4 | Tax rate rules |
| `PricingRules` | 46+ | Tier-based discount rules |
| `Orders` | 5,200 | Sales transaction records |
| `AuditLog` | 5 | System action audit trail |

---

## Default Credentials

| Role | Email | Password |
|:---|:---|:---|
| Admin | `kabo@lewisretail.co.za` | `Password123` |
| Admin | `thandi@lewisretail.co.za` | `Password123` |
| Admin | `sipho@lewisretail.co.za` | `Password123` |
| StoreManager | `manager4@lewisretail.co.za` | `Password123` |
| Cashier | `cashier26@lewisretail.co.za` | `Password123` |

---

## Sprint Tasks

### Task 1: Retail Environment & JIRA Governance
Set up the database, deploy the API, configure JIRA and Git.

### Task 2: API & Contract Validation (Postman)
50+ targeted requests across Stock, Pricing, and Credit endpoints.

### Task 3: Database Integrity Audit (SQL)
50+ audit queries for stock reconciliation, pricing audit, data hygiene, and BI reporting.

### Task 4: Defect Reporting & JIRA Lifecycle
Identify and document 10 critical flaws with JIRA lifecycle tracking.

### Task 5: Final Executive Presentation
5–7 minute presentation with live demo, risk analysis, and JIRA review.

---

## Submission Requirements

Push the following to the GitHub `main` branch by the deadline:

1. `/API` — Core retail service code
2. `/Database` — LewisRetail.sql and the `/sql-queries` folder with 50+ queries
3. `/Automation` — Master Postman Collection JSON (v2.1)
4. `CONTRIBUTIONS.md` — Team work-log, JIRA screenshots, and defect register

---

<p align="center">
  <img src="https://img.shields.io/badge/Sprint_Duration-30_Days-blue?style=for-the-badge" alt="30 Day Sprint" />
  <img src="https://img.shields.io/badge/Team_Size-3_Person_Squad-purple?style=for-the-badge" alt="3 Person Squad" />
</p>
