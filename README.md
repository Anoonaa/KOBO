# Kobo Fintech — Quality Engineering Project

## Prerequisites
- **SQL Server** installed locally
- **Node.js** (v18+) installed
- **VS Code** with the SQL Server extension

## Setup

### 1. One-Time Setup (enable API database access)
1. In VS Code, connect to your local SQL Server using the **SQL Server extension** (Windows Authentication)
2. Open `/Database/Setup.sql` and run it against the **master** database
3. Enable TCP/IP:
   - Open the **Start Menu** → search for **SQL Server Configuration Manager**
   - Go to **SQL Server Network Configuration** → **Protocols for MSSQLSERVER**
   - Right-click **TCP/IP** → **Enable**
4. Restart SQL Server:
   - Open the **Start Menu** → search for **Services**
   - Find **SQL Server (MSSQLSERVER)** → Right-click → **Restart**

### 2. Database
1. Open `/Database/Database.sql` in VS Code
2. Run it via the SQL Server extension — it creates the `KoboFintech` database, tables, seed data, and stored procedure
3. Verify: run `SELECT COUNT(*) FROM KoboFintech.dbo.Users` → 50 rows

### 3. API
1. Open a terminal in the `/API` folder
2. Run `npm install`
3. Run `node server.js`
4. Open **http://localhost:3000/api-docs** in your browser

> **Note:** The API connects using SQL Authentication (`sa` / `Password123`). The Setup.sql script configures this automatically.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users` | List all users |
| GET | `/api/v1/users/:id` | Get user by ID (with wallet) |
| GET | `/api/v1/products` | List all products |
| GET | `/api/v1/wallets/:id` | Get wallet by ID |
| GET | `/api/v1/transactions` | List transactions (filter: `?walletId=`) |
| GET | `/api/v1/vouchers` | List all vouchers |
| POST | `/api/v1/distribution/issue-voucher` | Issue a digital voucher |
