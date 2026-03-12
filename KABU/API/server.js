const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// ─── Configuration ───────────────────────────────────────────────────
// NOTE: The fallback JWT_SECRET is for local/educational use only.
//       In a production environment, always provide a strong secret via
//       the JWT_SECRET environment variable and fail if it is missing.
const JWT_SECRET = process.env.JWT_SECRET || 'kabu-retail-secret-2024';
const JWT_EXPIRY = '24h';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'kabu.db');

// ─── Database Connection ─────────────────────────────────────────────
let db;
async function getDB() {
    if (!db) {
        db = await open({ filename: DB_PATH, driver: sqlite3.Database });
        await db.run('PRAGMA foreign_keys = ON');
    }
    return db;
}

// ─── Auth Middleware ──────────────────────────────────────────────────
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Authentication token required.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Forbidden', message: 'Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions.' });
        }
        next();
    };
}

// ─── Swagger Documentation ───────────────────────────────────────────
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Kabu Retail — Store & Loyalty Management API',
            version: '1.0.0',
            description:
                'Retail management API for product sales, store lifecycle management, ' +
                'customer loyalty accounts, discount processing, and financial reporting.\n\n' +
                '**Default credentials** — any seeded user with password `Password123`.\n' +
                'Admin emails: `naledi@kabu.co.za`, `thabo@kabu.co.za`, `zanele@kabu.co.za`.'
        },
        servers: [{ url: 'http://localhost:3000' }],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            }
        },
        security: [{ BearerAuth: [] }]
    },
    apis: ['./server.js'],
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// =====================================================================
//  DATABASE INITIALISATION
//  Auto-creates kabu.db and seeds all tables on first startup.
// =====================================================================

// Bcrypt hash of 'Password123' — for seeding test/demo data ONLY.
const DEFAULT_HASH = '$2a$10$6F/QPoOSUf.iIEeqMZUn8.eS8o03/Icx1jOunNwY7Q8sG199vqsfK';

