-- =============================================================================
--  KABU RETAIL — Store & Loyalty Management System
--  SQLite Schema Reference
--
--  This file documents the full database schema used by kabu.db.
--  The database is auto-created and seeded when you run: node server.js
--
--  You can use this file with:
--    • DB Browser for SQLite (open kabu.db, then run queries)
--    • VS Code SQLite extension
--    • sqlite3 command-line tool
--
--  Database file location: KABU/API/kabu.db  (created on first server start)
-- =============================================================================

-- =============================================================================
--  TABLES
-- =============================================================================

-- Product Suppliers (5 suppliers across retail categories)
CREATE TABLE IF NOT EXISTS Suppliers (
    SupplierID   INTEGER PRIMARY KEY AUTOINCREMENT,
    SupplierName TEXT    NOT NULL,
    Category     TEXT    NOT NULL,
    IsActive     INTEGER DEFAULT 1
);

-- Customers (55 total: 3 Admin, 22 StoreManager, 30 Customer)
-- NOTE: Default PasswordHash is a bcrypt hash of 'Password123'.
--       Used ONLY for seeding test/demo data.
CREATE TABLE IF NOT EXISTS Customers (
    CustomerID     INTEGER PRIMARY KEY AUTOINCREMENT,
    PhoneNumber    TEXT    NOT NULL,
    FullName       TEXT    NOT NULL,
    Email          TEXT,
    PasswordHash   TEXT    NOT NULL DEFAULT '$2a$10$6F/QPoOSUf.iIEeqMZUn8.eS8o03/Icx1jOunNwY7Q8sG199vqsfK',
    Role           TEXT    NOT NULL DEFAULT 'Customer',   -- Admin | StoreManager | Customer
    MembershipTier TEXT    DEFAULT 'Standard',            -- Standard | Premium | Gold
    AccountStatus  TEXT    DEFAULT 'Active',              -- Active | Disabled | Suspended
    CreatedAt      TEXT    DEFAULT (datetime('now'))
);

-- Stores (22 Kabu retail locations, one per StoreManager)
CREATE TABLE IF NOT EXISTS Stores (
    StoreID      INTEGER PRIMARY KEY AUTOINCREMENT,
    ManagerID    INTEGER REFERENCES Customers(CustomerID),
    StoreName    TEXT    NOT NULL,
    StoreCode    TEXT,
    StoreStatus  TEXT    DEFAULT 'Pending',   -- Active | Pending | Suspended | Deactivated
    StoreRegion  TEXT    DEFAULT 'Standard',
    CreatedAt    TEXT    DEFAULT (datetime('now')),
    UpdatedAt    TEXT    DEFAULT (datetime('now'))
);

-- LoyaltyAccounts (55, one per customer — points balance in ZAR)
CREATE TABLE IF NOT EXISTS LoyaltyAccounts (
    AccountID      INTEGER PRIMARY KEY AUTOINCREMENT,
    CustomerID     INTEGER REFERENCES Customers(CustomerID),
    PointsBalance  REAL    DEFAULT 0.0,   -- ❌ DEFECT: REAL used instead of decimal
    CurrencyCode   TEXT    DEFAULT 'ZAR',
    LastUpdated    TEXT    DEFAULT (datetime('now'))
);

-- Products (12 retail items across 5 suppliers)
CREATE TABLE IF NOT EXISTS Products (
    ProductID     INTEGER PRIMARY KEY AUTOINCREMENT,
    SupplierID    INTEGER REFERENCES Suppliers(SupplierID),
    SKU           TEXT    UNIQUE,
    ProductName   TEXT    NOT NULL,
    Description   TEXT,
    UnitPrice     REAL    NOT NULL,   -- ❌ DEFECT: REAL used instead of decimal
    StockQuantity INTEGER DEFAULT 0,
    IsActive      INTEGER DEFAULT 1
);

