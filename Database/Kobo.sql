-- =============================================================================
--  KOBO FINTECH — Merchant & Settlement Gateway
--  Expanded schema with Merchant-tier logic, Commissions, Settlements,
--  RBAC-ready Users, 5 000+ transactions, and intentional data-quality
--  defects for Quality Engineering exercises.
-- =============================================================================

IF EXISTS (SELECT name FROM sys.databases WHERE name = 'KoboFintech')
BEGIN
    ALTER DATABASE KoboFintech SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE KoboFintech;
END
GO

CREATE DATABASE KoboFintech;
GO
USE KoboFintech;
GO

-- =============================================================================
--  TABLES
-- =============================================================================

-- Service Providers
CREATE TABLE ServiceProviders (
    ProviderID INT PRIMARY KEY IDENTITY(1,1),
    ProviderName NVARCHAR(100) NOT NULL,
    Category NVARCHAR(50) NOT NULL,
    IsActive BIT DEFAULT 1
);

-- Users (enhanced with Role, Email, PasswordHash for JWT auth)
CREATE TABLE Users (
    UserID INT PRIMARY KEY IDENTITY(1,1),
    MSISDN NVARCHAR(20) NOT NULL,
    FullName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(150),
    PasswordHash NVARCHAR(255) NOT NULL DEFAULT '$2a$10$6F/QPoOSUf.iIEeqMZUn8.eS8o03/Icx1jOunNwY7Q8sG199vqsfK',
    Role NVARCHAR(20) NOT NULL DEFAULT 'User',
    AccountTier NVARCHAR(20) DEFAULT 'Standard',
    ServiceStatus NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- Merchants (new — business registration & lifecycle)
CREATE TABLE Merchants (
    MerchantID INT PRIMARY KEY IDENTITY(1,1),
    UserID INT FOREIGN KEY REFERENCES Users(UserID),
    BusinessName NVARCHAR(150) NOT NULL,
    RegistrationNumber NVARCHAR(50),
    MerchantStatus NVARCHAR(20) DEFAULT 'Pending',
    MerchantTier NVARCHAR(20) DEFAULT 'Standard',
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE()
);

-- Wallets
CREATE TABLE Wallets (
    WalletID INT PRIMARY KEY IDENTITY(1,1),
    UserID INT FOREIGN KEY REFERENCES Users(UserID),
    Balance FLOAT DEFAULT 0.0,
    CurrencyCode CHAR(3) DEFAULT 'ZAR',
    LastUpdated DATETIME DEFAULT GETDATE()
);

-- Products (expanded catalogue)
CREATE TABLE Products (
    ProductID INT PRIMARY KEY IDENTITY(1,1),
    ProviderID INT FOREIGN KEY REFERENCES ServiceProviders(ProviderID),
    SKU NVARCHAR(50) UNIQUE,
    Description NVARCHAR(200),
    FaceValue FLOAT NOT NULL,
    IsActive BIT DEFAULT 1
);

-- Commissions (new — per-product, per-tier percentage)
CREATE TABLE Commissions (
    CommissionID INT PRIMARY KEY IDENTITY(1,1),
    ProductID INT FOREIGN KEY REFERENCES Products(ProductID),
    MerchantTier NVARCHAR(20) NOT NULL,
    CommissionPercentage FLOAT NOT NULL,
    EffectiveDate DATETIME DEFAULT GETDATE(),
    IsActive BIT DEFAULT 1
);

-- Transaction Ledger (enhanced with CommissionAmount)
CREATE TABLE TransactionLedger (
    EntryID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    WalletID INT FOREIGN KEY REFERENCES Wallets(WalletID),
    ProductID INT FOREIGN KEY REFERENCES Products(ProductID),
    Amount FLOAT NOT NULL,
    CommissionAmount FLOAT DEFAULT 0,
    ExternalReference NVARCHAR(100),
    ProcessingStatus NVARCHAR(20) DEFAULT 'Completed',
    CreatedTimestamp DATETIME DEFAULT GETDATE()
);

-- Digital Vouchers
CREATE TABLE DigitalVouchers (
    VoucherID INT PRIMARY KEY IDENTITY(1,1),
    EntryID UNIQUEIDENTIFIER FOREIGN KEY REFERENCES TransactionLedger(EntryID),
    PinData NVARCHAR(255) NOT NULL,
    ExpiryDate DATETIME NOT NULL
);

-- Settlements (new — merchant settlement records)
CREATE TABLE Settlements (
    SettlementID INT PRIMARY KEY IDENTITY(1,1),
    MerchantID INT FOREIGN KEY REFERENCES Merchants(MerchantID),
    PeriodStart DATETIME NOT NULL,
    PeriodEnd DATETIME NOT NULL,
    GrossAmount FLOAT DEFAULT 0,
    CommissionAmount FLOAT DEFAULT 0,
    NetAmount FLOAT DEFAULT 0,
    SettlementStatus NVARCHAR(20) DEFAULT 'Pending',
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- Audit Log (new — tracks admin and system actions)
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
--  SEED DATA — Service Providers (5)
-- =============================================================================

INSERT INTO ServiceProviders (ProviderName, Category) VALUES
    ('MTN',      'Mobile'),
    ('Vodacom',  'Mobile'),
    ('Eskom',    'Utility'),
    ('Telkom',   'Mobile'),
    ('CellC',    'Mobile');

-- =============================================================================
--  SEED DATA — Users (55 total: 3 Admin, 22 Merchant, 30 User)
-- =============================================================================

-- Admins (UserID 1-3)
INSERT INTO Users (MSISDN, FullName, Email, Role, AccountTier)
VALUES ('27110000001', 'Admin_Kabo',   'kabo@kobo.co.za',   'Admin', 'Enterprise');
INSERT INTO Users (MSISDN, FullName, Email, Role, AccountTier)
VALUES ('27110000002', 'Admin_Thandi', 'thandi@kobo.co.za', 'Admin', 'Enterprise');
INSERT INTO Users (MSISDN, FullName, Email, Role, AccountTier)
VALUES ('27110000003', 'Admin_Sipho',  'sipho@kobo.co.za',  'Admin', 'Enterprise');

-- Merchants (UserID 4-25)
DECLARE @m INT = 4;
WHILE @m <= 25
BEGIN
    INSERT INTO Users (MSISDN, FullName, Email, Role, AccountTier)
    VALUES (
        '2771' + RIGHT('0000000' + CAST(1000000 + @m AS NVARCHAR), 7),
        'Merchant_' + CAST(@m AS NVARCHAR),
        'merchant' + CAST(@m AS NVARCHAR) + '@kobo.co.za',
        'Merchant',
        CASE
            WHEN @m <= 10  THEN 'Standard'
            WHEN @m <= 18  THEN 'Premium'
            ELSE 'Enterprise'
        END
    );
    SET @m = @m + 1;
END;

-- Regular users (UserID 26-55)
DECLARE @u INT = 26;
WHILE @u <= 55
BEGIN
    INSERT INTO Users (MSISDN, FullName, Email, Role)
    VALUES (
        '2771' + RIGHT('0000000' + CAST(1000000 + @u AS NVARCHAR), 7),
        'User_' + CAST(@u AS NVARCHAR),
        'user' + CAST(@u AS NVARCHAR) + '@kobo.co.za',
        'User'
    );
    SET @u = @u + 1;
END;

-- ── Intentional defect: invalid MSISDN formats (not 11 digits) ──
UPDATE Users SET MSISDN = '271100004'       WHERE UserID = 40;   -- too short (9 digits)
UPDATE Users SET MSISDN = '2711000005555'   WHERE UserID = 45;   -- too long  (13 digits)
UPDATE Users SET MSISDN = '27AB0000050'     WHERE UserID = 50;   -- contains letters

-- ── Intentional defect: disabled users ──
UPDATE Users SET ServiceStatus = 'Disabled' WHERE UserID IN (5, 18, 33);
-- ── Intentional defect: suspended merchant ──
UPDATE Users SET ServiceStatus = 'Suspended' WHERE UserID = 12;

-- =============================================================================
--  SEED DATA — Merchants (22 merchant records for UserIDs 4-25)
-- =============================================================================

DECLARE @mc INT = 4;
WHILE @mc <= 25
BEGIN
    INSERT INTO Merchants (UserID, BusinessName, RegistrationNumber, MerchantStatus, MerchantTier)
    VALUES (
        @mc,
        'Business_' + CAST(@mc AS NVARCHAR),
        'REG-2024-' + RIGHT('000' + CAST(@mc AS NVARCHAR), 4),
        CASE
            WHEN @mc <= 8  THEN 'Active'
            WHEN @mc <= 12 THEN 'Pending'
            WHEN @mc = 13  THEN 'Suspended'
            WHEN @mc = 14  THEN 'Deactivated'
            ELSE 'Active'
        END,
        CASE
            WHEN @mc <= 10  THEN 'Standard'
            WHEN @mc <= 18  THEN 'Premium'
            ELSE 'Enterprise'
        END
    );
    SET @mc = @mc + 1;
END;

-- =============================================================================
--  SEED DATA — Wallets (55 wallets, one per user)
-- =============================================================================

DECLARE @w INT = 1;
WHILE @w <= 55
BEGIN
    INSERT INTO Wallets (UserID, Balance)
    VALUES (@w, 500.00 + (@w * 15.50));
    SET @w = @w + 1;
END;

-- ── Intentional defect: low-balance wallet for insufficient-funds testing ──
UPDATE Wallets SET Balance = 5.00 WHERE UserID = 10;
-- ── Intentional defect: negative balance (ghost deduction) ──
UPDATE Wallets SET Balance = -12.50 WHERE UserID = 30;

-- =============================================================================
--  SEED DATA — Products (12 products across 5 providers)
-- =============================================================================

INSERT INTO Products (ProviderID, SKU, Description, FaceValue) VALUES
    (1, 'MTN-5',    'MTN R5 Airtime',         5.00),
    (1, 'MTN-10',   'MTN R10 Airtime',        10.00),
    (1, 'MTN-30',   'MTN R30 Airtime',        30.00),
    (2, 'VOD-10',   'Vodacom R10 Airtime',    10.00),
    (2, 'VOD-20',   'Vodacom R20 Airtime',    20.00),
    (2, 'VOD-50',   'Vodacom R50 Airtime',    50.00),
    (3, 'ESK-50',   'Eskom R50 Electricity',  50.00),
    (3, 'ESK-100',  'Eskom R100 Electricity', 100.00),
    (3, 'ESK-200',  'Eskom R200 Electricity', 200.00),
    (4, 'TEL-15',   'Telkom R15 Airtime',     15.00),
    (4, 'TEL-30',   'Telkom R30 Airtime',     30.00),
    (5, 'CEL-25',   'CellC R25 Airtime',      25.00);

-- =============================================================================
--  SEED DATA — Commissions (per-product, per-tier)
-- =============================================================================

-- Standard tier commissions
INSERT INTO Commissions (ProductID, MerchantTier, CommissionPercentage) VALUES
    (1,  'Standard', 5.00),  (2,  'Standard', 5.00),  (3,  'Standard', 5.50),
    (4,  'Standard', 5.00),  (5,  'Standard', 5.00),  (6,  'Standard', 5.50),
    (7,  'Standard', 3.00),  (8,  'Standard', 3.00),  (9,  'Standard', 3.50),
    (10, 'Standard', 4.50),  (11, 'Standard', 4.50),  (12, 'Standard', 4.00);

-- Premium tier commissions
INSERT INTO Commissions (ProductID, MerchantTier, CommissionPercentage) VALUES
    (1,  'Premium', 7.50),  (2,  'Premium', 7.50),  (3,  'Premium', 8.00),
    (4,  'Premium', 7.50),  (5,  'Premium', 7.50),  (6,  'Premium', 8.00),
    (7,  'Premium', 5.00),  (8,  'Premium', 5.00),  (9,  'Premium', 5.50),
    (10, 'Premium', 6.50),  (11, 'Premium', 6.50),  (12, 'Premium', 6.00);

-- Enterprise tier commissions
INSERT INTO Commissions (ProductID, MerchantTier, CommissionPercentage) VALUES
    (1,  'Enterprise', 10.00), (2,  'Enterprise', 10.00), (3,  'Enterprise', 10.50),
    (4,  'Enterprise', 10.00), (5,  'Enterprise', 10.00), (6,  'Enterprise', 10.50),
    (7,  'Enterprise',  7.00), (8,  'Enterprise',  7.00), (9,  'Enterprise',  7.50),
    (10, 'Enterprise',  8.50), (11, 'Enterprise',  8.50), (12, 'Enterprise',  8.00);

-- ── Intentional defect: duplicate commission rule (ProductID 2, Standard) ──
INSERT INTO Commissions (ProductID, MerchantTier, CommissionPercentage, IsActive)
VALUES (2, 'Standard', 6.00, 1);

-- =============================================================================
--  SEED DATA — 5 200 Transactions
--  Generates a mix of statuses, references, and amounts.
--  Intentional defects are woven in (see comments below).
-- =============================================================================

DECLARE @t INT = 1;
WHILE @t <= 5200
BEGIN
    DECLARE @wid INT = ((@t - 1) % 55) + 1;
    DECLARE @pid INT = ((@t - 1) % 12) + 1;

    DECLARE @faceVal FLOAT;
    SELECT @faceVal = FaceValue FROM Products WHERE ProductID = @pid;

    -- Commission: use FLOAT arithmetic (intentional precision defect)
    DECLARE @commPct FLOAT = 0;
    SELECT TOP 1 @commPct = CommissionPercentage
    FROM Commissions
    WHERE ProductID = @pid AND MerchantTier = 'Standard' AND IsActive = 1
    ORDER BY CommissionID;

    DECLARE @commAmt FLOAT = @faceVal * (@commPct / 100.0);

    INSERT INTO TransactionLedger
        (WalletID, ProductID, Amount, CommissionAmount, ExternalReference, ProcessingStatus, CreatedTimestamp)
    VALUES (
        @wid,
        @pid,
        @faceVal,
        @commAmt,
        -- ── Intentional defect: duplicate references every 500 rows ──
        CASE
            WHEN @t % 500 = 0 THEN 'TXN-' + CAST(@t - 1 AS NVARCHAR)
            ELSE 'TXN-' + CAST(@t AS NVARCHAR)
        END,
        CASE
            WHEN @t % 200  = 0 THEN 'Failed'
            WHEN @t % 75   = 0 THEN 'Pending'
            ELSE 'Completed'
        END,
        DATEADD(MINUTE, -@t * 3, GETDATE())
    );

    SET @t = @t + 1;
END;

-- =============================================================================
--  SEED DATA — Digital Vouchers
--  Only generate vouchers for ~4 800 of the 5 200 transactions.
--  The remaining ~400 are "Ghost Transactions" — wallet deductions with no
--  matching voucher (intentional defect for reconciliation exercises).
-- =============================================================================

INSERT INTO DigitalVouchers (EntryID, PinData, ExpiryDate)
SELECT
    tl.EntryID,
    CAST(ABS(CHECKSUM(NEWID())) AS NVARCHAR),
    CASE
        -- ── Intentional defect: ~200 vouchers already expired ──
        WHEN tl.WalletID % 27 = 0 THEN DATEADD(MONTH, -3, GETDATE())
        ELSE DATEADD(YEAR, 1, GETDATE())
    END
FROM TransactionLedger tl
WHERE tl.ProcessingStatus = 'Completed'
  AND tl.EntryID NOT IN (
      -- Skip every 13th completed transaction → ghost transactions
      SELECT sub.EntryID
      FROM (
          SELECT EntryID, ROW_NUMBER() OVER (ORDER BY CreatedTimestamp) AS rn
          FROM TransactionLedger
          WHERE ProcessingStatus = 'Completed'
      ) sub
      WHERE sub.rn % 13 = 0
  );

-- =============================================================================
--  SEED DATA — Settlements (sample records for active merchants)
-- =============================================================================

INSERT INTO Settlements (MerchantID, PeriodStart, PeriodEnd, GrossAmount, CommissionAmount, NetAmount, SettlementStatus)
VALUES
    (1,  '2024-01-01', '2024-01-31', 12500.00, 625.00, 11875.00, 'Processed'),
    (2,  '2024-01-01', '2024-01-31', 9800.00,  490.00,  9310.00, 'Processed'),
    (3,  '2024-01-01', '2024-01-31', 15200.00, 760.00, 14440.00, 'Processed'),
    (4,  '2024-01-01', '2024-01-31',  7400.00, 370.00,  7030.00, 'Processed'),
    (5,  '2024-02-01', '2024-02-29', 11100.00, 555.00, 10545.00, 'Processed'),
    (6,  '2024-02-01', '2024-02-29',  8300.00, 415.00,  7885.00, 'Processed'),
    (1,  '2024-02-01', '2024-02-29', 13400.00, 670.00, 12730.00, 'Processed'),
    (2,  '2024-02-01', '2024-02-29', 10200.00, 510.00,  9690.00, 'Processed'),
    (3,  '2024-03-01', '2024-03-31', 16800.00, 840.00, 15960.00, 'Pending'),
    (7,  '2024-03-01', '2024-03-31',  6200.00, 310.00,  5890.00, 'Pending'),
    -- ── Intentional defect: settlement math does not add up ──
    (8,  '2024-03-01', '2024-03-31',  9500.00, 475.00,  8900.00, 'Processed'),
    (9,  '2024-03-01', '2024-03-31',  5500.00, 275.00,  5100.00, 'Failed');

-- =============================================================================
--  SEED DATA — Audit Log (sample entries)
-- =============================================================================

INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID, OldValue, NewValue)
VALUES
    (1, 'UPDATE_STATUS',   'Merchants', '13', 'Active',    'Suspended'),
    (1, 'UPDATE_STATUS',   'Merchants', '14', 'Active',    'Deactivated'),
    (2, 'UPDATE_COMMISSION','Commissions','2', '5.00',      '6.00'),
    (1, 'TOPUP_WALLET',    'Wallets',    '1', '515.50',    '1515.50'),
    (3, 'CREATE_PRODUCT',  'Products',  '12', NULL,        'CellC R25 Airtime');

-- =============================================================================
--  STORED PROCEDURES
-- =============================================================================
GO

-- Original voucher-issuance procedure (intentional defects preserved)
CREATE PROCEDURE usp_IssueDigitalVoucher
    @WalletID INT,
    @ProductID INT,
    @Ref NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    -- ❌ DEFECT: No balance validation before debit
    -- ❌ DEFECT: No ServiceStatus check on wallet owner
    -- ❌ DEFECT: No transaction wrapping (partial failure risk)
    -- ❌ DEFECT: Uses FLOAT for financial arithmetic

    UPDATE Wallets
    SET Balance = Balance - (SELECT FaceValue FROM Products WHERE ProductID = @ProductID),
        LastUpdated = GETDATE()
    WHERE WalletID = @WalletID;

    DECLARE @NewEntryID UNIQUEIDENTIFIER = NEWID();

    -- Compute commission using FLOAT (intentional rounding defect)
    DECLARE @FaceVal FLOAT;
    SELECT @FaceVal = FaceValue FROM Products WHERE ProductID = @ProductID;

    DECLARE @CommPct FLOAT = 0;
    SELECT TOP 1 @CommPct = CommissionPercentage
    FROM Commissions
    WHERE ProductID = @ProductID AND MerchantTier = 'Standard' AND IsActive = 1
    ORDER BY CommissionID;

    DECLARE @CommAmt FLOAT = @FaceVal * (@CommPct / 100.0);

    INSERT INTO TransactionLedger (EntryID, WalletID, ProductID, Amount, CommissionAmount, ExternalReference, ProcessingStatus)
    VALUES (@NewEntryID, @WalletID, @ProductID, @FaceVal, @CommAmt, @Ref, 'Completed');

    INSERT INTO DigitalVouchers (EntryID, PinData, ExpiryDate)
    VALUES (@NewEntryID, CAST(ABS(CHECKSUM(NEWID())) AS NVARCHAR), DATEADD(YEAR, 1, GETDATE()));

    SELECT PinData FROM DigitalVouchers WHERE EntryID = @NewEntryID;
END;
GO

-- Settlement calculation procedure (new)
CREATE PROCEDURE usp_CalculateSettlement
    @MerchantID INT,
    @PeriodStart DATETIME,
    @PeriodEnd DATETIME
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Gross FLOAT = 0;
    DECLARE @Comm  FLOAT = 0;

    -- Sum completed transactions for the merchant's wallet
    SELECT
        @Gross = ISNULL(SUM(tl.Amount), 0),
        @Comm  = ISNULL(SUM(tl.CommissionAmount), 0)
    FROM TransactionLedger tl
    JOIN Wallets w ON tl.WalletID = w.WalletID
    JOIN Merchants m ON w.UserID = m.UserID
    WHERE m.MerchantID = @MerchantID
      AND tl.ProcessingStatus = 'Completed'
      AND tl.CreatedTimestamp BETWEEN @PeriodStart AND @PeriodEnd;

    -- ❌ DEFECT: Net = Gross - Comm calculated with FLOAT (rounding)
    DECLARE @Net FLOAT = @Gross - @Comm;

    INSERT INTO Settlements (MerchantID, PeriodStart, PeriodEnd, GrossAmount, CommissionAmount, NetAmount, SettlementStatus)
    VALUES (@MerchantID, @PeriodStart, @PeriodEnd, @Gross, @Comm, @Net, 'Pending');

    SELECT @Gross AS GrossAmount, @Comm AS CommissionAmount, @Net AS NetAmount;
END;
GO

-- =============================================================================
--  SUMMARY
-- =============================================================================
--  Tables:       10  (ServiceProviders, Users, Merchants, Wallets, Products,
--                     Commissions, TransactionLedger, DigitalVouchers,
--                     Settlements, AuditLog)
--  Users:        55  (3 Admin, 22 Merchant, 30 User — 3 Disabled, 1 Suspended)
--  Merchants:    22  (including Pending, Suspended, Deactivated states)
--  Products:     12  (across 5 providers)
--  Commissions:  37  (3 tiers × 12 products + 1 duplicate)
--  Transactions: 5 200  (with ~400 ghost entries, duplicates, mixed statuses)
--  Vouchers:     ~4 800 (with ~200 expired)
--  Settlements:  12  (with intentional math errors)
--
--  Embedded defects for QE discovery:
--   1. FLOAT used for financial columns (rounding errors)
--   2. No balance validation in usp_IssueDigitalVoucher
--   3. No ServiceStatus check before transactions
--   4. No transaction wrapping in stored procedures
--   5. Ghost transactions (wallet deductions without voucher records)
--   6. Duplicate ExternalReference values
--   7. Invalid MSISDN formats on 3 users
--   8. Duplicate commission rule (ProductID 2 / Standard)
--   9. Settlement math discrepancies (rows 11, 12)
--  10. Expired vouchers returned without filtering
-- =============================================================================