async function initDatabase() {
    const database = await getDB();

    // ── Schema ────────────────────────────────────────────────────────
    await database.exec(`
        CREATE TABLE IF NOT EXISTS Suppliers (
            SupplierID   INTEGER PRIMARY KEY AUTOINCREMENT,
            SupplierName TEXT    NOT NULL,
            Category     TEXT    NOT NULL,
            IsActive     INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS Customers (
            CustomerID     INTEGER PRIMARY KEY AUTOINCREMENT,
            PhoneNumber    TEXT    NOT NULL,
            FullName       TEXT    NOT NULL,
            Email          TEXT,
            PasswordHash   TEXT    NOT NULL DEFAULT '${DEFAULT_HASH}',
            Role           TEXT    NOT NULL DEFAULT 'Customer',
            MembershipTier TEXT    DEFAULT 'Standard',
            AccountStatus  TEXT    DEFAULT 'Active',
            CreatedAt      TEXT    DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS Stores (
            StoreID      INTEGER PRIMARY KEY AUTOINCREMENT,
            ManagerID    INTEGER REFERENCES Customers(CustomerID),
            StoreName    TEXT    NOT NULL,
            StoreCode    TEXT,
            StoreStatus  TEXT    DEFAULT 'Pending',
            StoreRegion  TEXT    DEFAULT 'Standard',
            CreatedAt    TEXT    DEFAULT (datetime('now')),
            UpdatedAt    TEXT    DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS LoyaltyAccounts (
            AccountID      INTEGER PRIMARY KEY AUTOINCREMENT,
            CustomerID     INTEGER REFERENCES Customers(CustomerID),
            PointsBalance  REAL    DEFAULT 0.0,
            CurrencyCode   TEXT    DEFAULT 'ZAR',
            LastUpdated    TEXT    DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS Products (
            ProductID     INTEGER PRIMARY KEY AUTOINCREMENT,
            SupplierID    INTEGER REFERENCES Suppliers(SupplierID),
            SKU           TEXT    UNIQUE,
            ProductName   TEXT    NOT NULL,
            Description   TEXT,
            UnitPrice     REAL    NOT NULL,
            StockQuantity INTEGER DEFAULT 0,
            IsActive      INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS Discounts (
            DiscountID           INTEGER PRIMARY KEY AUTOINCREMENT,
            ProductID            INTEGER REFERENCES Products(ProductID),
            MembershipTier       TEXT    NOT NULL,
            DiscountPercentage   REAL    NOT NULL,
            EffectiveDate        TEXT    DEFAULT (datetime('now')),
            IsActive             INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS SalesOrders (
            OrderID         TEXT    PRIMARY KEY,
            AccountID       INTEGER REFERENCES LoyaltyAccounts(AccountID),
            ProductID       INTEGER REFERENCES Products(ProductID),
            Quantity        INTEGER NOT NULL DEFAULT 1,
            UnitPrice       REAL    NOT NULL,
            TotalAmount     REAL    NOT NULL,
            DiscountAmount  REAL    DEFAULT 0,
            OrderReference  TEXT,
            OrderStatus     TEXT    DEFAULT 'Completed',
            CreatedAt       TEXT    DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS Receipts (
            ReceiptID    INTEGER PRIMARY KEY AUTOINCREMENT,
            OrderID      TEXT    REFERENCES SalesOrders(OrderID),
            ReceiptCode  TEXT    NOT NULL,
            IssuedAt     TEXT    DEFAULT (datetime('now')),
            ExpiryDate   TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS Returns (
            ReturnID        INTEGER PRIMARY KEY AUTOINCREMENT,
            StoreID         INTEGER REFERENCES Stores(StoreID),
            PeriodStart     TEXT    NOT NULL,
            PeriodEnd       TEXT    NOT NULL,
            GrossAmount     REAL    DEFAULT 0,
            DiscountAmount  REAL    DEFAULT 0,
            NetAmount       REAL    DEFAULT 0,
            ReturnStatus    TEXT    DEFAULT 'Pending',
            CreatedAt       TEXT    DEFAULT (datetime('now'))
        );

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
    `);

    // ── Guard: skip seeding if data already exists ────────────────────
    const { cnt } = await database.get('SELECT COUNT(*) AS cnt FROM Customers');
    if (cnt > 0) {
        console.log('Database already seeded — skipping initialisation.');
        return;
    }

    console.log('Seeding kabu.db …');

    // ── Suppliers (5) ─────────────────────────────────────────────────
    await database.exec(`
        INSERT INTO Suppliers (SupplierName, Category) VALUES
            ('TechNova',     'Electronics'),
            ('FreshHarvest', 'Groceries'),
            ('StyleHub',     'Clothing'),
            ('HomeCraft',    'Household'),
            ('GlowUp',       'Beauty');
    `);

    // ── Customers ─────────────────────────────────────────────────────
    // Admins (CustomerID 1-3)
    const admins = [
        ['27110000001', 'Admin_Naledi', 'naledi@kabu.co.za', 'Admin', 'Gold'],
        ['27110000002', 'Admin_Thabo',  'thabo@kabu.co.za',  'Admin', 'Gold'],
        ['27110000003', 'Admin_Zanele', 'zanele@kabu.co.za', 'Admin', 'Gold'],
    ];
    for (const [phone, name, email, role, tier] of admins) {
        await database.run(
            'INSERT INTO Customers (PhoneNumber, FullName, Email, PasswordHash, Role, MembershipTier) VALUES (?, ?, ?, ?, ?, ?)',
            [phone, name, email, DEFAULT_HASH, role, tier]
        );
    }

    // StoreManagers (CustomerID 4-25)
    for (let m = 4; m <= 25; m++) {
        const tier = m <= 10 ? 'Standard' : (m <= 18 ? 'Premium' : 'Gold');
        await database.run(
            'INSERT INTO Customers (PhoneNumber, FullName, Email, PasswordHash, Role, MembershipTier) VALUES (?, ?, ?, ?, ?, ?)',
            [
                '2771' + String(1000000 + m).padStart(7, '0'),
                'Manager_' + m,
                'manager' + m + '@kabu.co.za',
                DEFAULT_HASH,
                'StoreManager',
                tier
            ]
        );
    }

    // Regular customers (CustomerID 26-55)
    for (let u = 26; u <= 55; u++) {
        await database.run(
            'INSERT INTO Customers (PhoneNumber, FullName, Email, PasswordHash, Role) VALUES (?, ?, ?, ?, ?)',
            [
                '2771' + String(1000000 + u).padStart(7, '0'),
                'Customer_' + u,
                'customer' + u + '@kabu.co.za',
                DEFAULT_HASH,
                'Customer'
            ]
        );
    }

    // ── Intentional defects: invalid phone formats ──
    await database.run("UPDATE Customers SET PhoneNumber = '271100004'     WHERE CustomerID = 40");  // too short (9 digits)
    await database.run("UPDATE Customers SET PhoneNumber = '2711000005555' WHERE CustomerID = 45");  // too long (13 digits)
    await database.run("UPDATE Customers SET PhoneNumber = '27AB0000050'   WHERE CustomerID = 50");  // contains letters

    // ── Intentional defects: disabled / suspended accounts ──
    await database.run("UPDATE Customers SET AccountStatus = 'Disabled'  WHERE CustomerID IN (5, 18, 33)");
    await database.run("UPDATE Customers SET AccountStatus = 'Suspended' WHERE CustomerID = 12");

    // ── Stores (22 stores for managers 4-25) ─────────────────────────
    const storeRegions = ['Western Cape', 'Gauteng', 'KwaZulu-Natal', 'Eastern Cape', 'Limpopo'];
    for (let mc = 4; mc <= 25; mc++) {
        let status;
        if (mc <= 8)       status = 'Active';
        else if (mc <= 12) status = 'Pending';
        else if (mc === 13) status = 'Suspended';
        else if (mc === 14) status = 'Deactivated';
        else               status = 'Active';

        const region = storeRegions[(mc - 4) % storeRegions.length];
        await database.run(
            'INSERT INTO Stores (ManagerID, StoreName, StoreCode, StoreStatus, StoreRegion) VALUES (?, ?, ?, ?, ?)',
            [mc, 'Kabu Store ' + mc, 'KST-' + String(mc).padStart(4, '0'), status, region]
        );
    }

    // ── LoyaltyAccounts (55 — one per customer) ───────────────────────
    for (let w = 1; w <= 55; w++) {
        await database.run(
            'INSERT INTO LoyaltyAccounts (CustomerID, PointsBalance) VALUES (?, ?)',
            [w, 500.0 + w * 15.5]
        );
    }

    // ── Intentional defects: low and negative balances ──
    await database.run('UPDATE LoyaltyAccounts SET PointsBalance = 5.00  WHERE CustomerID = 10');
    await database.run('UPDATE LoyaltyAccounts SET PointsBalance = -12.50 WHERE CustomerID = 30');

    // ── Products (12 retail items across 5 suppliers) ─────────────────
    await database.exec(`
        INSERT INTO Products (SupplierID, SKU, ProductName, Description, UnitPrice, StockQuantity) VALUES
            (1, 'TNV-LAP-001', 'Laptop',        'TechNova 15" Laptop',       5000.00, 20),
            (1, 'TNV-HPH-002', 'Headphones',    'TechNova Wireless Headphones', 500.00, 50),
            (1, 'TNV-USB-003', 'USB Cable',     'TechNova USB-C Cable 2m',      50.00, 200),
            (2, 'FRH-BRD-001', 'Bread',         'FreshHarvest Brown Bread 700g', 20.00, 150),
            (2, 'FRH-MLK-002', 'Milk',          'FreshHarvest Full Cream 1L',    25.00, 100),
            (2, 'FRH-EGG-003', 'Eggs',          'FreshHarvest Free Range x12',   40.00, 80),
            (3, 'STH-TSH-001', 'T-Shirt',       'StyleHub Cotton T-Shirt',      150.00, 60),
            (3, 'STH-JNS-002', 'Jeans',         'StyleHub Slim Fit Jeans',      450.00, 30),
            (4, 'HMC-DSP-001', 'Dish Soap',     'HomeCraft Dish Soap 750ml',     35.00, 120),
            (4, 'HMC-MOP-002', 'Mop',           'HomeCraft Easy-Wring Mop',     120.00, 40),
            (5, 'GLW-SHP-001', 'Shampoo',       'GlowUp Moisture Shampoo 400ml', 65.00, 90),
            (5, 'GLW-FCR-002', 'Face Cream',    'GlowUp Anti-Ageing Cream 50ml',180.00, 35);
    `);

    // ── Discounts (per-product, per-tier) ─────────────────────────────
    const tiers = [
        { tier: 'Standard', rates: [3.0, 3.0, 3.5, 2.0, 2.0, 2.5, 4.0, 4.0, 2.5, 3.0, 3.5, 3.0] },
        { tier: 'Premium',  rates: [5.0, 5.0, 5.5, 3.5, 3.5, 4.0, 6.0, 6.0, 4.0, 5.0, 5.5, 5.0] },
        { tier: 'Gold',     rates: [8.0, 8.0, 8.5, 5.5, 5.5, 6.0, 9.0, 9.0, 6.0, 7.5, 8.0, 7.5] },
    ];
    for (const { tier, rates } of tiers) {
        for (let i = 0; i < 12; i++) {
            await database.run(
                'INSERT INTO Discounts (ProductID, MembershipTier, DiscountPercentage) VALUES (?, ?, ?)',
                [i + 1, tier, rates[i]]
            );
        }
    }

    // ── Intentional defect: duplicate discount rule (ProductID 2, Standard) ──
    await database.run(
        'INSERT INTO Discounts (ProductID, MembershipTier, DiscountPercentage, IsActive) VALUES (?, ?, ?, ?)',
        [2, 'Standard', 4.5, 1]
    );

    // ── SalesOrders (5 200) and Receipts (~4 800) ─────────────────────
    const products = await database.all('SELECT ProductID, UnitPrice FROM Products');
    const discountMap = {};
    const allDiscounts = await database.all(
        "SELECT ProductID, DiscountPercentage FROM Discounts WHERE MembershipTier = 'Standard' AND IsActive = 1 ORDER BY DiscountID"
    );
    for (const d of allDiscounts) {
        if (!discountMap[d.ProductID]) discountMap[d.ProductID] = d.DiscountPercentage;
    }

    await database.run('BEGIN TRANSACTION');
    let completedCount = 0;
    for (let t = 1; t <= 5200; t++) {
        const accountId = ((t - 1) % 55) + 1;
        const productId = ((t - 1) % 12) + 1;
        const prod = products.find(p => p.ProductID === productId);
        const discPct = discountMap[productId] || 0;
        const discAmt = prod.UnitPrice * (discPct / 100.0);   // ❌ FLOAT arithmetic defect
        const orderId = uuidv4();

        // ── Intentional defect: duplicate references every 500 rows ──
        const ref = (t % 500 === 0)
            ? 'ORD-' + (t - 1)
            : 'ORD-' + t;

        // ── Intentional defect: mixed statuses ──
        let status;
        if (t % 200 === 0)      status = 'Failed';
        else if (t % 75 === 0)  status = 'Pending';
        else                    status = 'Completed';

        const createdAt = new Date(Date.now() - t * 3 * 60000).toISOString();

        await database.run(
            'INSERT INTO SalesOrders (OrderID, AccountID, ProductID, Quantity, UnitPrice, TotalAmount, DiscountAmount, OrderReference, OrderStatus, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [orderId, accountId, productId, 1, prod.UnitPrice, prod.UnitPrice, discAmt, ref, status, createdAt]
        );

        if (status === 'Completed') completedCount++;
    }
    await database.run('COMMIT');

    // ── Receipts: ~4 800 of 5 200 (skip every 13th completed = ghost orders) ──
    const completedOrders = await database.all(
        "SELECT OrderID, AccountID FROM SalesOrders WHERE OrderStatus = 'Completed' ORDER BY CreatedAt"
    );

    await database.run('BEGIN TRANSACTION');
    let rn = 0;
    for (const order of completedOrders) {
        rn++;
        if (rn % 13 === 0) continue;   // ── Ghost order: no receipt ──

        // ── Intentional defect: ~200 receipts already expired ──
        const isExpired = (order.AccountID % 27 === 0);
        const expiryDate = isExpired
            ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

        const receiptCode = Math.abs(Math.floor(Math.random() * 1000000000)).toString().padStart(9, '0');
        await database.run(
            'INSERT INTO Receipts (OrderID, ReceiptCode, ExpiryDate) VALUES (?, ?, ?)',
            [order.OrderID, receiptCode, expiryDate]
        );
    }
    await database.run('COMMIT');

    // ── Returns (12 sample records) ───────────────────────────────────
    const returnRecords = [
        [1,  '2024-01-01', '2024-01-31', 12500.00, 625.00,  11875.00, 'Processed'],
        [2,  '2024-01-01', '2024-01-31',  9800.00, 490.00,   9310.00, 'Processed'],
        [3,  '2024-01-01', '2024-01-31', 15200.00, 760.00,  14440.00, 'Processed'],
        [4,  '2024-01-01', '2024-01-31',  7400.00, 370.00,   7030.00, 'Processed'],
        [5,  '2024-02-01', '2024-02-29', 11100.00, 555.00,  10545.00, 'Processed'],
        [6,  '2024-02-01', '2024-02-29',  8300.00, 415.00,   7885.00, 'Processed'],
        [1,  '2024-02-01', '2024-02-29', 13400.00, 670.00,  12730.00, 'Processed'],
        [2,  '2024-02-01', '2024-02-29', 10200.00, 510.00,   9690.00, 'Processed'],
        [3,  '2024-03-01', '2024-03-31', 16800.00, 840.00,  15960.00, 'Pending'],
        [7,  '2024-03-01', '2024-03-31',  6200.00, 310.00,   5890.00, 'Pending'],
        // ── Intentional defect: return math does not add up ──
        [8,  '2024-03-01', '2024-03-31',  9500.00, 475.00,   8900.00, 'Processed'],
        [9,  '2024-03-01', '2024-03-31',  5500.00, 275.00,   5100.00, 'Failed'],
    ];
    for (const [sid, ps, pe, gross, disc, net, status] of returnRecords) {
        await database.run(
            'INSERT INTO Returns (StoreID, PeriodStart, PeriodEnd, GrossAmount, DiscountAmount, NetAmount, ReturnStatus) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [sid, ps, pe, gross, disc, net, status]
        );
    }

    // ── Audit Log (sample entries) ────────────────────────────────────
    await database.exec(`
        INSERT INTO AuditLog (CustomerID, Action, TableAffected, RecordID, OldValue, NewValue) VALUES
            (1, 'UPDATE_STATUS',    'Stores',    '13', 'Active',    'Suspended'),
            (1, 'UPDATE_STATUS',    'Stores',    '14', 'Active',    'Deactivated'),
            (2, 'UPDATE_DISCOUNT',  'Discounts', '2',  '3.00',      '4.50'),
            (1, 'TOPUP_ACCOUNT',    'LoyaltyAccounts', '1', '515.50', '1515.50'),
            (3, 'CREATE_PRODUCT',   'Products',  '12', NULL,        'GlowUp Anti-Ageing Cream 50ml');
    `);

    console.log('Database seeded successfully.');
}

