<p align="center">
  <img src="https://img.shields.io/badge/KOBO-Fintech-0066CC?style=for-the-badge&labelColor=003366" alt="Kobo Fintech" />
</p>

<h1 align="center">Kobo Fintech: Quality Engineering Project</h1>

<p align="center">
  A hands-on Quality Engineering project built around a simulated fintech distribution platform.<br/>
  Students will set up a database, launch a REST API, and execute structured QE test exercises.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 18+" />
  <img src="https://img.shields.io/badge/SQL_Server-2019+-CC2927?style=flat-square&logo=microsoftsqlserver&logoColor=white" alt="SQL Server 2019+" />
  <img src="https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white" alt="Express 4.x" />
  <img src="https://img.shields.io/badge/Swagger-OpenAPI_3.0-85EA2D?style=flat-square&logo=swagger&logoColor=black" alt="Swagger" />
  <img src="https://img.shields.io/badge/License-Educational-blue?style=flat-square" alt="Educational" />
</p>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start Guide](#quick-start-guide)
- [API Reference](#api-reference)
- [Guides](#guides)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Overview

Kobo Fintech is a simulated digital distribution platform designed for Quality Engineering coursework. The system models a real-world fintech operation where users hold digital wallets, purchase airtime and utility products, and receive digital vouchers.

This project provides students with a fully functional backend system against which they can work on:

- Database verification and data integrity testing
- REST API functional testing using Postman
- Business logic validation and defect identification
- SQL auditing and reconciliation

---

## Architecture

```
+---------------------+         +---------------------+         +---------------------+
|                     |         |                     |         |                     |
|   Swagger UI        | ------> |   Express API       | ------> |   SQL Server        |
|   (Browser)         |  HTTP   |   (Node.js)         |  TCP/IP |   (KoboFintech DB)  |
|                     |         |                     |         |                     |
+---------------------+         +---------------------+         +---------------------+
   Port 3000/api-docs              Port 3000                       Port 1433
```

| Layer | Technology | Purpose |
|:---|:---|:---|
| **Frontend** | Swagger UI | Interactive API documentation and testing interface |
| **Backend** | Node.js + Express | REST API serving JSON responses |
| **Database** | Microsoft SQL Server | Persistent data storage with stored procedures |

---

## Prerequisites

Before starting, ensure you have the following software installed on your Windows machine:

| # | Software | Version | Download Link |
|:---:|:---|:---|:---|
| 1 | **Microsoft SQL Server** | 2019 or later (Developer or Express) | [Download](https://www.microsoft.com/en-us/sql-server/sql-server-downloads) |
| 2 | **Node.js** | v18.0.0 or later | [Download](https://nodejs.org) |
| 3 | **Visual Studio Code** | Latest | [Download](https://code.visualstudio.com) |

> After installing Node.js, open a terminal and run `node --version` to confirm installation. You should see `v18.x.x` or higher.

---

## Quick Start Guide

Follow these steps in exact order. Each step builds on the previous one.

---

### Step 1 -- One-Time SQL Server Configuration

This step enables SQL Authentication so the API can connect to the database.

1. Open **Visual Studio Code**.
2. In the left sidebar, **left-click** the **SQL Server** icon.
3. **Left-click** the **Add Connection** button (the plug icon with a `+` symbol).
4. Enter the following when prompted:
   - **Server name**: `localhost` -- press **Enter**
   - **Database name**: master -- press **Enter**
   - **Authentication type**: select **Windows Authentication**
   - **Profile name**: `Local Server/Your name/Project name` -- press **Enter**
5. In the file explorer (left sidebar), navigate to the `Database` folder and **double-click** on `Setup.sql` to open it.
6. Before running, confirm you are connected to the **master** database. Check the database name in the VS Code status bar at the bottom of the window. If it does not say `master`, **left-click** the database name in the status bar and select `master`.
7. **Right-click** anywhere inside the SQL file in the editor.
8. From the context menu, **left-click** **Execute Query**.
9. Select the **Local SQL Server** connection when prompted.
10. Verify the output panel shows `SQL Authentication is now enabled!`

---

### Step 2 -- Enable TCP/IP Network Protocol

The API communicates with SQL Server over TCP/IP, which is disabled by default.

1. Open the **Start Menu** (bottom-left of your screen).
2. Type `SQL Server Configuration Manager` and press **Enter**.
3. In the left panel, **left-click** **SQL Server Network Configuration** to expand it.
4. **Left-click** **Protocols for MSSQLSERVER**.
5. In the right panel, locate **TCP/IP** in the list.
6. **Right-click** on **TCP/IP**.
7. **Left-click** **Enable** from the context menu.
8. **Left-click** **OK** when the dialog confirms the change will take effect after restart.

---

### Step 3 -- Restart SQL Server

1. Go back to the SQL Server Configuration Manager home/opening page.
2. locate **SQL Server (MSSQLSERVER)**.
3. **Right-click** on **SQL Server (MSSQLSERVER)**.
4. **Left-click** **Restart** from the context menu.
5. Wait until the status column shows **Running**.

---

### Step 4 -- Create the Database

1. Return to **Visual Studio Code**.
2. In the file explorer (left sidebar), navigate to the `Database` folder and **double-click** on `Database.sql` to open it.
3. Confirm the status bar at the bottom shows **master** as the active database. The script will create and switch to the KoboFintech database automatically.
4. **Right-click** anywhere inside the editor.
5. **Left-click** **Execute Query** from the context menu.
6. Select the **Local SQL Server** connection if prompted.
7. Wait for execution to complete. The script creates:

| Item | Count | Details |
|:---|:---:|:---|
| Database | 1 | `KoboFintech` |
| Tables | 6 | ServiceProviders, Users, Wallets, Products, TransactionLedger, DigitalVouchers |
| Users | 50 | Seed data with wallets (3 users marked as Disabled) |
| Products | 3 | MTN Airtime, Vodacom Airtime, Eskom Electricity |
| Transactions | 100 | Randomized sample ledger entries |
| Stored Procedure | 1 | `usp_IssueDigitalVoucher` |

8. To verify, change your active database to **KoboFintech** by **left-clicking** the database name in the status bar and selecting `KoboFintech`. Then open a new query file, paste the following, and execute it:

```sql
SELECT COUNT(*) AS UserCount FROM Users;
```

The result should be **50**.

---

### Step 5 -- Start the API

1. In VS Code, open the integrated terminal by selecting **Terminal** from the top menu bar, then **left-click** **New Terminal**.
2. In the terminal, type the following command and press **Enter**:

   ```
   cd API
   ```

3. Install dependencies:

   ```
   npm install
   ```

4. Wait for the installation to complete (you will see `added X packages` in the output).
5. Start the server:

   ```
   node server.js
   ```

6. Confirm you see the following output:

   ```
   Kobo Services: Port 3000
   ```

7. Open your web browser and go to `http://localhost:3000/api-docs`.
8. You should see the **Kobo Fintech Distribution API** Swagger documentation page.

> The API connects using SQL Authentication with the credentials configured by `Setup.sql`. Do not close the terminal running the server while you are working with the API.

---

## API Reference

All endpoints are accessible through Swagger UI at `http://localhost:3000/api-docs` or via Postman.

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/v1/users` | Retrieve all user records |
| `GET` | `/api/v1/users/:id` | Retrieve a single user with wallet details |
| `GET` | `/api/v1/products` | Retrieve all available products |
| `GET` | `/api/v1/wallets/:id` | Retrieve wallet balance and owner information |
| `GET` | `/api/v1/transactions` | Retrieve ledger entries (optional filter: `?walletId=`) |
| `GET` | `/api/v1/vouchers` | Retrieve all issued digital vouchers |
| `POST` | `/api/v1/distribution/issue-voucher` | Issue a new digital voucher (debits wallet) |

### POST Request Body -- Issue Voucher

```json
{
  "walletId": 1,
  "productId": 1,
  "reference": "REF-001"
}
```

| Field | Type | Required | Description |
|:---|:---:|:---:|:---|
| `walletId` | integer | Yes | The wallet to debit |
| `productId` | integer | Yes | The product to purchase |
| `reference` | string | Yes | External reference identifier |

---

## Guides

The `Guides/` directory contains three structured practical guides:

| # | Title | Duration | Description |
|:---:|:---|:---:|:---|
| 1 | [Database Setup and Verification](Guides/Guide1-DatabaseSetup.md) | 30 min | Run setup scripts and verify the database |
| 2 | [API Setup and Exploration](Guides/Guide2-APISetup.md) | 30 min | Install dependencies, start the API, explore endpoints |
| 3 | [Quality Engineering Exercises](Guides/Guide3-QualityEngineering.md) | 60 min | API functional validation, database auditing, defect identification |

Complete the guides in sequential order. Each guide builds upon the previous one.

---

## Project Structure

```
KOBO/
|-- API/
|   |-- package.json          # Node.js project dependencies
|   |-- server.js              # Express API server with Swagger docs
|
|-- Database/
|   |-- Setup.sql              # One-time SQL Server configuration script
|   |-- Database.sql           # Database schema, seed data, and stored procedure
|
|-- Guides/
|   |-- Guide1-DatabaseSetup.md
|   |-- Guide2-APISetup.md
|   |-- Guide3-QualityEngineering.md
|
|-- README.md                  # This file
```

---

## Troubleshooting

| Problem | Possible Cause | Solution |
|:---|:---|:---|
| `Login failed for user 'sa'` | Setup.sql was not run | Open `Database/Setup.sql`, **right-click** in the editor, select **Execute Query** against the master database |
| `TCP/IP connection refused` | TCP/IP is disabled | Open SQL Server Configuration Manager, **right-click** TCP/IP, select **Enable**, then restart SQL Server |
| `npm install` fails | Node.js not installed | Download and install Node.js from [nodejs.org](https://nodejs.org). After installation, close and reopen VS Code |
| `node server.js` shows connection error | SQL Server not running | Open Windows Services, find SQL Server (MSSQLSERVER), **right-click** it and select **Start** |
| Port 3000 already in use | Another process is using the port | Close any other terminal sessions running `node server.js` |
| Swagger UI does not load | Server not running | Verify the terminal shows `Kobo Services: Port 3000`. If not, restart the server with `node server.js` |

---

<p align="center">
  <img src="https://img.shields.io/badge/Built_for-Quality_Engineering_Students-0066CC?style=for-the-badge" alt="Built for QE Students" />
</p>