-- Discounts (per-product, per-membership-tier: 37 rules including 1 duplicate)
CREATE TABLE IF NOT EXISTS Discounts (
    DiscountID           INTEGER PRIMARY KEY AUTOINCREMENT,
    ProductID            INTEGER REFERENCES Products(ProductID),
    MembershipTier       TEXT    NOT NULL,   -- Standard | Premium | Gold
    DiscountPercentage   REAL    NOT NULL,   -- ❌ DEFECT: REAL used instead of decimal
    EffectiveDate        TEXT    DEFAULT (datetime('now')),
    IsActive             INTEGER DEFAULT 1
);

-- SalesOrders (5,200 transactions with intentional defects)
CREATE TABLE IF NOT EXISTS SalesOrders (
    OrderID         TEXT    PRIMARY KEY,
    AccountID       INTEGER REFERENCES LoyaltyAccounts(AccountID),
    ProductID       INTEGER REFERENCES Products(ProductID),
    Quantity        INTEGER NOT NULL DEFAULT 1,
    UnitPrice       REAL    NOT NULL,
    TotalAmount     REAL    NOT NULL,
    DiscountAmount  REAL    DEFAULT 0,
    OrderReference  TEXT,
    OrderStatus     TEXT    DEFAULT 'Completed',   -- Completed | Pending | Failed
    CreatedAt       TEXT    DEFAULT (datetime('now'))
);

-- Receipts (~4,800 records — ~400 ghost orders have no receipt)
CREATE TABLE IF NOT EXISTS Receipts (
    ReceiptID    INTEGER PRIMARY KEY AUTOINCREMENT,
    OrderID      TEXT    REFERENCES SalesOrders(OrderID),
    ReceiptCode  TEXT    NOT NULL,
    IssuedAt     TEXT    DEFAULT (datetime('now')),
    ExpiryDate   TEXT    NOT NULL   -- ❌ DEFECT: ~200 already expired
);

-- Returns (12 store return/refund records)
CREATE TABLE IF NOT EXISTS Returns (
    ReturnID        INTEGER PRIMARY KEY AUTOINCREMENT,
    StoreID         INTEGER REFERENCES Stores(StoreID),
    PeriodStart     TEXT    NOT NULL,
    PeriodEnd       TEXT    NOT NULL,
    GrossAmount     REAL    DEFAULT 0,
    DiscountAmount  REAL    DEFAULT 0,
    NetAmount       REAL    DEFAULT 0,   -- ❌ DEFECT: rows 11-12 math does not add up
    ReturnStatus    TEXT    DEFAULT 'Pending',   -- Pending | Processed | Failed
    CreatedAt       TEXT    DEFAULT (datetime('now'))
);

-- AuditLog (admin and system action trail)
CREATE TABLE IF NOT EXISTS AuditLog (
    LogID          INTEGER PRIMARY KEY AUTOINCREMENT,
    CustomerID     INTEGER,
    Action         TEXT,
    TableAffected  TEXT,
    RecordID       TEXT,
    OldValue       TEXT,
    NewValue       TEXT,
    Timestamp      TEXT    DEFAULT (datetime('now'))
);

-- =============================================================================
--  SEED DATA REFERENCE
--  The server.js auto-seeds all data below on first startup.
--  These are provided as reference for understanding the schema.
-- =============================================================================

-- Suppliers (5)
-- INSERT INTO Suppliers (SupplierName, Category) VALUES
--     ('TechNova',     'Electronics'),
--     ('FreshHarvest', 'Groceries'),
--     ('StyleHub',     'Clothing'),
--     ('HomeCraft',    'Household'),
--     ('GlowUp',       'Beauty');

