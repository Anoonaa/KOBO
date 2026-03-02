<p align="center">
  <img src="https://img.shields.io/badge/KOBO-Fintech-0066CC?style=for-the-badge&labelColor=003366" alt="Kobo Fintech" />
</p>

<h1 align="center">Kobo Fintech -- Quality Engineering Project</h1>

<p align="center">
  A hands-on Quality Engineering lab environment built around a simulated fintech distribution platform.<br/>
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

<p align="center">
  <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&h=300&fit=crop&crop=edges" alt="Data analytics dashboard" width="800" />
</p>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start Guide](#quick-start-guide)
  - [Step 1 -- One-Time SQL Server Configuration](#step-1----one-time-sql-server-configuration)
  - [Step 2 -- Enable TCP/IP Network Protocol](#step-2----enable-tcpip-network-protocol)
  - [Step 3 -- Restart SQL Server](#step-3----restart-sql-server)
  - [Step 4 -- Create the Database](#step-4----create-the-database)
  - [Step 5 -- Start the API](#step-5----start-the-api)
- [API Reference](#api-reference)
- [Practical Labs](#practical-labs)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Overview

Kobo Fintech is a simulated digital distribution platform designed for Quality Engineering coursework. The system models a real-world fintech operation where users hold digital wallets, purchase airtime and utility products, and receive digital vouchers.

This project provides students with a fully functional backend system against which they can practice:

- Database verification and data integrity testing
- REST API functional testing
- Boundary value analysis and equivalence partitioning
- Business logic validation and defect reporting

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
| 4 | **VS Code SQL Server Extension** | Latest | [Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=ms-mssql.mssql) |

> <img src="https://img.shields.io/badge/!-Verification-blue?style=flat-square" alt="Verification" /> After installing Node.js, open a terminal and run `node --version` to confirm installation. You should see `v18.x.x` or higher.

---

## Quick Start Guide

Follow these steps in exact order. Each step builds on the previous one.

---

### Step 1 -- One-Time SQL Server Configuration

This step enables SQL Authentication so the API can connect to the database using a username and password.

1. Open **Visual Studio Code**.
2. **Left-click** the **Extensions** icon in the left sidebar (it looks like four small squares).
3. Search for `SQL Server (mssql)` and **left-click** **Install**.
4. **Left-click** the **SQL Server** icon that appears in the left sidebar after installation.
5. **Left-click** the **Add Connection** button (plug icon with a `+`).
6. Enter the following when prompted:
   - **Server name**: `localhost` -- press **Enter**
   - **Database name**: leave blank -- press **Enter**
   - **Authentication type**: select **Windows Authentication**
   - **Profile name**: `Local SQL Server` -- press **Enter**
7. Press **Ctrl + O** to open a file. Navigate to and open `Database/Setup.sql`.
8. **Right-click** anywhere inside the SQL file in the editor.
9. From the context menu, **left-click** **Execute Query**.
10. Select the **Local SQL Server** connection when prompted.
11. Verify the output panel shows `SQL Authentication is now enabled!`

> <img src="https://img.shields.io/badge/!-Important-red?style=flat-square" alt="Important" /> You must be connected to the **master** database when running this script. Check the database name in the VS Code status bar at the bottom of the window.

---

### Step 2 -- Enable TCP/IP Network Protocol

The API communicates with SQL Server over TCP/IP, which is disabled by default.

1. **Left-click** the Windows **Start Menu** (bottom-left of your screen).
2. Type `SQL Server Configuration Manager` and press **Enter**.
3. In the left panel, **left-click** **SQL Server Network Configuration** to expand it.
4. **Left-click** **Protocols for MSSQLSERVER**.
5. In the right panel, locate **TCP/IP** in the list.
6. **Right-click** on **TCP/IP**.
7. **Left-click** **Enable** from the context menu.
8. **Left-click** **OK** when the dialog confirms the change will take effect after restart.

---

### Step 3 -- Restart SQL Server

1. **Left-click** the Windows **Start Menu**.
2. Type `Services` and press **Enter**.
3. In the Services window, scroll down and locate **SQL Server (MSSQLSERVER)**.
4. **Right-click** on **SQL Server (MSSQLSERVER)**.
5. **Left-click** **Restart** from the context menu.
6. Wait until the status column shows **Running**.

---

### Step 4 -- Create the Database

1. Return to **Visual Studio Code**.
2. Press **Ctrl + O** and open the file `Database/Database.sql`.
3. **Right-click** anywhere inside the editor.
4. **Left-click** **Execute Query** from the context menu.
5. Select the **Local SQL Server** connection if prompted.
6. Wait for execution to complete. The script creates:

| Item | Count | Details |
|:---|:---:|:---|
| Database | 1 | `KoboFintech` |
| Tables | 6 | ServiceProviders, Users, Wallets, Products, TransactionLedger, DigitalVouchers |
| Users | 50 | Seed data with wallets (3 users marked as Disabled) |
| Products | 3 | MTN Airtime, Vodacom Airtime, Eskom Electricity |
| Transactions | 100 | Randomized sample ledger entries |
| Stored Procedure | 1 | `usp_IssueDigitalVoucher` |

7. **Verify the setup** by opening a new file (**Ctrl + N**), pasting the following query, and executing it (**right-click** then **left-click** **Execute Query**):

```sql
SELECT COUNT(*) AS UserCount FROM KoboFintech.dbo.Users;
```

The result should be **50**.

---

### Step 5 -- Start the API

1. In VS Code, press **Ctrl + \`** (backtick key) to open the integrated terminal.
2. Type the following command and press **Enter** to navigate to the API directory:

   ```
   cd API
   ```

3. Type the following command and press **Enter** to install dependencies:

   ```
   npm install
   ```

4. Wait for the installation to complete (you will see `added X packages` in the output).
5. Type the following command and press **Enter** to start the server:

   ```
   node server.js
   ```

6. Confirm you see the following output:

   ```
   Kobo Services: Port 3000
   ```

7. Open your web browser (Chrome, Edge, or Firefox).
8. In the address bar, type `http://localhost:3000/api-docs` and press **Enter**.
9. You should see the **Kobo Fintech Distribution API** Swagger documentation page.

<p align="center">
  <img src="https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=900&h=300&fit=crop" alt="Code on a screen" width="800" />
</p>

> <img src="https://img.shields.io/badge/!-Note-blue?style=flat-square" alt="Note" /> The API connects using SQL Authentication with the credentials configured by `Setup.sql`. Do not close the terminal running the server while you are working with the API.

---

## API Reference

All endpoints are accessible through the Swagger UI at `http://localhost:3000/api-docs` or via direct HTTP requests.

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

## Practical Labs

The [`Labs/`](Labs/) directory contains three structured practical exercises designed to guide you through the system setup, exploration, and quality engineering testing.

| Lab | Title | Duration | Difficulty | Description |
|:---:|:---|:---:|:---:|:---|
| 1 | [Database Setup and Verification](Labs/Lab1-DatabaseSetup.md) | 30 min | Beginner | Install SQL Server, run setup scripts, verify data |
| 2 | [API Setup and Exploration](Labs/Lab2-APISetup.md) | 30 min | Beginner | Install dependencies, start the API, explore endpoints |
| 3 | [Quality Engineering Exercises](Labs/Lab3-QualityEngineering.md) | 60 min | Intermediate | Boundary testing, business logic validation, defect reporting |

Complete the labs in sequential order. Each lab builds upon the work done in the previous one.

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
|-- Labs/
|   |-- Lab1-DatabaseSetup.md          # Practical Lab 1: Database setup
|   |-- Lab2-APISetup.md              # Practical Lab 2: API setup and exploration
|   |-- Lab3-QualityEngineering.md    # Practical Lab 3: QE test exercises
|
|-- SELECT.sql                 # Utility query to list database tables
|-- README.md                  # This file
```

---

## Troubleshooting

| Problem | Possible Cause | Solution |
|:---|:---|:---|
| Cannot connect to SQL Server from VS Code | Extension not installed | **Left-click** Extensions icon in VS Code, search for `SQL Server (mssql)`, and **left-click** **Install** |
| `Login failed for user 'sa'` | Setup.sql was not run | Open `Database/Setup.sql`, **right-click** in the editor, **left-click** **Execute Query** against the master database |
| `TCP/IP connection refused` | TCP/IP is disabled | Open SQL Server Configuration Manager, **right-click** TCP/IP, **left-click** Enable, then restart SQL Server |
| `npm install` fails | Node.js not installed | Download and install Node.js from [nodejs.org](https://nodejs.org). After installation, close and reopen VS Code |
| `node server.js` shows connection error | SQL Server not running | Open Windows Services, find SQL Server (MSSQLSERVER), **right-click** it, and **left-click** **Start** |
| Port 3000 already in use | Another process is using the port | Close any other terminal sessions running `node server.js`, or set a custom port with `set PORT=3001` before starting |
| Swagger UI does not load | Server not running | Verify the terminal shows `Kobo Services: Port 3000`. If not, restart the server with `node server.js` |

---

<p align="center">
  <img src="https://img.shields.io/badge/Built_for-Quality_Engineering_Students-0066CC?style=for-the-badge" alt="Built for QE Students" />
</p>
