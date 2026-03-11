const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());
app.use(cors());

// ─── Configuration ───────────────────────────────────────────────────
// NOTE: The fallback JWT_SECRET is for local/educational use only.
//       In a production environment, always provide a strong secret via
//       the JWT_SECRET environment variable and fail if it is missing.
const JWT_SECRET = process.env.JWT_SECRET || 'kobo-fintech-secret-2024';
const JWT_EXPIRY = '24h';

// ─── Database Connection ─────────────────────────────────────────────
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

let pool;
async function getPool() {
    if (!pool) {
        pool = await sql.connect(dbConfig);
        pool.on('error', () => { pool = null; });
    }
    return pool;
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
            title: 'Kobo Business — Merchant & Settlement Gateway',
            version: '2.0.0',
            description:
                'Distribution gateway for digital product issuance, merchant lifecycle management, ' +
                'commission settlement, and financial ledger operations.\n\n' +
                '**Default credentials** — any seeded user with password `Password123`.\n' +
                'Admin emails: `kabo@kobo.co.za`, `thandi@kobo.co.za`, `sipho@kobo.co.za`.'
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
//  AUTH
// =====================================================================

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [msisdn, fullName, email, password]
 *             properties:
 *               msisdn:
 *                 type: string
 *                 example: "27110009999"
 *               fullName:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 example: "john@kobo.co.za"
 *               password:
 *                 type: string
 *                 example: "SecurePass1"
 *               role:
 *                 type: string
 *                 enum: [User, Merchant]
 *                 example: "Merchant"
 *     responses:
 *       201:
 *         description: User registered
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate MSISDN or email
 */
app.post('/api/v1/auth/register', async (req, res) => {
    const traceId = uuidv4();
    try {
        const { msisdn, fullName, email, password, role } = req.body;

        if (!msisdn || !fullName || !email || !password) {
            return res.status(400).json({ error: 'Bad Request', message: 'msisdn, fullName, email, and password are required.', traceId });
        }

        // Password strength check
        if (password.length < 8) {
            return res.status(400).json({ error: 'Bad Request', message: 'Password must be at least 8 characters.', traceId });
        }

        const allowedRoles = ['User', 'Merchant'];
        const userRole = allowedRoles.includes(role) ? role : 'User';

        const hashedPassword = await bcrypt.hash(password, 10);

        const db = await getPool();

        // Check duplicate MSISDN
        const dup = await db.request().input('MSISDN', sql.NVarChar, msisdn).query('SELECT UserID FROM Users WHERE MSISDN = @MSISDN');
        if (dup.recordset.length > 0) {
            return res.status(409).json({ error: 'Conflict', message: 'MSISDN already registered.', traceId });
        }

        const result = await db.request()
            .input('MSISDN', sql.NVarChar, msisdn)
            .input('FullName', sql.NVarChar, fullName)
            .input('Email', sql.NVarChar, email)
            .input('PasswordHash', sql.NVarChar, hashedPassword)
            .input('Role', sql.NVarChar, userRole)
            .query(`
                INSERT INTO Users (MSISDN, FullName, Email, PasswordHash, Role)
                OUTPUT INSERTED.UserID, INSERTED.MSISDN, INSERTED.FullName, INSERTED.Email, INSERTED.Role
                VALUES (@MSISDN, @FullName, @Email, @PasswordHash, @Role)
            `);

        const newUser = result.recordset[0];

        // Create wallet for the new user
        await db.request()
            .input('UserID', sql.Int, newUser.UserID)
            .query('INSERT INTO Wallets (UserID, Balance) VALUES (@UserID, 0)');

        res.status(201).json({ data: newUser, traceId });
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
 *                 example: "kabo@kobo.co.za"
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

        const db = await getPool();
        const result = await db.request()
            .input('Email', sql.NVarChar, email)
            .query('SELECT * FROM Users WHERE Email = @Email');

        if (result.recordset.length === 0) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password.', traceId });
        }

        const user = result.recordset[0];
        const validPassword = await bcrypt.compare(password, user.PasswordHash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password.', traceId });
        }

        const token = jwt.sign(
            { userId: user.UserID, email: user.Email, role: user.Role, msisdn: user.MSISDN },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRY }
        );

        res.json({
            token,
            user: { userId: user.UserID, fullName: user.FullName, email: user.Email, role: user.Role },
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
 *     summary: Get current user profile from JWT
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Unauthorized
 */
app.get('/api/v1/auth/profile', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('UserID', sql.Int, req.user.userId)
            .query(`
                SELECT u.UserID, u.MSISDN, u.FullName, u.Email, u.Role, u.AccountTier,
                       u.ServiceStatus, u.CreatedAt, w.WalletID, w.Balance, w.CurrencyCode
                FROM Users u
                LEFT JOIN Wallets w ON u.UserID = w.UserID
                WHERE u.UserID = @UserID
            `);

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Profile error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  USERS
// =====================================================================

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: List all users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Array of user records
 */
app.get('/api/v1/users', async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(
            'SELECT UserID, MSISDN, FullName, Email, Role, AccountTier, ServiceStatus, CreatedAt FROM Users'
        );
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
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User record with wallet
 *       404:
 *         description: User not found
 */
app.get('/api/v1/users/:id', async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('UserID', sql.Int, req.params.id)
            .query(`
                SELECT u.UserID, u.MSISDN, u.FullName, u.Email, u.Role, u.AccountTier,
                       u.ServiceStatus, u.CreatedAt, w.WalletID, w.Balance, w.CurrencyCode
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
//  MERCHANTS
// =====================================================================

/**
 * @swagger
 * /api/v1/merchants/register:
 *   post:
 *     summary: Register as a merchant (requires Merchant role)
 *     tags: [Merchants]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [businessName, registrationNumber]
 *             properties:
 *               businessName:
 *                 type: string
 *                 example: "Kabo Traders"
 *               registrationNumber:
 *                 type: string
 *                 example: "REG-2024-0100"
 *     responses:
 *       201:
 *         description: Merchant registered (Pending status)
 *       400:
 *         description: Validation error
 *       403:
 *         description: Only Merchant-role users may register
 */
app.post('/api/v1/merchants/register', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const { businessName, registrationNumber } = req.body;

        if (!businessName || !registrationNumber) {
            return res.status(400).json({ error: 'Bad Request', message: 'businessName and registrationNumber are required.', traceId });
        }

        // Validate registration number format (REG-YYYY-NNNN)
        if (!/^REG-\d{4}-\d{4}$/.test(registrationNumber)) {
            return res.status(400).json({ error: 'Bad Request', message: 'registrationNumber must match format REG-YYYY-NNNN.', traceId });
        }

        if (req.user.role !== 'Merchant' && req.user.role !== 'Admin') {
            return res.status(403).json({ error: 'Forbidden', message: 'Only Merchant or Admin users may register a merchant profile.', traceId });
        }

        const db = await getPool();

        // Check for existing merchant profile
        const existing = await db.request()
            .input('UserID', sql.Int, req.user.userId)
            .query('SELECT MerchantID FROM Merchants WHERE UserID = @UserID');
        if (existing.recordset.length > 0) {
            return res.status(409).json({ error: 'Conflict', message: 'User already has a merchant profile.', traceId });
        }

        const tier = req.user.role === 'Admin' ? 'Enterprise' : 'Standard';

        const result = await db.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('BusinessName', sql.NVarChar, businessName)
            .input('RegistrationNumber', sql.NVarChar, registrationNumber)
            .input('MerchantTier', sql.NVarChar, tier)
            .query(`
                INSERT INTO Merchants (UserID, BusinessName, RegistrationNumber, MerchantTier)
                OUTPUT INSERTED.*
                VALUES (@UserID, @BusinessName, @RegistrationNumber, @MerchantTier)
            `);

        res.status(201).json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Merchant register error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/merchants:
 *   get:
 *     summary: List all merchants
 *     tags: [Merchants]
 *     responses:
 *       200:
 *         description: Array of merchant records
 */
app.get('/api/v1/merchants', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT m.*, u.MSISDN, u.FullName, u.Email, u.ServiceStatus
            FROM Merchants m
            JOIN Users u ON m.UserID = u.UserID
            ORDER BY m.MerchantID
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /merchants error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/merchants/{id}:
 *   get:
 *     summary: Get merchant by ID
 *     tags: [Merchants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Merchant record with user & wallet info
 *       404:
 *         description: Merchant not found
 */
app.get('/api/v1/merchants/:id', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('MerchantID', sql.Int, req.params.id)
            .query(`
                SELECT m.*, u.MSISDN, u.FullName, u.Email, u.ServiceStatus,
                       w.WalletID, w.Balance, w.CurrencyCode
                FROM Merchants m
                JOIN Users u ON m.UserID = u.UserID
                LEFT JOIN Wallets w ON u.UserID = w.UserID
                WHERE m.MerchantID = @MerchantID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Merchant does not exist.', traceId });
        }

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /merchants/:id error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/merchants/{id}/activate:
 *   put:
 *     summary: Activate a merchant (Admin only)
 *     tags: [Merchants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Merchant activated
 *       403:
 *         description: Admin only
 *       404:
 *         description: Merchant not found
 */
app.put('/api/v1/merchants/:id/activate', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('MerchantID', sql.Int, req.params.id)
            .query(`
                UPDATE Merchants SET MerchantStatus = 'Active', UpdatedAt = GETDATE()
                OUTPUT INSERTED.*
                WHERE MerchantID = @MerchantID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Merchant does not exist.', traceId });
        }

        // Audit log
        await db.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('RecordID', sql.NVarChar, String(req.params.id))
            .query("INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID, NewValue) VALUES (@UserID, 'ACTIVATE', 'Merchants', @RecordID, 'Active')");

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Activate merchant error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/merchants/{id}/suspend:
 *   put:
 *     summary: Suspend a merchant (Admin only)
 *     tags: [Merchants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Merchant suspended
 */
app.put('/api/v1/merchants/:id/suspend', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('MerchantID', sql.Int, req.params.id)
            .query(`
                UPDATE Merchants SET MerchantStatus = 'Suspended', UpdatedAt = GETDATE()
                OUTPUT INSERTED.*
                WHERE MerchantID = @MerchantID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Merchant does not exist.', traceId });
        }

        await db.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('RecordID', sql.NVarChar, String(req.params.id))
            .query("INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID, NewValue) VALUES (@UserID, 'SUSPEND', 'Merchants', @RecordID, 'Suspended')");

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Suspend merchant error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/merchants/{id}/deactivate:
 *   put:
 *     summary: Deactivate a merchant (Admin only)
 *     tags: [Merchants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Merchant deactivated
 */
app.put('/api/v1/merchants/:id/deactivate', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('MerchantID', sql.Int, req.params.id)
            .query(`
                UPDATE Merchants SET MerchantStatus = 'Deactivated', UpdatedAt = GETDATE()
                OUTPUT INSERTED.*
                WHERE MerchantID = @MerchantID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Merchant does not exist.', traceId });
        }

        await db.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('RecordID', sql.NVarChar, String(req.params.id))
            .query("INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID, NewValue) VALUES (@UserID, 'DEACTIVATE', 'Merchants', @RecordID, 'Deactivated')");

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Deactivate merchant error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/merchants/{id}/transactions:
 *   get:
 *     summary: Get transactions for a merchant
 *     tags: [Merchants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Merchant transaction list
 */
app.get('/api/v1/merchants/:id/transactions', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();

        // ❌ INTENTIONAL DEFECT: No ownership check — any authenticated user can
        //    view any merchant's transactions by changing the :id parameter.
        //    Students should discover this as a "Least Privilege" violation.

        const result = await db.request()
            .input('MerchantID', sql.Int, req.params.id)
            .query(`
                SELECT tl.*
                FROM TransactionLedger tl
                JOIN Wallets w ON tl.WalletID = w.WalletID
                JOIN Merchants m ON w.UserID = m.UserID
                WHERE m.MerchantID = @MerchantID
                ORDER BY tl.CreatedTimestamp DESC
            `);

        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] Merchant transactions error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/merchants/{id}/balance:
 *   get:
 *     summary: Get wallet balance for a merchant
 *     tags: [Merchants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Merchant balance
 *       404:
 *         description: Merchant not found
 */
app.get('/api/v1/merchants/:id/balance', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('MerchantID', sql.Int, req.params.id)
            .query(`
                SELECT w.WalletID, w.Balance, w.CurrencyCode, w.LastUpdated, m.BusinessName
                FROM Wallets w
                JOIN Users u ON w.UserID = u.UserID
                JOIN Merchants m ON u.UserID = m.UserID
                WHERE m.MerchantID = @MerchantID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Merchant not found.', traceId });
        }

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Merchant balance error:`, err.message);
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
        const db = await getPool();
        const result = await db.request()
            .input('ProductID', sql.Int, req.params.id)
            .query(`
                SELECT p.*, sp.ProviderName, sp.Category
                FROM Products p
                JOIN ServiceProviders sp ON p.ProviderID = sp.ProviderID
                WHERE p.ProductID = @ProductID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Product does not exist.', traceId });
        }

        res.json({ data: result.recordset[0], traceId });
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
 *             required: [providerId, sku, description, faceValue]
 *             properties:
 *               providerId:
 *                 type: integer
 *                 example: 1
 *               sku:
 *                 type: string
 *                 example: "MTN-50"
 *               description:
 *                 type: string
 *                 example: "MTN R50 Airtime"
 *               faceValue:
 *                 type: number
 *                 example: 50.00
 *     responses:
 *       201:
 *         description: Product created
 *       403:
 *         description: Admin only
 */
app.post('/api/v1/products', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { providerId, sku, description, faceValue } = req.body;

        if (!providerId || !sku || !description || faceValue == null) {
            return res.status(400).json({ error: 'Bad Request', message: 'providerId, sku, description, and faceValue are required.', traceId });
        }

        const db = await getPool();
        const result = await db.request()
            .input('ProviderID', sql.Int, providerId)
            .input('SKU', sql.NVarChar, sku)
            .input('Description', sql.NVarChar, description)
            .input('FaceValue', sql.Float, faceValue)
            .query(`
                INSERT INTO Products (ProviderID, SKU, Description, FaceValue)
                OUTPUT INSERTED.*
                VALUES (@ProviderID, @SKU, @Description, @FaceValue)
            `);

        await db.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('RecordID', sql.NVarChar, String(result.recordset[0].ProductID))
            .input('NewValue', sql.NVarChar, description)
            .query("INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID, NewValue) VALUES (@UserID, 'CREATE_PRODUCT', 'Products', @RecordID, @NewValue)");

        res.status(201).json({ data: result.recordset[0], traceId });
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
 *               description:
 *                 type: string
 *               faceValue:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Product updated
 */
app.put('/api/v1/products/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { description, faceValue, isActive } = req.body;
        const db = await getPool();

        const request = db.request().input('ProductID', sql.Int, req.params.id);
        const sets = [];

        if (description !== undefined) { sets.push('Description = @Description'); request.input('Description', sql.NVarChar, description); }
        if (faceValue !== undefined)   { sets.push('FaceValue = @FaceValue');     request.input('FaceValue', sql.Float, faceValue); }
        if (isActive !== undefined)    { sets.push('IsActive = @IsActive');       request.input('IsActive', sql.Bit, isActive ? 1 : 0); }

        if (sets.length === 0) {
            return res.status(400).json({ error: 'Bad Request', message: 'Nothing to update.', traceId });
        }

        const result = await request.query(`UPDATE Products SET ${sets.join(', ')} OUTPUT INSERTED.* WHERE ProductID = @ProductID`);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Product does not exist.', traceId });
        }

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Update product error:`, err.message);
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
 *     tags: [Wallets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Wallet record
 *       404:
 *         description: Wallet not found
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

/**
 * @swagger
 * /api/v1/wallets/{id}/topup:
 *   post:
 *     summary: Top up a wallet (Admin only)
 *     tags: [Wallets]
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
 *         description: Wallet topped up
 */
app.post('/api/v1/wallets/:id/topup', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Bad Request', message: 'amount must be a positive number.', traceId });
        }

        const db = await getPool();

        // Get current balance for audit
        const current = await db.request()
            .input('WalletID', sql.Int, req.params.id)
            .query('SELECT Balance FROM Wallets WHERE WalletID = @WalletID');

        if (current.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Wallet does not exist.', traceId });
        }

        const oldBalance = current.recordset[0].Balance;

        const result = await db.request()
            .input('WalletID', sql.Int, req.params.id)
            .input('Amount', sql.Float, amount)
            .query(`
                UPDATE Wallets SET Balance = Balance + @Amount, LastUpdated = GETDATE()
                OUTPUT INSERTED.*
                WHERE WalletID = @WalletID
            `);

        await db.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('RecordID', sql.NVarChar, String(req.params.id))
            .input('OldValue', sql.NVarChar, String(oldBalance))
            .input('NewValue', sql.NVarChar, String(result.recordset[0].Balance))
            .query("INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID, OldValue, NewValue) VALUES (@UserID, 'TOPUP_WALLET', 'Wallets', @RecordID, @OldValue, @NewValue)");

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Wallet topup error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/wallets/{id}/history:
 *   get:
 *     summary: Get transaction history for a wallet
 *     tags: [Wallets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Transaction list for the wallet
 */
app.get('/api/v1/wallets/:id/history', async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('WalletID', sql.Int, req.params.id)
            .query(`
                SELECT tl.*, p.SKU, p.Description AS ProductDescription
                FROM TransactionLedger tl
                JOIN Products p ON tl.ProductID = p.ProductID
                WHERE tl.WalletID = @WalletID
                ORDER BY tl.CreatedTimestamp DESC
            `);

        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] Wallet history error:`, err.message);
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
 *     summary: List transactions (optional walletId filter)
 *     tags: [Transactions]
 *     parameters:
 *       - in: query
 *         name: walletId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Completed, Pending, Failed]
 *     responses:
 *       200:
 *         description: Array of ledger entries
 */
app.get('/api/v1/transactions', async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const request = db.request();
        let query = 'SELECT * FROM TransactionLedger WHERE 1=1';

        if (req.query.walletId) {
            query += ' AND WalletID = @WalletID';
            request.input('WalletID', sql.Int, req.query.walletId);
        }
        if (req.query.status) {
            query += ' AND ProcessingStatus = @Status';
            request.input('Status', sql.NVarChar, req.query.status);
        }

        query += ' ORDER BY CreatedTimestamp DESC';
        const result = await request.query(query);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /transactions error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/transactions/{id}:
 *   get:
 *     summary: Get a single transaction by EntryID
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Transaction record
 *       404:
 *         description: Transaction not found
 */
app.get('/api/v1/transactions/:id', async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('EntryID', sql.UniqueIdentifier, req.params.id)
            .query('SELECT * FROM TransactionLedger WHERE EntryID = @EntryID');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Transaction not found.', traceId });
        }

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /transactions/:id error:`, err.message);
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
 *     summary: List all vouchers (includes expired — intentional defect)
 *     tags: [Vouchers]
 *     responses:
 *       200:
 *         description: Array of voucher records
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

/**
 * @swagger
 * /api/v1/vouchers/{id}:
 *   get:
 *     summary: Get voucher by ID
 *     tags: [Vouchers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Voucher record
 *       404:
 *         description: Voucher not found
 */
app.get('/api/v1/vouchers/:id', async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('VoucherID', sql.Int, req.params.id)
            .query(`
                SELECT v.*, t.WalletID, t.ProductID, t.Amount, t.ExternalReference
                FROM DigitalVouchers v
                JOIN TransactionLedger t ON v.EntryID = t.EntryID
                WHERE v.VoucherID = @VoucherID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Voucher does not exist.', traceId });
        }

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /vouchers/:id error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  COMMISSIONS
// =====================================================================

/**
 * @swagger
 * /api/v1/commissions:
 *   get:
 *     summary: List all commission rules
 *     tags: [Commissions]
 *     responses:
 *       200:
 *         description: Array of commission rules
 */
app.get('/api/v1/commissions', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT c.*, p.SKU, p.Description AS ProductDescription
            FROM Commissions c
            JOIN Products p ON c.ProductID = p.ProductID
            ORDER BY c.ProductID, c.MerchantTier
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /commissions error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/commissions/{id}:
 *   get:
 *     summary: Get commission rule by ID
 *     tags: [Commissions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Commission rule
 *       404:
 *         description: Not found
 */
app.get('/api/v1/commissions/:id', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('CommissionID', sql.Int, req.params.id)
            .query(`
                SELECT c.*, p.SKU, p.Description AS ProductDescription
                FROM Commissions c
                JOIN Products p ON c.ProductID = p.ProductID
                WHERE c.CommissionID = @CommissionID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Commission rule not found.', traceId });
        }

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /commissions/:id error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/commissions:
 *   post:
 *     summary: Create a commission rule (Admin only)
 *     tags: [Commissions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, merchantTier, commissionPercentage]
 *             properties:
 *               productId:
 *                 type: integer
 *                 example: 1
 *               merchantTier:
 *                 type: string
 *                 enum: [Standard, Premium, Enterprise]
 *                 example: "Standard"
 *               commissionPercentage:
 *                 type: number
 *                 example: 7.5
 *     responses:
 *       201:
 *         description: Commission rule created
 */
app.post('/api/v1/commissions', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { productId, merchantTier, commissionPercentage } = req.body;

        if (!productId || !merchantTier || commissionPercentage == null) {
            return res.status(400).json({ error: 'Bad Request', message: 'productId, merchantTier, and commissionPercentage are required.', traceId });
        }

        const db = await getPool();
        const result = await db.request()
            .input('ProductID', sql.Int, productId)
            .input('MerchantTier', sql.NVarChar, merchantTier)
            .input('CommissionPercentage', sql.Float, commissionPercentage)
            .query(`
                INSERT INTO Commissions (ProductID, MerchantTier, CommissionPercentage)
                OUTPUT INSERTED.*
                VALUES (@ProductID, @MerchantTier, @CommissionPercentage)
            `);

        res.status(201).json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Create commission error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/commissions/{id}:
 *   put:
 *     summary: Update a commission rule (Admin only)
 *     tags: [Commissions]
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
 *               commissionPercentage:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Commission rule updated
 */
app.put('/api/v1/commissions/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { commissionPercentage, isActive } = req.body;
        const db = await getPool();

        const request = db.request().input('CommissionID', sql.Int, req.params.id);
        const sets = [];

        if (commissionPercentage !== undefined) { sets.push('CommissionPercentage = @CommPct'); request.input('CommPct', sql.Float, commissionPercentage); }
        if (isActive !== undefined)             { sets.push('IsActive = @IsActive');           request.input('IsActive', sql.Bit, isActive ? 1 : 0); }

        if (sets.length === 0) {
            return res.status(400).json({ error: 'Bad Request', message: 'Nothing to update.', traceId });
        }

        const old = await db.request().input('CID', sql.Int, req.params.id).query('SELECT CommissionPercentage FROM Commissions WHERE CommissionID = @CID');

        const result = await request.query(`UPDATE Commissions SET ${sets.join(', ')} OUTPUT INSERTED.* WHERE CommissionID = @CommissionID`);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Commission rule not found.', traceId });
        }

        // Audit log
        await db.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('RecordID', sql.NVarChar, String(req.params.id))
            .input('OldValue', sql.NVarChar, old.recordset.length > 0 ? String(old.recordset[0].CommissionPercentage) : null)
            .input('NewValue', sql.NVarChar, String(result.recordset[0].CommissionPercentage))
            .query("INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID, OldValue, NewValue) VALUES (@UserID, 'UPDATE_COMMISSION', 'Commissions', @RecordID, @OldValue, @NewValue)");

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Update commission error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/commissions/{id}:
 *   delete:
 *     summary: Delete a commission rule (Admin only)
 *     tags: [Commissions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Commission rule deleted
 */
app.delete('/api/v1/commissions/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('CommissionID', sql.Int, req.params.id)
            .query('DELETE FROM Commissions OUTPUT DELETED.* WHERE CommissionID = @CommissionID');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Commission rule not found.', traceId });
        }

        res.json({ data: result.recordset[0], message: 'Deleted.', traceId });
    } catch (err) {
        console.error(`[${traceId}] Delete commission error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  SETTLEMENTS
// =====================================================================

/**
 * @swagger
 * /api/v1/settlements:
 *   get:
 *     summary: List all settlements
 *     tags: [Settlements]
 *     responses:
 *       200:
 *         description: Array of settlement records
 */
app.get('/api/v1/settlements', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT s.*, m.BusinessName
            FROM Settlements s
            JOIN Merchants m ON s.MerchantID = m.MerchantID
            ORDER BY s.CreatedAt DESC
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /settlements error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/settlements/{id}:
 *   get:
 *     summary: Get settlement by ID
 *     tags: [Settlements]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Settlement record
 *       404:
 *         description: Settlement not found
 */
app.get('/api/v1/settlements/:id', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('SettlementID', sql.Int, req.params.id)
            .query(`
                SELECT s.*, m.BusinessName
                FROM Settlements s
                JOIN Merchants m ON s.MerchantID = m.MerchantID
                WHERE s.SettlementID = @SettlementID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Settlement not found.', traceId });
        }

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /settlements/:id error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/settlements/calculate:
 *   post:
 *     summary: Calculate and create a settlement for a merchant (Admin only)
 *     tags: [Settlements]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [merchantId, periodStart, periodEnd]
 *             properties:
 *               merchantId:
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
 *         description: Settlement calculated
 */
app.post('/api/v1/settlements/calculate', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { merchantId, periodStart, periodEnd } = req.body;

        if (!merchantId || !periodStart || !periodEnd) {
            return res.status(400).json({ error: 'Bad Request', message: 'merchantId, periodStart, and periodEnd are required.', traceId });
        }

        const db = await getPool();
        const result = await db.request()
            .input('MerchantID', sql.Int, merchantId)
            .input('PeriodStart', sql.DateTime, new Date(periodStart))
            .input('PeriodEnd', sql.DateTime, new Date(periodEnd))
            .execute('usp_CalculateSettlement');

        res.status(201).json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Calculate settlement error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  DISTRIBUTION
// =====================================================================

/**
 * @swagger
 * /api/v1/distribution/issue-voucher:
 *   post:
 *     summary: Issue a single digital voucher
 *     tags: [Distribution]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletId, productId, reference]
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
 *         description: Voucher issued
 *       400:
 *         description: Missing fields
 */
app.post('/api/v1/distribution/issue-voucher', async (req, res) => {
    const traceId = uuidv4();
    try {
        const { walletId, productId, reference } = req.body;

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
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/distribution/bulk-issue:
 *   post:
 *     summary: Issue multiple vouchers in a single request
 *     tags: [Distribution]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletId, productId, quantity]
 *             properties:
 *               walletId:
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
 *         description: Bulk vouchers issued
 *       400:
 *         description: Validation error
 */
app.post('/api/v1/distribution/bulk-issue', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const { walletId, productId, quantity } = req.body;

        if (!walletId || !productId || !quantity || quantity < 1 || quantity > 20) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'walletId, productId, and quantity (1-20) are required.',
                traceId
            });
        }

        const db = await getPool();
        const vouchers = [];

        // ❌ INTENTIONAL DEFECT: No total-cost balance check before loop.
        //    Individual stored procedure calls may each succeed even if
        //    the wallet cannot afford all of them.

        for (let i = 0; i < quantity; i++) {
            const ref = `BULK-${traceId.slice(0, 8)}-${i + 1}`;
            const result = await db.request()
                .input('WalletID', sql.Int, walletId)
                .input('ProductID', sql.Int, productId)
                .input('Ref', sql.NVarChar, ref)
                .execute('usp_IssueDigitalVoucher');

            if (result.recordset && result.recordset.length > 0) {
                vouchers.push({ pin: result.recordset[0].PinData, reference: ref });
            }
        }

        res.status(201).json({ status: 'SUCCESS', count: vouchers.length, vouchers, traceId });
    } catch (err) {
        console.error(`[${traceId}] Bulk-issue error:`, err.message);
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
 *     summary: Global transaction ledger (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Full ledger view
 *       401:
 *         description: Token required
 *       403:
 *         description: Admin only
 */
// ❌ INTENTIONAL DEFECT: Missing requireRole('Admin') — only checks
//    that a valid token exists.  A Merchant token will succeed here.
//    Students should discover this privilege-escalation vulnerability.
app.get('/api/v1/admin/ledger', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT tl.*, w.Balance AS WalletBalance, u.FullName, u.Role,
                   p.SKU, p.Description AS ProductDescription
            FROM TransactionLedger tl
            JOIN Wallets w ON tl.WalletID = w.WalletID
            JOIN Users u ON w.UserID = u.UserID
            JOIN Products p ON tl.ProductID = p.ProductID
            ORDER BY tl.CreatedTimestamp DESC
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] Admin ledger error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: All users with sensitive data (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Full user list including roles and balances
 *       403:
 *         description: Admin only
 */
app.get('/api/v1/admin/users', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT u.*, w.WalletID, w.Balance, w.CurrencyCode
            FROM Users u
            LEFT JOIN Wallets w ON u.UserID = w.UserID
            ORDER BY u.UserID
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] Admin users error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/admin/merchants:
 *   get:
 *     summary: All merchants with financials (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Merchant list with financial data
 *       403:
 *         description: Admin only
 */
app.get('/api/v1/admin/merchants', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT m.*, u.FullName, u.Email, u.ServiceStatus,
                   w.Balance, w.CurrencyCode,
                   (SELECT COUNT(*) FROM TransactionLedger tl
                    JOIN Wallets wt ON tl.WalletID = wt.WalletID
                    WHERE wt.UserID = m.UserID) AS TransactionCount,
                   (SELECT ISNULL(SUM(tl.Amount), 0) FROM TransactionLedger tl
                    JOIN Wallets wt ON tl.WalletID = wt.WalletID
                    WHERE wt.UserID = m.UserID AND tl.ProcessingStatus = 'Completed') AS TotalRevenue
            FROM Merchants m
            JOIN Users u ON m.UserID = u.UserID
            LEFT JOIN Wallets w ON u.UserID = w.UserID
            ORDER BY TotalRevenue DESC
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] Admin merchants error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/admin/settlements:
 *   get:
 *     summary: All settlements (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Full settlement list
 *       403:
 *         description: Admin only
 */
app.get('/api/v1/admin/settlements', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT s.*, m.BusinessName, u.FullName
            FROM Settlements s
            JOIN Merchants m ON s.MerchantID = m.MerchantID
            JOIN Users u ON m.UserID = u.UserID
            ORDER BY s.CreatedAt DESC
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] Admin settlements error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/admin/reports/revenue:
 *   get:
 *     summary: Revenue report grouped by provider (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Revenue breakdown
 */
app.get('/api/v1/admin/reports/revenue', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT sp.ProviderName, p.SKU, p.Description,
                   COUNT(*) AS TotalTransactions,
                   SUM(tl.Amount) AS TotalRevenue,
                   SUM(tl.CommissionAmount) AS TotalCommission
            FROM TransactionLedger tl
            JOIN Products p ON tl.ProductID = p.ProductID
            JOIN ServiceProviders sp ON p.ProviderID = sp.ProviderID
            WHERE tl.ProcessingStatus = 'Completed'
            GROUP BY sp.ProviderName, p.SKU, p.Description
            ORDER BY TotalRevenue DESC
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] Revenue report error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/admin/reports/top-merchants:
 *   get:
 *     summary: Top 10 merchants by revenue (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Top merchants
 */
app.get('/api/v1/admin/reports/top-merchants', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT TOP 10
                   m.MerchantID, m.BusinessName, m.MerchantTier,
                   COUNT(*) AS TransactionCount,
                   SUM(tl.Amount) AS TotalRevenue,
                   SUM(tl.CommissionAmount) AS TotalCommission
            FROM Merchants m
            JOIN Users u ON m.UserID = u.UserID
            JOIN Wallets w ON u.UserID = w.UserID
            JOIN TransactionLedger tl ON w.WalletID = tl.WalletID
            WHERE tl.ProcessingStatus = 'Completed'
            GROUP BY m.MerchantID, m.BusinessName, m.MerchantTier
            ORDER BY TotalRevenue DESC
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] Top merchants error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/admin/commission-rates:
 *   put:
 *     summary: Bulk-update commission rates for a tier (Admin only)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [merchantTier, adjustmentPercent]
 *             properties:
 *               merchantTier:
 *                 type: string
 *                 example: "Standard"
 *               adjustmentPercent:
 *                 type: number
 *                 example: 1.5
 *     responses:
 *       200:
 *         description: Commission rates updated
 */
app.put('/api/v1/admin/commission-rates', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { merchantTier, adjustmentPercent } = req.body;

        if (!merchantTier || adjustmentPercent == null) {
            return res.status(400).json({ error: 'Bad Request', message: 'merchantTier and adjustmentPercent are required.', traceId });
        }

        const db = await getPool();
        const result = await db.request()
            .input('MerchantTier', sql.NVarChar, merchantTier)
            .input('Adj', sql.Float, adjustmentPercent)
            .query(`
                UPDATE Commissions
                SET CommissionPercentage = CommissionPercentage + @Adj
                OUTPUT INSERTED.*
                WHERE MerchantTier = @MerchantTier AND IsActive = 1
            `);

        await db.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('NewValue', sql.NVarChar, `Tier ${merchantTier} adjusted by ${adjustmentPercent}%`)
            .query("INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID, NewValue) VALUES (@UserID, 'BULK_RATE_UPDATE', 'Commissions', 'ALL', @NewValue)");

        res.json({ data: result.recordset, updated: result.recordset.length, traceId });
    } catch (err) {
        console.error(`[${traceId}] Bulk commission update error:`, err.message);
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
        const db = await getPool();
        const result = await db.request().query(`
            SELECT al.*, u.FullName AS PerformedBy
            FROM AuditLog al
            LEFT JOIN Users u ON al.UserID = u.UserID
            ORDER BY al.Timestamp DESC
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] Audit log error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// ─── Start Server ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kobo Business Gateway: Port ${PORT} | Docs: http://localhost:${PORT}/api-docs`));