-- Products (12 across 5 suppliers)
-- INSERT INTO Products (SupplierID, SKU, ProductName, Description, UnitPrice, StockQuantity) VALUES
--     (1, 'TNV-LAP-001', 'Laptop',      'TechNova 15" Laptop',              5000.00, 20),
--     (1, 'TNV-HPH-002', 'Headphones',  'TechNova Wireless Headphones',      500.00, 50),
--     (1, 'TNV-USB-003', 'USB Cable',   'TechNova USB-C Cable 2m',            50.00, 200),
--     (2, 'FRH-BRD-001', 'Bread',       'FreshHarvest Brown Bread 700g',      20.00, 150),
--     (2, 'FRH-MLK-002', 'Milk',        'FreshHarvest Full Cream 1L',         25.00, 100),
--     (2, 'FRH-EGG-003', 'Eggs',        'FreshHarvest Free Range x12',        40.00, 80),
--     (3, 'STH-TSH-001', 'T-Shirt',     'StyleHub Cotton T-Shirt',           150.00, 60),
--     (3, 'STH-JNS-002', 'Jeans',       'StyleHub Slim Fit Jeans',           450.00, 30),
--     (4, 'HMC-DSP-001', 'Dish Soap',   'HomeCraft Dish Soap 750ml',          35.00, 120),
--     (4, 'HMC-MOP-002', 'Mop',         'HomeCraft Easy-Wring Mop',          120.00, 40),
--     (5, 'GLW-SHP-001', 'Shampoo',     'GlowUp Moisture Shampoo 400ml',      65.00, 90),
--     (5, 'GLW-FCR-002', 'Face Cream',  'GlowUp Anti-Ageing Cream 50ml',     180.00, 35);

-- =============================================================================
--  VERIFICATION QUERIES
--  Run these after starting the server to verify the database was seeded.
-- =============================================================================

-- 1. Check all tables exist
SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;

-- 2. Check customer count (expected: 55)
SELECT COUNT(*) AS CustomerCount FROM Customers;

-- 3. Check store count (expected: 22)
SELECT COUNT(*) AS StoreCount FROM Stores;

-- 4. Check order count (expected: 5200)
SELECT COUNT(*) AS OrderCount FROM SalesOrders;

-- 5. Check receipt count (expected: ~4800)
SELECT COUNT(*) AS ReceiptCount FROM Receipts;

-- 6. Check disabled customers (expected: 3 — IDs 5, 18, 33)
SELECT CustomerID, FullName, AccountStatus
FROM Customers
WHERE AccountStatus = 'Disabled';

-- 7. Check low-balance account (expected: PointsBalance = 5.00 for CustomerID 10)
SELECT la.AccountID, la.PointsBalance, c.FullName
FROM LoyaltyAccounts la
JOIN Customers c ON la.CustomerID = c.CustomerID
WHERE la.CustomerID = 10;

-- =============================================================================
--  SUMMARY
-- =============================================================================
--  Tables:       10  (Suppliers, Customers, Stores, LoyaltyAccounts, Products,
--                     Discounts, SalesOrders, Receipts, Returns, AuditLog)
--  Customers:    55  (3 Admin, 22 StoreManager, 30 Customer — 3 Disabled, 1 Suspended)
--  Stores:       22  (including Pending, Suspended, Deactivated states)
--  Products:     12  (across 5 suppliers)
--  Discounts:    37  (3 tiers × 12 products + 1 duplicate)
--  SalesOrders:  5,200  (with ~400 ghost entries, duplicates, mixed statuses)
--  Receipts:     ~4,800 (with ~200 expired)
--  Returns:      12  (with intentional math errors)
--
--  Embedded defects for QE discovery:
--   1. REAL used for financial columns (rounding errors)
--   2. No balance validation in processSale
--   3. No AccountStatus check before transactions
--   4. No transaction wrapping in processSale
--   5. Ghost orders (account deductions without receipt records)
--   6. Duplicate OrderReference values
--   7. Invalid phone number formats on 3 customers
--   8. Duplicate discount rule (ProductID 2 / Standard)
--   9. Return math discrepancies (rows 11, 12)
--  10. Expired receipts returned without filtering
-- =============================================================================
