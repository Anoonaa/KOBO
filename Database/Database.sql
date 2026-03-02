IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'KoboFintech')
CREATE DATABASE KoboFintech;
GO
USE KoboFintech;
GO

-- User Management
CREATE TABLE ServiceProviders (
    ProviderID INT PRIMARY KEY IDENTITY(1,1),
    ProviderName NVARCHAR(50),
    Category NVARCHAR(50)
);

CREATE TABLE Users (
    UserID INT PRIMARY KEY IDENTITY(1,1),
    MSISDN NVARCHAR(15) UNIQUE NOT NULL,
    FullName NVARCHAR(100) NOT NULL,
    AccountTier NVARCHAR(20) DEFAULT 'Standard',
    ServiceStatus NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- Financial Layer
CREATE TABLE Wallets (
    WalletID INT PRIMARY KEY IDENTITY(1,1),
    UserID INT FOREIGN KEY REFERENCES Users(UserID),
    Balance FLOAT DEFAULT 0.0,
    CurrencyCode CHAR(3) DEFAULT 'ZAR',
    LastUpdated DATETIME DEFAULT GETDATE()
);

CREATE TABLE Products (
    ProductID INT PRIMARY KEY IDENTITY(1,1),
    ProviderID INT FOREIGN KEY REFERENCES ServiceProviders(ProviderID),
    SKU NVARCHAR(50) UNIQUE,
    Description NVARCHAR(100),
    FaceValue FLOAT NOT NULL
);

-- Transaction Engine
CREATE TABLE TransactionLedger (
    EntryID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    WalletID INT FOREIGN KEY REFERENCES Wallets(WalletID),
    ProductID INT FOREIGN KEY REFERENCES Products(ProductID),
    Amount FLOAT NOT NULL,
    ExternalReference NVARCHAR(100),
    ProcessingStatus NVARCHAR(20),
    CreatedTimestamp DATETIME DEFAULT GETDATE()
);

CREATE TABLE DigitalVouchers (
    VoucherID INT PRIMARY KEY IDENTITY(1,1),
    EntryID UNIQUEIDENTIFIER FOREIGN KEY REFERENCES TransactionLedger(EntryID),
    PinData NVARCHAR(255) NOT NULL,
    ExpiryDate DATETIME NOT NULL
);

-- Data Seed: 50 Users
DECLARE @i INT = 1;
WHILE @i <= 50
BEGIN
    INSERT INTO Users (MSISDN, FullName) VALUES ('2771' + CAST(1000000 + @i AS NVARCHAR), 'User_' + CAST(@i AS NVARCHAR));
    INSERT INTO Wallets (UserID, Balance) VALUES (@i, 500.00 + (@i * 15.50));
    SET @i = @i + 1;
END;

-- Data Seed: Disabled Users (for QE testing)
UPDATE Users SET ServiceStatus = 'Disabled' WHERE UserID IN (5, 18, 33);

-- Data Seed: Low-balance wallet (for business logic testing)
UPDATE Wallets SET Balance = 5.00 WHERE WalletID = 10;

-- Data Seed: Products
INSERT INTO ServiceProviders (ProviderName, Category) VALUES ('MTN', 'Mobile'), ('Vodacom', 'Mobile'), ('Eskom', 'Utility');
INSERT INTO Products (ProviderID, SKU, Description, FaceValue) VALUES 
(1, 'MTN-10', 'MTN R10 Airtime', 10.00), 
(2, 'VOD-20', 'Vodacom R20 Airtime', 20.00),
(3, 'ESK-100', 'Eskom R100 Electricity', 100.00);

-- Data Seed: 100 Transactions
DECLARE @j INT = 1;
WHILE @j <= 100
BEGIN
    INSERT INTO TransactionLedger (WalletID, ProductID, Amount, ExternalReference, ProcessingStatus)
    VALUES (ABS(CHECKSUM(NEWID())) % 50 + 1, ABS(CHECKSUM(NEWID())) % 3 + 1, 10.00, 'TXN-' + CAST(@j AS NVARCHAR), 'Completed');
    SET @j = @j + 1;
END;

-- Transaction Logic
GO
CREATE PROCEDURE usp_IssueDigitalVoucher
    @WalletID INT,
    @ProductID INT,
    @Ref NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    -- Balance update
    UPDATE Wallets SET Balance = Balance - (SELECT FaceValue FROM Products WHERE ProductID = @ProductID) WHERE WalletID = @WalletID;
    
    DECLARE @NewEntryID UNIQUEIDENTIFIER = NEWID();
    -- Ledger entry
    INSERT INTO TransactionLedger (EntryID, WalletID, ProductID, Amount, ExternalReference, ProcessingStatus)
    VALUES (@NewEntryID, @WalletID, @ProductID, (SELECT FaceValue FROM Products WHERE ProductID = @ProductID), @Ref, 'Completed');
    
    -- Voucher generation
    INSERT INTO DigitalVouchers (EntryID, PinData, ExpiryDate)
    VALUES (@NewEntryID, CAST(ABS(CHECKSUM(NEWID())) AS NVARCHAR), DATEADD(YEAR, 1, GETDATE()));
    
    SELECT PinData FROM DigitalVouchers WHERE EntryID = @NewEntryID;
END;