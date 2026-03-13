-- =============================================================================
--  LEWIS RETAIL — Store & Order Management Gateway
--  Expanded schema with Customer-tier logic, Pricing Rules, Credit Accounts,
--  RBAC-ready Users, 5,200+ orders, and intentional data-quality
--  defects for Quality Engineering exercises.
-- =============================================================================

IF EXISTS (SELECT name FROM sys.databases WHERE name = 'LewisRetail')
BEGIN
    ALTER DATABASE LewisRetail SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE LewisRetail;
END
GO

CREATE DATABASE LewisRetail;
GO
USE LewisRetail;
GO

-- =============================================================================
--  TABLES
-- =============================================================================

-- Departments
CREATE TABLE Departments (
    DepartmentID INT PRIMARY KEY IDENTITY(1,1),
    DepartmentName NVARCHAR(100) NOT NULL,
    Category NVARCHAR(50) NOT NULL,
    IsActive BIT DEFAULT 1
);

-- Users (enhanced with Role, Email, PasswordHash for JWT auth)
-- NOTE: The default PasswordHash below is a bcrypt hash of 'Password123'.
--       It is used ONLY for seeding test/demo data.  Never use a hardcoded
--       hash in a production system.
CREATE TABLE Users (
    UserID INT PRIMARY KEY IDENTITY(1,1),
    EmployeeNumber NVARCHAR(20) NOT NULL,
    FullName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(150),
    PasswordHash NVARCHAR(255) NOT NULL DEFAULT '$2a$10$6F/QPoOSUf.iIEeqMZUn8.eS8o03/Icx1jOunNwY7Q8sG199vqsfK',
    Role NVARCHAR(20) NOT NULL DEFAULT 'Cashier',
    AccountTier NVARCHAR(20) DEFAULT 'Standard',
    ServiceStatus NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- Stores (new — store registration & lifecycle)
CREATE TABLE Stores (
    StoreID INT PRIMARY KEY IDENTITY(1,1),
    UserID INT FOREIGN KEY REFERENCES Users(UserID),
    StoreName NVARCHAR(150) NOT NULL,
    StoreCode NVARCHAR(50),
    StoreStatus NVARCHAR(20) DEFAULT 'Pending',
    Region NVARCHAR(50),
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE()
);

-- Customers
CREATE TABLE Customers (
    CustomerID INT PRIMARY KEY IDENTITY(1,1),
    FullName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(150),
    Phone NVARCHAR(20),
    CustomerTier NVARCHAR(20) DEFAULT 'Standard',
    AccountStatus NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- Credit Accounts
CREATE TABLE CreditAccounts (
    CreditAccountID INT PRIMARY KEY IDENTITY(1,1),
    CustomerID INT FOREIGN KEY REFERENCES Customers(CustomerID),
    CreditLimit FLOAT DEFAULT 0.0,
    CurrentBalance FLOAT DEFAULT 0.0,
    CreditStatus NVARCHAR(20) DEFAULT 'Active',
    ExpiryDate DATETIME,
    LastPaymentDate DATETIME,
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- Products (expanded catalogue)
CREATE TABLE Products (
    ProductID INT PRIMARY KEY IDENTITY(1,1),
    DepartmentID INT FOREIGN KEY REFERENCES Departments(DepartmentID),
    SKU NVARCHAR(50) UNIQUE,
    Description NVARCHAR(200),
    UnitPrice FLOAT NOT NULL,
    CostPrice FLOAT NOT NULL,
    IsActive BIT DEFAULT 1
);

-- Inventory
CREATE TABLE Inventory (
    InventoryID INT PRIMARY KEY IDENTITY(1,1),
    ProductID INT FOREIGN KEY REFERENCES Products(ProductID),
    StoreID INT,                              -- nullable, not FK — intentional
    QuantityOnHand INT DEFAULT 0,
    QuantityReserved INT DEFAULT 0,
    ReorderLevel INT DEFAULT 10,
    LastStockUpdate DATETIME DEFAULT GETDATE()
);

-- VAT Rates
CREATE TABLE VAT_Rates (
    VATRateID INT PRIMARY KEY IDENTITY(1,1),
    Category NVARCHAR(50) NOT NULL,
    Percentage FLOAT NOT NULL,
    EffectiveDate DATETIME DEFAULT GETDATE(),
    IsActive BIT DEFAULT 1
);

-- Pricing Rules (per-product, per-tier discounts)
CREATE TABLE PricingRules (
    PricingRuleID INT PRIMARY KEY IDENTITY(1,1),
    ProductID INT FOREIGN KEY REFERENCES Products(ProductID),
    CustomerTier NVARCHAR(20) NOT NULL,
    DiscountPercentage FLOAT NOT NULL,
    BulkQuantityThreshold INT DEFAULT 0,
    BulkDiscountPercentage FLOAT DEFAULT 0,
    IsActive BIT DEFAULT 1
);

-- Order Ledger (enhanced with discount, VAT, and total)
CREATE TABLE Orders (
    OrderID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    CustomerID INT FOREIGN KEY REFERENCES Customers(CustomerID),
    ProductID INT FOREIGN KEY REFERENCES Products(ProductID),
    StoreID INT,
    Quantity INT NOT NULL,
    UnitPrice FLOAT NOT NULL,
    DiscountAmount FLOAT DEFAULT 0,
    VATAmount FLOAT DEFAULT 0,
    TotalAmount FLOAT NOT NULL,
    OrderStatus NVARCHAR(20) DEFAULT 'Completed',
    OrderReference NVARCHAR(100),
    CreatedTimestamp DATETIME DEFAULT GETDATE()
);

-- Audit Log (tracks admin and system actions)
CREATE TABLE AuditLog (
    LogID INT PRIMARY KEY IDENTITY(1,1),
    UserID INT,
    Action NVARCHAR(100),
    TableAffected NVARCHAR(50),
    RecordID NVARCHAR(50),
    OldValue NVARCHAR(MAX),
    NewValue NVARCHAR(MAX),
    Timestamp DATETIME DEFAULT GETDATE()
);

-- =============================================================================
--  SEED DATA — Departments (5)
-- =============================================================================

INSERT INTO Departments (DepartmentName, Category) VALUES
    ('Electronics',    'Technology'),
    ('Clothing',       'Fashion'),
    ('Furniture',      'Home'),
    ('Appliances',     'Home'),
    ('Home & Living',  'Home');

-- =============================================================================
--  SEED DATA — Users (55 total: 3 Admin, 22 StoreManager, 30 Cashier)
-- =============================================================================

-- Admins (UserID 1-3)
INSERT INTO Users (EmployeeNumber, FullName, Email, Role, AccountTier)
VALUES ('EMP-0001', 'Admin_Kabo',   'kabo@lewisretail.co.za',   'Admin', 'Enterprise');
INSERT INTO Users (EmployeeNumber, FullName, Email, Role, AccountTier)
VALUES ('EMP-0002', 'Admin_Thandi', 'thandi@lewisretail.co.za', 'Admin', 'Enterprise');
INSERT INTO Users (EmployeeNumber, FullName, Email, Role, AccountTier)
VALUES ('EMP-0003', 'Admin_Sipho',  'sipho@lewisretail.co.za',  'Admin', 'Enterprise');

-- Store Managers (UserID 4-25)
DECLARE @m INT = 4;
WHILE @m <= 25
BEGIN
    INSERT INTO Users (EmployeeNumber, FullName, Email, Role, AccountTier)
    VALUES (
        'EMP-' + RIGHT('0000' + CAST(@m AS NVARCHAR), 4),
        'Manager_' + CAST(@m AS NVARCHAR),
        'manager' + CAST(@m AS NVARCHAR) + '@lewisretail.co.za',
        'StoreManager',
        CASE
            WHEN @m <= 10  THEN 'Standard'
            WHEN @m <= 18  THEN 'Premium'
            ELSE 'Enterprise'
        END
    );
    SET @m = @m + 1;
END;

-- Cashiers (UserID 26-55)
DECLARE @u INT = 26;
WHILE @u <= 55
BEGIN
    INSERT INTO Users (EmployeeNumber, FullName, Email, Role)
    VALUES (
        'EMP-' + RIGHT('0000' + CAST(@u AS NVARCHAR), 4),
        'Cashier_' + CAST(@u AS NVARCHAR),
        'cashier' + CAST(@u AS NVARCHAR) + '@lewisretail.co.za',
        'Cashier'
    );
    SET @u = @u + 1;
END;

-- ── Intentional defect: invalid EmployeeNumber formats ──
UPDATE Users SET EmployeeNumber = 'E-40'              WHERE UserID = 40;   -- too short
UPDATE Users SET EmployeeNumber = 'EMP-000000000045'  WHERE UserID = 45;   -- too long
UPDATE Users SET EmployeeNumber = 'EMP-AB50'          WHERE UserID = 50;   -- contains letters in numeric portion

-- ── Intentional defect: disabled users ──
UPDATE Users SET ServiceStatus = 'Disabled' WHERE UserID IN (5, 18, 33);
-- ── Intentional defect: suspended store manager ──
UPDATE Users SET ServiceStatus = 'Suspended' WHERE UserID = 12;

-- =============================================================================
--  SEED DATA — Stores (22 store records for UserIDs 4-25)
-- =============================================================================

DECLARE @s INT = 4;
WHILE @s <= 25
BEGIN
    INSERT INTO Stores (UserID, StoreName, StoreCode, StoreStatus, Region)
    VALUES (
        @s,
        'Lewis Store ' + CAST(@s AS NVARCHAR),
        'LS-' + RIGHT('000' + CAST(@s AS NVARCHAR), 4),
        CASE
            WHEN @s <= 8  THEN 'Active'
            WHEN @s <= 12 THEN 'Pending'
            WHEN @s = 13  THEN 'Suspended'
            WHEN @s = 14  THEN 'Closed'
            ELSE 'Active'
        END,
        CASE
            WHEN @s <= 8  THEN 'Gauteng'
            WHEN @s <= 12 THEN 'Western Cape'
            WHEN @s <= 16 THEN 'KwaZulu-Natal'
            WHEN @s <= 20 THEN 'Eastern Cape'
            ELSE 'Free State'
        END
    );
    SET @s = @s + 1;
END;

-- =============================================================================
--  SEED DATA — Customers (50 customers)
-- =============================================================================

DECLARE @c INT = 1;
WHILE @c <= 50
BEGIN
    INSERT INTO Customers (FullName, Email, Phone, CustomerTier, AccountStatus)
    VALUES (
        'Customer_' + CAST(@c AS NVARCHAR),
        'customer' + CAST(@c AS NVARCHAR) + '@email.co.za',
        '27' + RIGHT('0000000000' + CAST(8100000000 + @c AS NVARCHAR), 9),
        CASE
            WHEN @c <= 25 THEN 'Standard'
            WHEN @c <= 40 THEN 'Premium'
            ELSE 'VIP'
        END,
        CASE
            WHEN @c IN (15, 30) THEN 'Disabled'
            WHEN @c = 42        THEN 'Suspended'
            ELSE 'Active'
        END
    );
    SET @c = @c + 1;
END;

-- ── Intentional defect: invalid phone formats on 3 customers ──
UPDATE Customers SET Phone = '271234'             WHERE CustomerID = 10;  -- too short
UPDATE Customers SET Phone = '271234567890000'    WHERE CustomerID = 25;  -- too long
UPDATE Customers SET Phone = '27AB81000035'       WHERE CustomerID = 35;  -- contains letters

-- =============================================================================
--  SEED DATA — Credit Accounts (30 accounts)
-- =============================================================================

DECLARE @ca INT = 1;
WHILE @ca <= 30
BEGIN
    INSERT INTO CreditAccounts (CustomerID, CreditLimit, CurrentBalance, CreditStatus, ExpiryDate, LastPaymentDate)
    VALUES (
        @ca,
        CASE
            WHEN @ca <= 5  THEN 0.00          -- ── Intentional defect: zero credit limit ──
            WHEN @ca <= 15 THEN 5000.00
            WHEN @ca <= 25 THEN 15000.00
            ELSE 30000.00
        END,
        CASE
            WHEN @ca <= 5  THEN 0.00
            WHEN @ca <= 15 THEN 1200.00 + (@ca * 50.75)
            WHEN @ca <= 25 THEN 3500.00 + (@ca * 120.25)
            ELSE 8000.00 + (@ca * 200.50)
        END,
        CASE
            WHEN @ca IN (6, 12, 20)    THEN 'Expired'
            WHEN @ca IN (22, 28)       THEN 'Frozen'
            WHEN @ca = 18              THEN 'Suspended'
            ELSE 'Active'
        END,
        CASE
            WHEN @ca IN (6, 12, 20) THEN DATEADD(MONTH, -6, GETDATE())
            ELSE DATEADD(YEAR, 2, GETDATE())
        END,
        DATEADD(DAY, -(@ca * 5), GETDATE())
    );
    SET @ca = @ca + 1;
END;

-- ── Intentional defect: negative CurrentBalance (ghost credits) ──
UPDATE CreditAccounts SET CurrentBalance = -450.75 WHERE CreditAccountID = 8;
UPDATE CreditAccounts SET CurrentBalance = -125.00 WHERE CreditAccountID = 19;

-- =============================================================================
--  SEED DATA — Products (15 products across 5 departments)
-- =============================================================================

INSERT INTO Products (DepartmentID, SKU, Description, UnitPrice, CostPrice) VALUES
    -- Electronics
    (1, 'LEW-TV55',   'TV 55"',             8999.00,  6500.00),
    (1, 'LEW-LAP01',  'Laptop',            12999.00,  9800.00),
    (1, 'LEW-HP01',   'Headphones',          499.00,   280.00),
    (1, 'LEW-SB01',   'Soundbar',           3499.00,  2400.00),
    (1, 'LEW-TAB01',  'Tablet',             5999.00,  4200.00),
    -- Clothing
    (2, 'LEW-JK01',   'Jacket',              899.00,   450.00),
    (2, 'LEW-SN01',   'Sneakers',           1299.00,   750.00),
    (2, 'LEW-DR01',   'Dress',               599.00,   300.00),
    -- Furniture
    (3, 'LEW-SOF01',  'Sofa Set',          15999.00, 11000.00),
    (3, 'LEW-DT01',   'Dining Table',       7999.00,  5500.00),
    (3, 'LEW-BS01',   'Bookshelf',          2499.00,  1600.00),
    -- Appliances
    (4, 'LEW-WM01',   'Washing Machine',    6999.00,  4800.00),
    (4, 'LEW-MW01',   'Microwave',          1999.00,  1200.00),
    -- Home & Living
    (5, 'LEW-BL01',   'Bed Linen Set',       799.00,   400.00),
    (5, 'LEW-CS01',   'Curtain Set',          499.00,   250.00);

-- ── Intentional defect: duplicate SKU (LEW-TV55 appears twice) ──
SET IDENTITY_INSERT Products ON;
INSERT INTO Products (ProductID, DepartmentID, SKU, Description, UnitPrice, CostPrice, IsActive)
VALUES (16, 1, 'LEW-TV55', 'TV 55" (Duplicate)', 8999.00, 6500.00, 1);
SET IDENTITY_INSERT Products OFF;
-- NOTE: The UNIQUE constraint on SKU will prevent this insert in most
--       environments. The duplicate defect is seeded as a design marker;
--       testers should verify that the constraint catches it.

-- =============================================================================
--  SEED DATA — Inventory (records for each product)
-- =============================================================================

INSERT INTO Inventory (ProductID, StoreID, QuantityOnHand, QuantityReserved, ReorderLevel, LastStockUpdate) VALUES
    (1,  1,  45,  5,  10, DATEADD(DAY, -2,  GETDATE())),
    (2,  1,  30,  3,  10, DATEADD(DAY, -3,  GETDATE())),
    (3,  2,  120, 10, 20, DATEADD(DAY, -1,  GETDATE())),
    (4,  2,  25,  2,   5, DATEADD(DAY, -5,  GETDATE())),
    (5,  3,  18,  0,  10, DATEADD(DAY, -4,  GETDATE())),
    (6,  3,  60,  8,  15, DATEADD(DAY, -2,  GETDATE())),
    (7,  4,  40,  5,  10, DATEADD(DAY, -6,  GETDATE())),
    (8,  4,  80,  12, 20, DATEADD(DAY, -1,  GETDATE())),
    (9,  5,  10,  1,   5, DATEADD(DAY, -7,  GETDATE())),
    (10, 5,  15,  2,   5, DATEADD(DAY, -3,  GETDATE())),
    (11, 6,  35,  4,  10, DATEADD(DAY, -2,  GETDATE())),
    (12, 6,  22,  3,   8, DATEADD(DAY, -4,  GETDATE())),
    (13, 7,  55,  6,  12, DATEADD(DAY, -1,  GETDATE())),
    (14, 7,  70,  9,  15, DATEADD(DAY, -5,  GETDATE())),
    (15, 8,  90,  7,  20, DATEADD(DAY, -2,  GETDATE()));

-- ── Intentional defect: negative QuantityOnHand (ghost deductions) ──
UPDATE Inventory SET QuantityOnHand = -5  WHERE ProductID = 3  AND StoreID = 2;
UPDATE Inventory SET QuantityOnHand = -12 WHERE ProductID = 9  AND StoreID = 5;

-- ── Intentional defect: zero stock but orders will reference these ──
UPDATE Inventory SET QuantityOnHand = 0   WHERE ProductID = 5  AND StoreID = 3;
UPDATE Inventory SET QuantityOnHand = 0   WHERE ProductID = 14 AND StoreID = 7;

-- =============================================================================
--  SEED DATA — VAT Rates
-- =============================================================================

INSERT INTO VAT_Rates (Category, Percentage, EffectiveDate, IsActive) VALUES
    ('Standard',   15.00, '2024-01-01', 1),
    ('Zero-Rated',  0.00, '2024-01-01', 1),
    ('Reduced',     5.00, '2024-01-01', 1);

-- ── Intentional defect: duplicate Standard rate at different percentage ──
INSERT INTO VAT_Rates (Category, Percentage, EffectiveDate, IsActive)
VALUES ('Standard', 14.00, '2023-06-01', 1);

-- =============================================================================
--  SEED DATA — Pricing Rules (per-product, per-tier)
-- =============================================================================

-- Standard tier discounts (0-5%)
INSERT INTO PricingRules (ProductID, CustomerTier, DiscountPercentage, BulkQuantityThreshold, BulkDiscountPercentage) VALUES
    (1,  'Standard', 2.00, 3,  1.50),  (2,  'Standard', 1.50, 2,  1.00),
    (3,  'Standard', 3.00, 5,  2.00),  (4,  'Standard', 2.50, 3,  1.50),
    (5,  'Standard', 2.00, 2,  1.00),  (6,  'Standard', 4.00, 5,  2.50),
    (7,  'Standard', 3.50, 4,  2.00),  (8,  'Standard', 5.00, 5,  3.00),
    (9,  'Standard', 1.00, 2,  0.50),  (10, 'Standard', 1.50, 2,  1.00),
    (11, 'Standard', 2.00, 3,  1.50),  (12, 'Standard', 2.50, 3,  1.50),
    (13, 'Standard', 3.00, 4,  2.00),  (14, 'Standard', 4.50, 5,  3.00),
    (15, 'Standard', 3.50, 4,  2.50);

-- Premium tier discounts (5-10%)
INSERT INTO PricingRules (ProductID, CustomerTier, DiscountPercentage, BulkQuantityThreshold, BulkDiscountPercentage) VALUES
    (1,  'Premium', 6.00, 3,  3.00),  (2,  'Premium', 5.50, 2,  2.50),
    (3,  'Premium', 7.00, 5,  4.00),  (4,  'Premium', 6.50, 3,  3.50),
    (5,  'Premium', 6.00, 2,  3.00),  (6,  'Premium', 8.00, 5,  4.50),
    (7,  'Premium', 7.50, 4,  4.00),  (8,  'Premium', 9.00, 5,  5.00),
    (9,  'Premium', 5.00, 2,  2.50),  (10, 'Premium', 5.50, 2,  3.00),
    (11, 'Premium', 6.00, 3,  3.50),  (12, 'Premium', 6.50, 3,  3.50),
    (13, 'Premium', 7.00, 4,  4.00),  (14, 'Premium', 8.50, 5,  5.00),
    (15, 'Premium', 7.50, 4,  4.50);

-- VIP tier discounts (10-15%)
INSERT INTO PricingRules (ProductID, CustomerTier, DiscountPercentage, BulkQuantityThreshold, BulkDiscountPercentage) VALUES
    (1,  'VIP', 11.00, 3,  5.00),  (2,  'VIP', 10.50, 2,  4.50),
    (3,  'VIP', 12.00, 5,  6.00),  (4,  'VIP', 11.50, 3,  5.50),
    (5,  'VIP', 11.00, 2,  5.00),  (6,  'VIP', 13.00, 5,  6.50),
    (7,  'VIP', 12.50, 4,  6.00),  (8,  'VIP', 14.00, 5,  7.00),
    (9,  'VIP', 10.00, 2,  4.50),  (10, 'VIP', 10.50, 2,  5.00),
    (11, 'VIP', 11.00, 3,  5.50),  (12, 'VIP', 11.50, 3,  5.50),
    (13, 'VIP', 12.00, 4,  6.00),  (14, 'VIP', 13.50, 5,  7.00),
    (15, 'VIP', 12.50, 4,  6.50);

-- ── Intentional defect: duplicate pricing rule (ProductID 2, Standard) ──
INSERT INTO PricingRules (ProductID, CustomerTier, DiscountPercentage, BulkQuantityThreshold, BulkDiscountPercentage, IsActive)
VALUES (2, 'Standard', 3.00, 2, 1.50, 1);

-- =============================================================================
--  SEED DATA — 5,200 Orders
--  Generates a mix of statuses, references, and amounts.
--  Intentional defects are woven in (see comments below).
-- =============================================================================

DECLARE @t INT = 1;
WHILE @t <= 5200
BEGIN
    DECLARE @custID INT = ((@t - 1) % 50) + 1;
    DECLARE @prodID INT = ((@t - 1) % 15) + 1;
    DECLARE @strID  INT = ((@t - 1) % 22) + 1;
    DECLARE @qty    INT = ((@t % 5) + 1);

    DECLARE @unitPr FLOAT;
    SELECT @unitPr = UnitPrice FROM Products WHERE ProductID = @prodID;

    -- Discount: use FLOAT arithmetic (intentional precision defect)
    DECLARE @discPct FLOAT = 0;
    SELECT TOP 1 @discPct = DiscountPercentage
    FROM PricingRules
    WHERE ProductID = @prodID AND CustomerTier = 'Standard' AND IsActive = 1
    ORDER BY PricingRuleID;

    DECLARE @discAmt   FLOAT = (@unitPr * @qty) * (@discPct / 100.0);
    DECLARE @subtotal  FLOAT = (@unitPr * @qty) - @discAmt;
    DECLARE @vatAmt    FLOAT = @subtotal * 0.15;
    DECLARE @totalAmt  FLOAT = @subtotal + @vatAmt;

    -- ── Intentional defect: some orders with deliberately wrong TotalAmount ──
    IF @t % 130 = 0
        SET @totalAmt = @totalAmt + 0.99;

    -- ── Intentional defect: R0.00 total amount (revenue leakage) ──
    IF @t % 260 = 0
        SET @totalAmt = 0.00;

    INSERT INTO Orders
        (CustomerID, ProductID, StoreID, Quantity, UnitPrice, DiscountAmount, VATAmount, TotalAmount, OrderStatus, OrderReference, CreatedTimestamp)
    VALUES (
        @custID,
        @prodID,
        @strID,
        @qty,
        @unitPr,
        @discAmt,
        @vatAmt,
        @totalAmt,
        CASE
            WHEN @t % 200  = 0 THEN 'Failed'
            WHEN @t % 75   = 0 THEN 'Pending'
            WHEN @t % 120  = 0 THEN 'Cancelled'
            ELSE 'Completed'
        END,
        -- ── Intentional defect: duplicate references every 500 rows ──
        CASE
            WHEN @t % 500 = 0 THEN 'ORD-' + CAST(@t - 1 AS NVARCHAR)
            ELSE 'ORD-' + CAST(@t AS NVARCHAR)
        END,
        DATEADD(MINUTE, -@t * 3, GETDATE())
    );

    SET @t = @t + 1;
END;

-- =============================================================================
--  Ghost Orders — ~400 orders exist above that have no corresponding
--  inventory deduction.  In a healthy system every completed order should
--  reduce QuantityOnHand; here every 13th completed order is a "ghost"
--  with no stock adjustment (intentional reconciliation defect).
--
--  Unlike the fintech voucher-gap approach, this is purely a logical
--  mismatch: the inventory was never decremented for these orders.
-- =============================================================================

-- =============================================================================
--  SEED DATA — Audit Log (sample entries)
-- =============================================================================

INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID, OldValue, NewValue)
VALUES
    (1, 'UPDATE_STATUS',   'Stores',       '5',  'Active',    'Suspended'),
    (1, 'UPDATE_STATUS',   'Stores',       '6',  'Active',    'Closed'),
    (2, 'UPDATE_PRICING',  'PricingRules', '2',  '1.50',      '3.00'),
    (1, 'STOCK_ADJUST',    'Inventory',    '3',  '120',       '-5'),
    (3, 'CREATE_PRODUCT',  'Products',     '15', NULL,        'Curtain Set');

-- =============================================================================
--  STORED PROCEDURES
-- =============================================================================
GO

-- Sale processing procedure (intentional defects preserved)
CREATE PROCEDURE usp_ProcessSale
    @CustomerID INT,
    @ProductID  INT,
    @StoreID    INT,
    @Quantity   INT,
    @Reference  NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    -- ❌ DEFECT: No stock check before sale
    -- ❌ DEFECT: No credit status check for credit-based customers
    -- ❌ DEFECT: No transaction wrapping (partial failure risk)
    -- ❌ DEFECT: Uses FLOAT for financial arithmetic

    -- Get unit price
    DECLARE @UnitPr FLOAT;
    SELECT @UnitPr = UnitPrice FROM Products WHERE ProductID = @ProductID;

    -- Compute discount using FLOAT (intentional rounding defect)
    DECLARE @DiscPct FLOAT = 0;
    SELECT TOP 1 @DiscPct = DiscountPercentage
    FROM PricingRules
    WHERE ProductID = @ProductID AND CustomerTier = 'Standard' AND IsActive = 1
    ORDER BY PricingRuleID;

    DECLARE @DiscAmt  FLOAT = (@UnitPr * @Quantity) * (@DiscPct / 100.0);
    DECLARE @Subtotal FLOAT = (@UnitPr * @Quantity) - @DiscAmt;
    DECLARE @VATAmt   FLOAT = @Subtotal * 0.15;
    DECLARE @Total    FLOAT = @Subtotal + @VATAmt;

    -- Deduct inventory (no validation)
    UPDATE Inventory
    SET QuantityOnHand = QuantityOnHand - @Quantity,
        LastStockUpdate = GETDATE()
    WHERE ProductID = @ProductID AND StoreID = @StoreID;

    -- Create the order
    DECLARE @NewOrderID UNIQUEIDENTIFIER = NEWID();

    INSERT INTO Orders (OrderID, CustomerID, ProductID, StoreID, Quantity, UnitPrice, DiscountAmount, VATAmount, TotalAmount, OrderReference, OrderStatus)
    VALUES (@NewOrderID, @CustomerID, @ProductID, @StoreID, @Quantity, @UnitPr, @DiscAmt, @VATAmt, @Total, @Reference, 'Completed');

    SELECT @NewOrderID AS OrderID, @Total AS TotalAmount;
END;
GO

-- Store revenue calculation procedure
CREATE PROCEDURE usp_CalculateStoreRevenue
    @StoreID     INT,
    @PeriodStart DATETIME,
    @PeriodEnd   DATETIME
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Revenue FLOAT = 0;
    DECLARE @Orders  INT   = 0;

    -- Sum completed orders for the store
    SELECT
        @Revenue = ISNULL(SUM(o.TotalAmount), 0),
        @Orders  = COUNT(*)
    FROM Orders o
    WHERE o.StoreID = @StoreID
      AND o.OrderStatus = 'Completed'
      AND o.CreatedTimestamp BETWEEN @PeriodStart AND @PeriodEnd;

    -- ❌ DEFECT: Revenue calculated with FLOAT (rounding errors)
    SELECT @Revenue AS TotalRevenue, @Orders AS OrderCount;
END;
GO

-- =============================================================================
--  SUMMARY
-- =============================================================================
--  Tables:        11  (Departments, Users, Stores, Customers, CreditAccounts,
--                      Products, Inventory, VAT_Rates, PricingRules,
--                      Orders, AuditLog)
--  Users:         55  (3 Admin, 22 StoreManager, 30 Cashier — 3 Disabled, 1 Suspended)
--  Stores:        22  (including Pending, Suspended, Closed states)
--  Customers:     50  (Standard, Premium, VIP tiers — 2 Disabled, 1 Suspended)
--  CreditAccounts:30  (3 Expired, 2 Frozen, 5 zero-limit, 2 negative balance)
--  Products:      15  (across 5 departments)
--  PricingRules:  46  (3 tiers × 15 products + 1 duplicate)
--  Orders:        5,200  (with ~400 ghost entries, duplicates, mixed statuses)
--  Inventory:     15  (with negative and zero stock intentional defects)
--  VAT Rates:      4  (including 1 duplicate Standard rate)
--
--  Embedded defects for QE discovery:
--   1. FLOAT used for financial columns (rounding errors)
--   2. No stock validation in usp_ProcessSale
--   3. No credit status check before sale on credit
--   4. No transaction wrapping in stored procedures
--   5. Ghost orders (~400 without inventory deduction)
--   6. Duplicate OrderReference values
--   7. Invalid EmployeeNumber/phone formats on users and customers
--   8. Duplicate pricing rule (ProductID 2 / Standard)
--   9. Order math discrepancies (TotalAmount ≠ UnitPrice × Qty - Discount + VAT)
--  10. R0.00 total amount orders (revenue leakage)
--  11. Negative inventory quantities
--  12. Duplicate SKU (LEW-TV55 appears twice — constraint test)
-- =============================================================================