// =====================================================================
//  processSale — equivalent of usp_IssueDigitalVoucher (with defects)
// =====================================================================
async function processSale(database, accountId, productId, reference) {
    // ❌ DEFECT: No points/balance validation before deducting
    // ❌ DEFECT: No AccountStatus check on the account owner
    // ❌ DEFECT: No transaction wrapping (partial failure risk)
    // ❌ DEFECT: Uses REAL for financial arithmetic (rounding errors)

    const product = await database.get('SELECT * FROM Products WHERE ProductID = ?', [productId]);
    if (!product) throw new Error('Product not found.');

    const account = await database.get('SELECT * FROM LoyaltyAccounts WHERE AccountID = ?', [accountId]);
    if (!account) throw new Error('Loyalty account not found.');

    // Deduct points without a balance check
    await database.run(
        "UPDATE LoyaltyAccounts SET PointsBalance = PointsBalance - ?, LastUpdated = datetime('now') WHERE AccountID = ?",
        [product.UnitPrice, accountId]
    );

    const orderId = uuidv4();

    // Determine discount
    const customerInfo = await database.get(
        'SELECT c.MembershipTier FROM Customers c JOIN LoyaltyAccounts la ON c.CustomerID = la.CustomerID WHERE la.AccountID = ?',
        [accountId]
    );
    const tier = customerInfo ? customerInfo.MembershipTier : 'Standard';

    let discountPct = 0;
    const discountRule = await database.get(
        'SELECT DiscountPercentage FROM Discounts WHERE ProductID = ? AND MembershipTier = ? AND IsActive = 1 ORDER BY DiscountID LIMIT 1',
        [productId, tier]
    );
    if (discountRule) discountPct = discountRule.DiscountPercentage;

    const discountAmt = product.UnitPrice * (discountPct / 100.0);  // ❌ REAL (floating-point) rounding defect

    await database.run(
        'INSERT INTO SalesOrders (OrderID, AccountID, ProductID, Quantity, UnitPrice, TotalAmount, DiscountAmount, OrderReference, OrderStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [orderId, accountId, productId, 1, product.UnitPrice, product.UnitPrice, discountAmt, reference, 'Completed']
    );

    const receiptCode = Math.abs(Math.floor(Math.random() * 1000000000)).toString().padStart(9, '0');
    await database.run(
        "INSERT INTO Receipts (OrderID, ReceiptCode, ExpiryDate) VALUES (?, ?, datetime('now', '+1 year'))",
        [orderId, receiptCode]
    );

    return { orderId, receiptCode };
}

// =====================================================================
//  AUTH
// =====================================================================

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new customer account
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber, fullName, email, password]
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "27110009999"
 *               fullName:
 *                 type: string
 *                 example: "Jane Dlamini"
 *               email:
 *                 type: string
 *                 example: "jane@kabu.co.za"
 *               password:
 *                 type: string
 *                 example: "SecurePass1"
 *               role:
 *                 type: string
 *                 enum: [Customer, StoreManager]
 *                 example: "Customer"
 *     responses:
 *       201:
 *         description: Customer registered
 *       400:
 *         description: Validation error
 *       409:
 *         description: Phone number already registered
 */
