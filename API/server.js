const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());
app.use(cors());

// ─── Database Connection ─────────────────────────────────────────────
// Uses SQL Authentication with the sa account.
// Run Database/Setup.sql first to enable the sa login.
const dbConfig = {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'KoboFintech',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'Password123',
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// Connection pool (reused across requests)
let pool;
async function getPool() {
    if (!pool) {
        pool = await sql.connect(dbConfig);
    }
    return pool;
}

// ─── Swagger Documentation ───────────────────────────────────────────
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Kobo Fintech Distribution API',
            version: '1.0.0',
            description: 'Core gateway for digital product issuance and ledger management.'
        },
        servers: [{ url: 'http://localhost:3000' }]
    },
    apis: ['./server.js'],
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// =====================================================================
//  USERS
// =====================================================================

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: List all users
 *     description: Returns every user record with their service status.
 *     tags:
 *       - Users
 *     responses:
 *       200:
 *         description: Array of user records
 *       500:
 *         description: Internal Server Error
 */
app.get('/api/v1/users', async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query('SELECT * FROM Users');
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /users error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Returns a single user with their wallet information.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The User ID
 *     responses:
 *       200:
 *         description: User record with wallet
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal Server Error
 */
app.get('/api/v1/users/:id', async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('UserID', sql.Int, req.params.id)
            .query(`
                SELECT u.*, w.WalletID, w.Balance, w.CurrencyCode
                FROM Users u
                LEFT JOIN Wallets w ON u.UserID = w.UserID
                WHERE u.UserID = @UserID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'User does not exist.', traceId });
        }

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /users/:id error:`, err.message);
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
 *     description: Returns every available product with provider details.
 *     tags:
 *       - Products
 *     responses:
 *       200:
 *         description: Array of product records
 *       500:
 *         description: Internal Server Error
 */
app.get('/api/v1/products', async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT p.*, sp.ProviderName, sp.Category
            FROM Products p
            JOIN ServiceProviders sp ON p.ProviderID = sp.ProviderID
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /products error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  WALLETS
// =====================================================================

/**
 * @swagger
 * /api/v1/wallets/{id}:
 *   get:
 *     summary: Get wallet by ID
 *     description: Returns wallet balance and owner details.
 *     tags:
 *       - Wallets
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The Wallet ID
 *     responses:
 *       200:
 *         description: Wallet record
 *       404:
 *         description: Wallet not found
 *       500:
 *         description: Internal Server Error
 */
app.get('/api/v1/wallets/:id', async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('WalletID', sql.Int, req.params.id)
            .query(`
                SELECT w.*, u.FullName, u.MSISDN, u.ServiceStatus
                FROM Wallets w
                JOIN Users u ON w.UserID = u.UserID
                WHERE w.WalletID = @WalletID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Wallet does not exist.', traceId });
        }

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /wallets/:id error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  TRANSACTIONS
// =====================================================================

/**
 * @swagger
 * /api/v1/transactions:
 *   get:
 *     summary: List all transactions
 *     description: Returns ledger entries. Optionally filter by walletId.
 *     tags:
 *       - Transactions
 *     parameters:
 *       - in: query
 *         name: walletId
 *         schema:
 *           type: integer
 *         description: Filter by Wallet ID
 *     responses:
 *       200:
 *         description: Array of ledger entries
 *       500:
 *         description: Internal Server Error
 */
app.get('/api/v1/transactions', async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const request = db.request();
        let query = 'SELECT * FROM TransactionLedger';

        if (req.query.walletId) {
            query += ' WHERE WalletID = @WalletID';
            request.input('WalletID', sql.Int, req.query.walletId);
        }

        query += ' ORDER BY CreatedTimestamp DESC';
        const result = await request.query(query);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /transactions error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  VOUCHERS
// =====================================================================

/**
 * @swagger
 * /api/v1/vouchers:
 *   get:
 *     summary: List all vouchers
 *     description: Returns all issued digital vouchers with linked transaction details.
 *     tags:
 *       - Vouchers
 *     responses:
 *       200:
 *         description: Array of voucher records
 *       500:
 *         description: Internal Server Error
 */
app.get('/api/v1/vouchers', async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT v.*, t.WalletID, t.ProductID, t.Amount, t.ExternalReference
            FROM DigitalVouchers v
            JOIN TransactionLedger t ON v.EntryID = t.EntryID
            ORDER BY v.VoucherID DESC
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /vouchers error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  DISTRIBUTION — Issue Voucher
// =====================================================================

/**
 * @swagger
 * /api/v1/distribution/issue-voucher:
 *   post:
 *     summary: Issue digital voucher
 *     description: Debits wallet and generates a secure voucher PIN.
 *     tags:
 *       - Distribution
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletId
 *               - productId
 *               - reference
 *             properties:
 *               walletId:
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
 *         description: Voucher Issued Successfully
 *       400:
 *         description: Bad Request - Missing required fields
 *       500:
 *         description: Internal Server Error
 */
app.post('/api/v1/distribution/issue-voucher', async (req, res) => {
    const traceId = uuidv4();
    try {
        const { walletId, productId, reference } = req.body;

        // Input validation
        if (!walletId || !productId || !reference) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'walletId, productId, and reference are required.',
                traceId
            });
        }

        const db = await getPool();
        const result = await db.request()
            .input('WalletID', sql.Int, walletId)
            .input('ProductID', sql.Int, productId)
            .input('Ref', sql.NVarChar, reference)
            .execute('usp_IssueDigitalVoucher');

        if (!result.recordset || result.recordset.length === 0) {
            return res.status(500).json({
                error: 'Processing Error',
                message: 'Voucher generation returned no data.',
                traceId
            });
        }

        res.status(201).json({
            status: 'SUCCESS',
            pin: result.recordset[0].PinData,
            traceId
        });
    } catch (err) {
        console.error(`[${traceId}] Issue-voucher error:`, err.message);
        res.status(500).json({
            error: 'Service Error',
            message: err.message,
            traceId
        });
    }
});

// ─── Start Server ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kobo Services: Port ${PORT}`));