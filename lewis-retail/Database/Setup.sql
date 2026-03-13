-- =============================================
-- RUN THIS FIRST (before LewisRetail.sql)
-- Connect to your local SQL Server via the
-- VS Code SQL Server extension (Windows Auth)
-- and execute this script against the master db.
-- Then RESTART SQL Server from Windows Services.
-- =============================================

-- Step 1: Enable SQL Server + Windows Authentication mode
EXEC xp_instance_regwrite
    N'HKEY_LOCAL_MACHINE',
    N'Software\Microsoft\MSSQLServer\MSSQLServer',
    N'LoginMode',
    REG_DWORD,
    2;

-- Step 2: Enable the sa login and set password
ALTER LOGIN [sa] ENABLE;
ALTER LOGIN [sa] WITH PASSWORD = 'Password123';

PRINT '✅ SQL Authentication is now enabled!';
PRINT '';
PRINT 'Now complete these final steps:';
PRINT '';
PRINT '  STEP 1 - Enable TCP/IP:';
PRINT '    Open Start Menu → search "SQL Server Configuration Manager"';
PRINT '    Go to: SQL Server Network Configuration → Protocols for MSSQLSERVER';
PRINT '    Right-click TCP/IP → Enable';
PRINT '';
PRINT '  STEP 2 - Restart SQL Server:';
PRINT '    Open Start Menu → search "Services"';
PRINT '    Find "SQL Server (MSSQLSERVER)" → Right-click → Restart';
PRINT '';
PRINT '  STEP 3 - Run LewisRetail.sql to create the LewisRetail database';