app.post('/api/v1/auth/register', async (req, res) => {
    const traceId = uuidv4();
    try {
        const { phoneNumber, fullName, email, password, role } = req.body;

        if (!phoneNumber || !fullName || !email || !password) {
            return res.status(400).json({ error: 'Bad Request', message: 'phoneNumber, fullName, email, and password are required.', traceId });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Bad Request', message: 'Password must be at least 8 characters.', traceId });
        }

        const allowedRoles = ['Customer', 'StoreManager'];
        const userRole = allowedRoles.includes(role) ? role : 'Customer';

        const hashedPassword = await bcrypt.hash(password, 10);
        const database = await getDB();

        const dup = await database.get('SELECT CustomerID FROM Customers WHERE PhoneNumber = ?', [phoneNumber]);
        if (dup) {
            return res.status(409).json({ error: 'Conflict', message: 'Phone number already registered.', traceId });
        }

        const result = await database.run(
            'INSERT INTO Customers (PhoneNumber, FullName, Email, PasswordHash, Role) VALUES (?, ?, ?, ?, ?)',
            [phoneNumber, fullName, email, hashedPassword, userRole]
        );

        const newId = result.lastID;
        await database.run('INSERT INTO LoyaltyAccounts (CustomerID, PointsBalance) VALUES (?, ?)', [newId, 0]);

        const newCustomer = await database.get(
            'SELECT CustomerID, PhoneNumber, FullName, Email, Role FROM Customers WHERE CustomerID = ?',
            [newId]
        );

        res.status(201).json({ data: newCustomer, traceId });
    } catch (err) {
        console.error(`[${traceId}] Register error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Authenticate and receive JWT token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: "naledi@kabu.co.za"
 *               password:
 *                 type: string
 *                 example: "Password123"
 *     responses:
 *       200:
 *         description: Login successful — returns JWT token
 *       401:
 *         description: Invalid credentials
 */
app.post('/api/v1/auth/login', async (req, res) => {
    const traceId = uuidv4();
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Bad Request', message: 'email and password are required.', traceId });
        }

        const database = await getDB();
        const user = await database.get('SELECT * FROM Customers WHERE Email = ?', [email]);

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password.', traceId });
        }

        const validPassword = await bcrypt.compare(password, user.PasswordHash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password.', traceId });
        }

        const token = jwt.sign(
            { customerId: user.CustomerID, email: user.Email, role: user.Role, phoneNumber: user.PhoneNumber },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRY }
        );

        res.json({
            token,
            user: { customerId: user.CustomerID, fullName: user.FullName, email: user.Email, role: user.Role },
            traceId
        });
    } catch (err) {
        console.error(`[${traceId}] Login error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/auth/profile:
 *   get:
 *     summary: Get current customer profile from JWT
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Current customer profile
 *       401:
 *         description: Unauthorized
 */
app.get('/api/v1/auth/profile', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.get(`
            SELECT c.CustomerID, c.PhoneNumber, c.FullName, c.Email, c.Role,
                   c.MembershipTier, c.AccountStatus, c.CreatedAt,
                   la.AccountID, la.PointsBalance, la.CurrencyCode
            FROM Customers c
            LEFT JOIN LoyaltyAccounts la ON c.CustomerID = la.CustomerID
            WHERE c.CustomerID = ?
        `, [req.user.customerId]);

        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] Profile error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  CUSTOMERS
// =====================================================================

/**
 * @swagger
 * /api/v1/customers:
 *   get:
 *     summary: List all customers
 *     tags: [Customers]
 *     responses:
 *       200:
 *         description: Array of customer records
 */
app.get('/api/v1/customers', async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.all(
            'SELECT CustomerID, PhoneNumber, FullName, Email, Role, MembershipTier, AccountStatus, CreatedAt FROM Customers'
        );
        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /customers error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/customers/{id}:
 *   get:
 *     summary: Get customer by ID
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Customer record with loyalty account
 *       404:
 *         description: Customer not found
 */
app.get('/api/v1/customers/:id', async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.get(`
            SELECT c.CustomerID, c.PhoneNumber, c.FullName, c.Email, c.Role,
                   c.MembershipTier, c.AccountStatus, c.CreatedAt,
                   la.AccountID, la.PointsBalance, la.CurrencyCode
            FROM Customers c
            LEFT JOIN LoyaltyAccounts la ON c.CustomerID = la.CustomerID
            WHERE c.CustomerID = ?
        `, [req.params.id]);

        if (!data) {
            return res.status(404).json({ error: 'Not Found', message: 'Customer does not exist.', traceId });
        }

        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /customers/:id error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  STORES
// =====================================================================

/**
 * @swagger
 * /api/v1/stores/register:
 *   post:
 *     summary: Register a new store (StoreManager or Admin)
 *     tags: [Stores]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [storeName, storeCode]
 *             properties:
 *               storeName:
 *                 type: string
 *                 example: "Kabu Sandton"
 *               storeCode:
 *                 type: string
 *                 example: "KST-0100"
 *               storeRegion:
 *                 type: string
 *                 example: "Gauteng"
 *     responses:
 *       201:
 *         description: Store registered (Pending status)
 *       400:
 *         description: Validation error
 *       403:
 *         description: StoreManager or Admin role required
 */
app.post('/api/v1/stores/register', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const { storeName, storeCode, storeRegion } = req.body;

        if (!storeName || !storeCode) {
            return res.status(400).json({ error: 'Bad Request', message: 'storeName and storeCode are required.', traceId });
        }

        if (!/^KST-\d{4}$/.test(storeCode)) {
            return res.status(400).json({ error: 'Bad Request', message: 'storeCode must match format KST-NNNN.', traceId });
        }

        if (req.user.role !== 'StoreManager' && req.user.role !== 'Admin') {
            return res.status(403).json({ error: 'Forbidden', message: 'Only StoreManager or Admin may register a store.', traceId });
        }

        const database = await getDB();

        const existing = await database.get('SELECT StoreID FROM Stores WHERE ManagerID = ?', [req.user.customerId]);
        if (existing) {
            return res.status(409).json({ error: 'Conflict', message: 'Manager already has a registered store.', traceId });
        }

        const region = storeRegion || 'General';
        const storeRegionFinal = req.user.role === 'Admin' ? 'National' : region;

        const result = await database.run(
            'INSERT INTO Stores (ManagerID, StoreName, StoreCode, StoreRegion) VALUES (?, ?, ?, ?)',
            [req.user.customerId, storeName, storeCode, storeRegionFinal]
        );

        const newStore = await database.get('SELECT * FROM Stores WHERE StoreID = ?', [result.lastID]);
        res.status(201).json({ data: newStore, traceId });
    } catch (err) {
        console.error(`[${traceId}] Store register error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/stores:
 *   get:
 *     summary: List all stores
 *     tags: [Stores]
 *     responses:
 *       200:
 *         description: Array of store records
 */
app.get('/api/v1/stores', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.all(`
            SELECT s.*, c.PhoneNumber, c.FullName, c.Email, c.AccountStatus
            FROM Stores s
            JOIN Customers c ON s.ManagerID = c.CustomerID
            ORDER BY s.StoreID
        `);
        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /stores error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/stores/{id}:
 *   get:
 *     summary: Get store by ID
 *     tags: [Stores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Store record with manager and loyalty account info
 *       404:
 *         description: Store not found
 */
app.get('/api/v1/stores/:id', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.get(`
            SELECT s.*, c.PhoneNumber, c.FullName, c.Email, c.AccountStatus,
                   la.AccountID, la.PointsBalance, la.CurrencyCode
            FROM Stores s
            JOIN Customers c ON s.ManagerID = c.CustomerID
            LEFT JOIN LoyaltyAccounts la ON c.CustomerID = la.CustomerID
            WHERE s.StoreID = ?
        `, [req.params.id]);

        if (!data) {
            return res.status(404).json({ error: 'Not Found', message: 'Store does not exist.', traceId });
        }

        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /stores/:id error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/stores/{id}/activate:
 *   put:
 *     summary: Activate a store (Admin only)
 *     tags: [Stores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Store activated
 *       403:
 *         description: Admin only
 *       404:
 *         description: Store not found
 */
app.put('/api/v1/stores/:id/activate', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const result = await database.run(
            "UPDATE Stores SET StoreStatus = 'Active', UpdatedAt = datetime('now') WHERE StoreID = ?",
            [req.params.id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Store does not exist.', traceId });
        }

        await database.run(
            "INSERT INTO AuditLog (CustomerID, Action, TableAffected, RecordID, NewValue) VALUES (?, 'ACTIVATE', 'Stores', ?, 'Active')",
            [req.user.customerId, String(req.params.id)]
        );

        const updated = await database.get('SELECT * FROM Stores WHERE StoreID = ?', [req.params.id]);
        res.json({ data: updated, traceId });
    } catch (err) {
        console.error(`[${traceId}] Activate store error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/stores/{id}/suspend:
 *   put:
 *     summary: Suspend a store (Admin only)
 *     tags: [Stores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Store suspended
 */
app.put('/api/v1/stores/:id/suspend', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const result = await database.run(
            "UPDATE Stores SET StoreStatus = 'Suspended', UpdatedAt = datetime('now') WHERE StoreID = ?",
            [req.params.id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Store does not exist.', traceId });
        }

        await database.run(
            "INSERT INTO AuditLog (CustomerID, Action, TableAffected, RecordID, NewValue) VALUES (?, 'SUSPEND', 'Stores', ?, 'Suspended')",
            [req.user.customerId, String(req.params.id)]
        );

        const updated = await database.get('SELECT * FROM Stores WHERE StoreID = ?', [req.params.id]);
        res.json({ data: updated, traceId });
    } catch (err) {
        console.error(`[${traceId}] Suspend store error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/stores/{id}/deactivate:
 *   put:
 *     summary: Deactivate a store (Admin only)
 *     tags: [Stores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Store deactivated
 */
app.put('/api/v1/stores/:id/deactivate', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const result = await database.run(
            "UPDATE Stores SET StoreStatus = 'Deactivated', UpdatedAt = datetime('now') WHERE StoreID = ?",
            [req.params.id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Store does not exist.', traceId });
        }

        await database.run(
            "INSERT INTO AuditLog (CustomerID, Action, TableAffected, RecordID, NewValue) VALUES (?, 'DEACTIVATE', 'Stores', ?, 'Deactivated')",
            [req.user.customerId, String(req.params.id)]
        );

        const updated = await database.get('SELECT * FROM Stores WHERE StoreID = ?', [req.params.id]);
        res.json({ data: updated, traceId });
    } catch (err) {
        console.error(`[${traceId}] Deactivate store error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/stores/{id}/orders:
 *   get:
 *     summary: Get orders for a store
 *     tags: [Stores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Store order list
 */
app.get('/api/v1/stores/:id/orders', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();

        // ❌ INTENTIONAL DEFECT: No ownership check — any authenticated user can
        //    view any store's orders by changing the :id parameter.
        //    Students should discover this as a "Least Privilege" violation.

        const data = await database.all(`
            SELECT so.*
            FROM SalesOrders so
            JOIN LoyaltyAccounts la ON so.AccountID = la.AccountID
            JOIN Stores s ON la.CustomerID = s.ManagerID
            WHERE s.StoreID = ?
            ORDER BY so.CreatedAt DESC
        `, [req.params.id]);

        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] Store orders error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/stores/{id}/balance:
 *   get:
 *     summary: Get loyalty account balance for a store manager
 *     tags: [Stores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Store manager account balance
 *       404:
 *         description: Store not found
 */
app.get('/api/v1/stores/:id/balance', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.get(`
            SELECT la.AccountID, la.PointsBalance, la.CurrencyCode, la.LastUpdated, s.StoreName
            FROM LoyaltyAccounts la
            JOIN Customers c ON la.CustomerID = c.CustomerID
            JOIN Stores s ON c.CustomerID = s.ManagerID
            WHERE s.StoreID = ?
        `, [req.params.id]);

        if (!data) {
            return res.status(404).json({ error: 'Not Found', message: 'Store not found.', traceId });
        }

        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] Store balance error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  PRODUCTS
// =====================================================================

/**
 * @swagger
 * /api/v1/products:
 *   get:
 *     summary: List all products
 *     tags: [Products]
 *     security: []
 *     responses:
 *       200:
 *         description: Array of product records
 */
app.get('/api/v1/products', async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.all(`
            SELECT p.*, s.SupplierName, s.Category
            FROM Products p
            JOIN Suppliers s ON p.SupplierID = s.SupplierID
        `);
        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /products error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product record
 *       404:
 *         description: Product not found
 */
app.get('/api/v1/products/:id', async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.get(`
            SELECT p.*, s.SupplierName, s.Category
            FROM Products p
            JOIN Suppliers s ON p.SupplierID = s.SupplierID
            WHERE p.ProductID = ?
        `, [req.params.id]);

        if (!data) {
            return res.status(404).json({ error: 'Not Found', message: 'Product does not exist.', traceId });
        }

        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /products/:id error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/products:
 *   post:
 *     summary: Create a new product (Admin only)
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [supplierId, sku, productName, unitPrice]
 *             properties:
 *               supplierId:
 *                 type: integer
 *                 example: 1
 *               sku:
 *                 type: string
 *                 example: "TNV-SPK-004"
 *               productName:
 *                 type: string
 *                 example: "Bluetooth Speaker"
 *               description:
 *                 type: string
 *                 example: "TechNova Portable Speaker"
 *               unitPrice:
 *                 type: number
 *                 example: 350.00
 *               stockQuantity:
 *                 type: integer
 *                 example: 25
 *     responses:
 *       201:
 *         description: Product created
 *       403:
 *         description: Admin only
 */
app.post('/api/v1/products', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { supplierId, sku, productName, description, unitPrice, stockQuantity } = req.body;

        if (!supplierId || !sku || !productName || unitPrice == null) {
            return res.status(400).json({ error: 'Bad Request', message: 'supplierId, sku, productName, and unitPrice are required.', traceId });
        }

        const database = await getDB();
        const result = await database.run(
            'INSERT INTO Products (SupplierID, SKU, ProductName, Description, UnitPrice, StockQuantity) VALUES (?, ?, ?, ?, ?, ?)',
            [supplierId, sku, productName, description || null, unitPrice, stockQuantity || 0]
        );

        await database.run(
            "INSERT INTO AuditLog (CustomerID, Action, TableAffected, RecordID, NewValue) VALUES (?, 'CREATE_PRODUCT', 'Products', ?, ?)",
            [req.user.customerId, String(result.lastID), productName]
        );

        const newProduct = await database.get('SELECT * FROM Products WHERE ProductID = ?', [result.lastID]);
        res.status(201).json({ data: newProduct, traceId });
    } catch (err) {
        console.error(`[${traceId}] Create product error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/products/{id}:
 *   put:
 *     summary: Update a product (Admin only)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productName:
 *                 type: string
 *               description:
 *                 type: string
 *               unitPrice:
 *                 type: number
 *               stockQuantity:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Product updated
 */
app.put('/api/v1/products/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { productName, description, unitPrice, stockQuantity, isActive } = req.body;
        const sets = [];
        const params = [];

        if (productName !== undefined)   { sets.push('ProductName = ?');   params.push(productName); }
        if (description !== undefined)   { sets.push('Description = ?');   params.push(description); }
        if (unitPrice !== undefined)     { sets.push('UnitPrice = ?');     params.push(unitPrice); }
        if (stockQuantity !== undefined) { sets.push('StockQuantity = ?'); params.push(stockQuantity); }
        if (isActive !== undefined)      { sets.push('IsActive = ?');      params.push(isActive ? 1 : 0); }

        if (sets.length === 0) {
            return res.status(400).json({ error: 'Bad Request', message: 'Nothing to update.', traceId });
        }

        params.push(req.params.id);
        const database = await getDB();
        const result = await database.run(
            `UPDATE Products SET ${sets.join(', ')} WHERE ProductID = ?`,
            params
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Product does not exist.', traceId });
        }

        const updated = await database.get('SELECT * FROM Products WHERE ProductID = ?', [req.params.id]);
        res.json({ data: updated, traceId });
    } catch (err) {
        console.error(`[${traceId}] Update product error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  LOYALTY ACCOUNTS
// =====================================================================

/**
 * @swagger
 * /api/v1/accounts/{id}:
 *   get:
 *     summary: Get loyalty account by ID
 *     tags: [LoyaltyAccounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Loyalty account record
 *       404:
 *         description: Account not found
 */
app.get('/api/v1/accounts/:id', async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.get(`
            SELECT la.*, c.FullName, c.PhoneNumber, c.AccountStatus
            FROM LoyaltyAccounts la
            JOIN Customers c ON la.CustomerID = c.CustomerID
            WHERE la.AccountID = ?
        `, [req.params.id]);

        if (!data) {
            return res.status(404).json({ error: 'Not Found', message: 'Loyalty account does not exist.', traceId });
        }

        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /accounts/:id error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/accounts/{id}/topup:
 *   post:
 *     summary: Top up a loyalty account (Admin only)
 *     tags: [LoyaltyAccounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 1000.00
 *     responses:
 *       200:
 *         description: Account topped up
 */
app.post('/api/v1/accounts/:id/topup', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Bad Request', message: 'amount must be a positive number.', traceId });
        }

        const database = await getDB();
        const current = await database.get('SELECT PointsBalance FROM LoyaltyAccounts WHERE AccountID = ?', [req.params.id]);

        if (!current) {
            return res.status(404).json({ error: 'Not Found', message: 'Loyalty account does not exist.', traceId });
        }

        const oldBalance = current.PointsBalance;

        await database.run(
            "UPDATE LoyaltyAccounts SET PointsBalance = PointsBalance + ?, LastUpdated = datetime('now') WHERE AccountID = ?",
            [amount, req.params.id]
        );

        const updated = await database.get('SELECT * FROM LoyaltyAccounts WHERE AccountID = ?', [req.params.id]);

        await database.run(
            "INSERT INTO AuditLog (CustomerID, Action, TableAffected, RecordID, OldValue, NewValue) VALUES (?, 'TOPUP_ACCOUNT', 'LoyaltyAccounts', ?, ?, ?)",
            [req.user.customerId, String(req.params.id), String(oldBalance), String(updated.PointsBalance)]
        );

        res.json({ data: updated, traceId });
    } catch (err) {
        console.error(`[${traceId}] Account topup error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/accounts/{id}/history:
 *   get:
 *     summary: Get order history for a loyalty account
 *     tags: [LoyaltyAccounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Order list for the account
 */
app.get('/api/v1/accounts/:id/history', async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.all(`
            SELECT so.*, p.SKU, p.ProductName, p.Description AS ProductDescription
            FROM SalesOrders so
            JOIN Products p ON so.ProductID = p.ProductID
            WHERE so.AccountID = ?
            ORDER BY so.CreatedAt DESC
        `, [req.params.id]);

        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] Account history error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  ORDERS
// =====================================================================

/**
 * @swagger
 * /api/v1/orders:
 *   get:
 *     summary: List orders (optional accountId / status filter)
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: accountId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Completed, Pending, Failed]
 *     responses:
 *       200:
 *         description: Array of sales orders
 */
app.get('/api/v1/orders', async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        let query = 'SELECT * FROM SalesOrders WHERE 1=1';
        const params = [];

        if (req.query.accountId) {
            query += ' AND AccountID = ?';
            params.push(req.query.accountId);
        }
        if (req.query.status) {
            query += ' AND OrderStatus = ?';
            params.push(req.query.status);
        }

        query += ' ORDER BY CreatedAt DESC';
        const data = await database.all(query, params);
        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /orders error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/orders/{id}:
 *   get:
 *     summary: Get a single order by OrderID
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Sales order record
 *       404:
 *         description: Order not found
 */
app.get('/api/v1/orders/:id', async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.get('SELECT * FROM SalesOrders WHERE OrderID = ?', [req.params.id]);

        if (!data) {
            return res.status(404).json({ error: 'Not Found', message: 'Order not found.', traceId });
        }

        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /orders/:id error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  RECEIPTS
// =====================================================================

/**
 * @swagger
 * /api/v1/receipts:
 *   get:
 *     summary: List all receipts (includes expired — intentional defect)
 *     tags: [Receipts]
 *     responses:
 *       200:
 *         description: Array of receipt records
 */
app.get('/api/v1/receipts', async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.all(`
            SELECT r.*, so.AccountID, so.ProductID, so.TotalAmount, so.OrderReference
            FROM Receipts r
            JOIN SalesOrders so ON r.OrderID = so.OrderID
            ORDER BY r.ReceiptID DESC
        `);
        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /receipts error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/receipts/{id}:
 *   get:
 *     summary: Get receipt by ID
 *     tags: [Receipts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Receipt record
 *       404:
 *         description: Receipt not found
 */
app.get('/api/v1/receipts/:id', async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.get(`
            SELECT r.*, so.AccountID, so.ProductID, so.TotalAmount, so.OrderReference
            FROM Receipts r
            JOIN SalesOrders so ON r.OrderID = so.OrderID
            WHERE r.ReceiptID = ?
        `, [req.params.id]);

        if (!data) {
            return res.status(404).json({ error: 'Not Found', message: 'Receipt does not exist.', traceId });
        }

        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /receipts/:id error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  DISCOUNTS
// =====================================================================

/**
 * @swagger
 * /api/v1/discounts:
 *   get:
 *     summary: List all discount rules
 *     tags: [Discounts]
 *     responses:
 *       200:
 *         description: Array of discount rules
 */
app.get('/api/v1/discounts', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.all(`
            SELECT d.*, p.SKU, p.ProductName AS ProductDescription
            FROM Discounts d
            JOIN Products p ON d.ProductID = p.ProductID
            ORDER BY d.ProductID, d.MembershipTier
        `);
        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /discounts error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/discounts/{id}:
 *   get:
 *     summary: Get discount rule by ID
 *     tags: [Discounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Discount rule
 *       404:
 *         description: Not found
 */
app.get('/api/v1/discounts/:id', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.get(`
            SELECT d.*, p.SKU, p.ProductName AS ProductDescription
            FROM Discounts d
            JOIN Products p ON d.ProductID = p.ProductID
            WHERE d.DiscountID = ?
        `, [req.params.id]);

        if (!data) {
            return res.status(404).json({ error: 'Not Found', message: 'Discount rule not found.', traceId });
        }

        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /discounts/:id error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/discounts:
 *   post:
 *     summary: Create a discount rule (Admin only)
 *     tags: [Discounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, membershipTier, discountPercentage]
 *             properties:
 *               productId:
 *                 type: integer
 *                 example: 1
 *               membershipTier:
 *                 type: string
 *                 enum: [Standard, Premium, Gold]
 *                 example: "Standard"
 *               discountPercentage:
 *                 type: number
 *                 example: 7.5
 *     responses:
 *       201:
 *         description: Discount rule created
 */
app.post('/api/v1/discounts', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { productId, membershipTier, discountPercentage } = req.body;

        if (!productId || !membershipTier || discountPercentage == null) {
            return res.status(400).json({ error: 'Bad Request', message: 'productId, membershipTier, and discountPercentage are required.', traceId });
        }

        const database = await getDB();
        const result = await database.run(
            'INSERT INTO Discounts (ProductID, MembershipTier, DiscountPercentage) VALUES (?, ?, ?)',
            [productId, membershipTier, discountPercentage]
        );

        const newDiscount = await database.get('SELECT * FROM Discounts WHERE DiscountID = ?', [result.lastID]);
        res.status(201).json({ data: newDiscount, traceId });
    } catch (err) {
        console.error(`[${traceId}] Create discount error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/discounts/{id}:
 *   put:
 *     summary: Update a discount rule (Admin only)
 *     tags: [Discounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               discountPercentage:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Discount rule updated
 */
app.put('/api/v1/discounts/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { discountPercentage, isActive } = req.body;
        const sets = [];
        const params = [];

        const database = await getDB();
        const old = await database.get('SELECT DiscountPercentage FROM Discounts WHERE DiscountID = ?', [req.params.id]);

        if (discountPercentage !== undefined) { sets.push('DiscountPercentage = ?'); params.push(discountPercentage); }
        if (isActive !== undefined)           { sets.push('IsActive = ?');           params.push(isActive ? 1 : 0); }

        if (sets.length === 0) {
            return res.status(400).json({ error: 'Bad Request', message: 'Nothing to update.', traceId });
        }

        params.push(req.params.id);
        const result = await database.run(
            `UPDATE Discounts SET ${sets.join(', ')} WHERE DiscountID = ?`,
            params
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Discount rule not found.', traceId });
        }

        const updated = await database.get('SELECT * FROM Discounts WHERE DiscountID = ?', [req.params.id]);

        await database.run(
            "INSERT INTO AuditLog (CustomerID, Action, TableAffected, RecordID, OldValue, NewValue) VALUES (?, 'UPDATE_DISCOUNT', 'Discounts', ?, ?, ?)",
            [req.user.customerId, String(req.params.id), old ? String(old.DiscountPercentage) : null, String(updated.DiscountPercentage)]
        );

        res.json({ data: updated, traceId });
    } catch (err) {
        console.error(`[${traceId}] Update discount error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/discounts/{id}:
 *   delete:
 *     summary: Delete a discount rule (Admin only)
 *     tags: [Discounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Discount rule deleted
 */
app.delete('/api/v1/discounts/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const existing = await database.get('SELECT * FROM Discounts WHERE DiscountID = ?', [req.params.id]);

        if (!existing) {
            return res.status(404).json({ error: 'Not Found', message: 'Discount rule not found.', traceId });
        }

        await database.run('DELETE FROM Discounts WHERE DiscountID = ?', [req.params.id]);
        res.json({ data: existing, message: 'Deleted.', traceId });
    } catch (err) {
        console.error(`[${traceId}] Delete discount error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  RETURNS
// =====================================================================

/**
 * @swagger
 * /api/v1/returns:
 *   get:
 *     summary: List all return records
 *     tags: [Returns]
 *     responses:
 *       200:
 *         description: Array of return records
 */
app.get('/api/v1/returns', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.all(`
            SELECT r.*, s.StoreName
            FROM Returns r
            JOIN Stores s ON r.StoreID = s.StoreID
            ORDER BY r.CreatedAt DESC
        `);
        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /returns error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/returns/{id}:
 *   get:
 *     summary: Get return record by ID
 *     tags: [Returns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Return record
 *       404:
 *         description: Return not found
 */
app.get('/api/v1/returns/:id', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.get(`
            SELECT r.*, s.StoreName
            FROM Returns r
            JOIN Stores s ON r.StoreID = s.StoreID
            WHERE r.ReturnID = ?
        `, [req.params.id]);

        if (!data) {
            return res.status(404).json({ error: 'Not Found', message: 'Return record not found.', traceId });
        }

        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /returns/:id error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/returns/calculate:
 *   post:
 *     summary: Calculate and create a return record for a store (Admin only)
 *     tags: [Returns]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [storeId, periodStart, periodEnd]
 *             properties:
 *               storeId:
 *                 type: integer
 *                 example: 1
 *               periodStart:
 *                 type: string
 *                 format: date
 *                 example: "2024-01-01"
 *               periodEnd:
 *                 type: string
 *                 format: date
 *                 example: "2024-01-31"
 *     responses:
 *       201:
 *         description: Return record calculated
 */
app.post('/api/v1/returns/calculate', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { storeId, periodStart, periodEnd } = req.body;

        if (!storeId || !periodStart || !periodEnd) {
            return res.status(400).json({ error: 'Bad Request', message: 'storeId, periodStart, and periodEnd are required.', traceId });
        }

        const database = await getDB();

        const totals = await database.get(`
            SELECT
                COALESCE(SUM(so.TotalAmount), 0) AS gross,
                COALESCE(SUM(so.DiscountAmount), 0) AS disc
            FROM SalesOrders so
            JOIN LoyaltyAccounts la ON so.AccountID = la.AccountID
            JOIN Stores s ON la.CustomerID = s.ManagerID
            WHERE s.StoreID = ?
              AND so.OrderStatus = 'Completed'
              AND so.CreatedAt BETWEEN ? AND ?
        `, [storeId, periodStart, periodEnd]);

        // ❌ DEFECT: Net = Gross - Disc calculated with REAL (rounding)
        const gross = totals.gross;
        const disc  = totals.disc;
        const net   = gross - disc;

        const result = await database.run(
            "INSERT INTO Returns (StoreID, PeriodStart, PeriodEnd, GrossAmount, DiscountAmount, NetAmount, ReturnStatus) VALUES (?, ?, ?, ?, ?, ?, 'Pending')",
            [storeId, periodStart, periodEnd, gross, disc, net]
        );

        const newReturn = await database.get('SELECT * FROM Returns WHERE ReturnID = ?', [result.lastID]);
        res.status(201).json({ data: newReturn, traceId });
    } catch (err) {
        console.error(`[${traceId}] Calculate return error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  SALES — equivalent of Distribution
// =====================================================================

/**
 * @swagger
 * /api/v1/sales/process:
 *   post:
 *     summary: Process a single product sale and generate receipt
 *     tags: [Sales]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accountId, productId, reference]
 *             properties:
 *               accountId:
 *                 type: integer
 *                 example: 1
 *               productId:
 *                 type: integer
 *                 example: 1
 *               reference:
 *                 type: string
 *                 example: "REF-001"
 *     responses:
 *       201:
 *         description: Sale processed — receipt code returned
 *       400:
 *         description: Missing fields
 */
app.post('/api/v1/sales/process', async (req, res) => {
    const traceId = uuidv4();
    try {
        const { accountId, productId, reference } = req.body;

        if (!accountId || !productId || !reference) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'accountId, productId, and reference are required.',
                traceId
            });
        }

        const database = await getDB();
        const { orderId, receiptCode } = await processSale(database, accountId, productId, reference);

        res.status(201).json({
            status: 'SUCCESS',
            receiptCode,
            orderId,
            traceId
        });
    } catch (err) {
        console.error(`[${traceId}] Process-sale error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/sales/bulk-purchase:
 *   post:
 *     summary: Process multiple sales in a single request
 *     tags: [Sales]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accountId, productId, quantity]
 *             properties:
 *               accountId:
 *                 type: integer
 *                 example: 1
 *               productId:
 *                 type: integer
 *                 example: 1
 *               quantity:
 *                 type: integer
 *                 example: 5
 *     responses:
 *       201:
 *         description: Bulk sales processed
 *       400:
 *         description: Validation error
 */
app.post('/api/v1/sales/bulk-purchase', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const { accountId, productId, quantity } = req.body;

        if (!accountId || !productId || !quantity || quantity < 1 || quantity > 20) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'accountId, productId, and quantity (1-20) are required.',
                traceId
            });
        }

        const database = await getDB();
        const receipts = [];

        // ❌ INTENTIONAL DEFECT: No total-cost balance check before loop.
        //    Individual processSale calls may each succeed even if the
        //    account cannot afford all items.

        for (let i = 0; i < quantity; i++) {
            const ref = `BULK-${traceId.slice(0, 8)}-${i + 1}`;
            const { orderId, receiptCode } = await processSale(database, accountId, productId, ref);
            receipts.push({ receiptCode, reference: ref, orderId });
        }

        res.status(201).json({ status: 'SUCCESS', count: receipts.length, receipts, traceId });
    } catch (err) {
        console.error(`[${traceId}] Bulk-purchase error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  ADMIN — Sensitive endpoints for RBAC testing
// =====================================================================

/**
 * @swagger
 * /api/v1/admin/ledger:
 *   get:
 *     summary: Global sales ledger (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Full ledger view
 *       401:
 *         description: Token required
 *       403:
 *         description: Admin only
 */
// ❌ INTENTIONAL DEFECT: Missing requireRole('Admin') — only checks that a valid
//    token exists.  A StoreManager token will succeed here.
//    Students should discover this privilege-escalation vulnerability.
app.get('/api/v1/admin/ledger', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.all(`
            SELECT so.*, la.PointsBalance AS AccountBalance, c.FullName, c.Role,
                   p.SKU, p.ProductName AS ProductDescription
            FROM SalesOrders so
            JOIN LoyaltyAccounts la ON so.AccountID = la.AccountID
            JOIN Customers c ON la.CustomerID = c.CustomerID
            JOIN Products p ON so.ProductID = p.ProductID
            ORDER BY so.CreatedAt DESC
        `);
        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] Admin ledger error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/admin/customers:
 *   get:
 *     summary: All customers with sensitive data (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Full customer list including roles and balances
 *       403:
 *         description: Admin only
 */
app.get('/api/v1/admin/customers', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.all(`
            SELECT c.*, la.AccountID, la.PointsBalance, la.CurrencyCode
            FROM Customers c
            LEFT JOIN LoyaltyAccounts la ON c.CustomerID = la.CustomerID
            ORDER BY c.CustomerID
        `);
        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] Admin customers error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/admin/stores:
 *   get:
 *     summary: All stores with financials (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Store list with financial data
 *       403:
 *         description: Admin only
 */
app.get('/api/v1/admin/stores', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.all(`
            SELECT s.*, c.FullName, c.Email, c.AccountStatus,
                   la.PointsBalance, la.CurrencyCode,
                   (SELECT COUNT(*) FROM SalesOrders so
                    JOIN LoyaltyAccounts la2 ON so.AccountID = la2.AccountID
                    WHERE la2.CustomerID = s.ManagerID) AS OrderCount,
                   (SELECT COALESCE(SUM(so.TotalAmount), 0) FROM SalesOrders so
                    JOIN LoyaltyAccounts la2 ON so.AccountID = la2.AccountID
                    WHERE la2.CustomerID = s.ManagerID AND so.OrderStatus = 'Completed') AS TotalRevenue
            FROM Stores s
            JOIN Customers c ON s.ManagerID = c.CustomerID
            LEFT JOIN LoyaltyAccounts la ON c.CustomerID = la.CustomerID
            ORDER BY TotalRevenue DESC
        `);
        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] Admin stores error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/admin/returns:
 *   get:
 *     summary: All returns (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Full return list
 *       403:
 *         description: Admin only
 */
app.get('/api/v1/admin/returns', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.all(`
            SELECT r.*, s.StoreName, c.FullName
            FROM Returns r
            JOIN Stores s ON r.StoreID = s.StoreID
            JOIN Customers c ON s.ManagerID = c.CustomerID
            ORDER BY r.CreatedAt DESC
        `);
        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] Admin returns error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/admin/reports/revenue:
 *   get:
 *     summary: Revenue report grouped by supplier (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Revenue breakdown by supplier
 */
app.get('/api/v1/admin/reports/revenue', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.all(`
            SELECT s.SupplierName, p.SKU, p.ProductName,
                   COUNT(*) AS TotalOrders,
                   SUM(so.TotalAmount) AS TotalRevenue,
                   SUM(so.DiscountAmount) AS TotalDiscounts
            FROM SalesOrders so
            JOIN Products p ON so.ProductID = p.ProductID
            JOIN Suppliers s ON p.SupplierID = s.SupplierID
            WHERE so.OrderStatus = 'Completed'
            GROUP BY s.SupplierName, p.SKU, p.ProductName
            ORDER BY TotalRevenue DESC
        `);
        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] Revenue report error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/admin/reports/top-stores:
 *   get:
 *     summary: Top 10 stores by revenue (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Top stores list
 */
app.get('/api/v1/admin/reports/top-stores', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.all(`
            SELECT s.StoreID, s.StoreName, s.StoreRegion,
                   COUNT(*) AS OrderCount,
                   SUM(so.TotalAmount) AS TotalRevenue,
                   SUM(so.DiscountAmount) AS TotalDiscounts
            FROM Stores s
            JOIN Customers c ON s.ManagerID = c.CustomerID
            JOIN LoyaltyAccounts la ON c.CustomerID = la.CustomerID
            JOIN SalesOrders so ON la.AccountID = so.AccountID
            WHERE so.OrderStatus = 'Completed'
            GROUP BY s.StoreID, s.StoreName, s.StoreRegion
            ORDER BY TotalRevenue DESC
            LIMIT 10
        `);
        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] Top stores error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/admin/discount-rates:
 *   put:
 *     summary: Bulk-update discount rates for a membership tier (Admin only)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [membershipTier, adjustmentPercent]
 *             properties:
 *               membershipTier:
 *                 type: string
 *                 example: "Standard"
 *               adjustmentPercent:
 *                 type: number
 *                 example: 1.5
 *     responses:
 *       200:
 *         description: Discount rates updated
 */
app.put('/api/v1/admin/discount-rates', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { membershipTier, adjustmentPercent } = req.body;

        if (!membershipTier || adjustmentPercent == null) {
            return res.status(400).json({ error: 'Bad Request', message: 'membershipTier and adjustmentPercent are required.', traceId });
        }

        const database = await getDB();
        await database.run(
            'UPDATE Discounts SET DiscountPercentage = DiscountPercentage + ? WHERE MembershipTier = ? AND IsActive = 1',
            [adjustmentPercent, membershipTier]
        );

        const updated = await database.all(
            'SELECT * FROM Discounts WHERE MembershipTier = ? AND IsActive = 1',
            [membershipTier]
        );

        await database.run(
            "INSERT INTO AuditLog (CustomerID, Action, TableAffected, RecordID, NewValue) VALUES (?, 'BULK_RATE_UPDATE', 'Discounts', 'ALL', ?)",
            [req.user.customerId, `Tier ${membershipTier} adjusted by ${adjustmentPercent}%`]
        );

        res.json({ data: updated, updated: updated.length, traceId });
    } catch (err) {
        console.error(`[${traceId}] Bulk discount update error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/admin/audit-log:
 *   get:
 *     summary: View audit log (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Audit trail
 */
app.get('/api/v1/admin/audit-log', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const database = await getDB();
        const data = await database.all(`
            SELECT al.*, c.FullName AS PerformedBy
            FROM AuditLog al
            LEFT JOIN Customers c ON al.CustomerID = c.CustomerID
            ORDER BY al.Timestamp DESC
        `);
        res.json({ data, traceId });
    } catch (err) {
        console.error(`[${traceId}] Audit log error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// ─── Start Server ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

initDatabase()
    .then(() => {
        app.listen(PORT, () =>
            console.log(`Kabu Retail Gateway: Port ${PORT} | Docs: http://localhost:${PORT}/api-docs`)
        );
    })
    .catch(err => {
        console.error('Failed to initialise database:', err.message);
        process.exit(1);
    });
