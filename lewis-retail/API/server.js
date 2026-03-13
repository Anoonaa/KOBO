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
const JWT_SECRET = process.env.JWT_SECRET || 'lewis-retail-secret-2024';
const JWT_EXPIRY = '24h';

// ─── Database Connection ─────────────────────────────────────────────
const dbConfig = {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'LewisRetail',
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
            title: 'Lewis Retail Engine — Integration & Revenue Audit Gateway',
            version: '2.0.0',
            description:
                'Retail API for stock management, pricing engine, credit governance, ' +
                'and revenue audit operations.\n\n' +
                '**Default credentials** — any seeded user with password `Password123`.\n' +
                'Admin emails: `kabo@lewisretail.co.za`, `thandi@lewisretail.co.za`, `sipho@lewisretail.co.za`.'
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
 *             required: [employeeNumber, fullName, email, password]
 *             properties:
 *               employeeNumber:
 *                 type: string
 *                 example: "EMP-0100"
 *               fullName:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 example: "john@lewisretail.co.za"
 *               password:
 *                 type: string
 *                 example: "SecurePass1"
 *               role:
 *                 type: string
 *                 enum: [Cashier, StoreManager]
 *                 example: "Cashier"
 *     responses:
 *       201:
 *         description: User registered
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate employee number or email
 */
app.post('/api/v1/auth/register', async (req, res) => {
    const traceId = uuidv4();
    try {
        const { employeeNumber, fullName, email, password, role } = req.body;

        if (!employeeNumber || !fullName || !email || !password) {
            return res.status(400).json({ error: 'Bad Request', message: 'employeeNumber, fullName, email, and password are required.', traceId });
        }

        // Password strength check
        if (password.length < 8) {
            return res.status(400).json({ error: 'Bad Request', message: 'Password must be at least 8 characters.', traceId });
        }

        const allowedRoles = ['Cashier', 'StoreManager'];
        const userRole = allowedRoles.includes(role) ? role : 'Cashier';

        const hashedPassword = await bcrypt.hash(password, 10);

        const db = await getPool();

        // Check duplicate EmployeeNumber
        const dup = await db.request().input('EmployeeNumber', sql.NVarChar, employeeNumber).query('SELECT UserID FROM Users WHERE EmployeeNumber = @EmployeeNumber');
        if (dup.recordset.length > 0) {
            return res.status(409).json({ error: 'Conflict', message: 'Employee number already registered.', traceId });
        }

        const result = await db.request()
            .input('EmployeeNumber', sql.NVarChar, employeeNumber)
            .input('FullName', sql.NVarChar, fullName)
            .input('Email', sql.NVarChar, email)
            .input('PasswordHash', sql.NVarChar, hashedPassword)
            .input('Role', sql.NVarChar, userRole)
            .query(`
                INSERT INTO Users (EmployeeNumber, FullName, Email, PasswordHash, Role)
                OUTPUT INSERTED.UserID, INSERTED.EmployeeNumber, INSERTED.FullName, INSERTED.Email, INSERTED.Role
                VALUES (@EmployeeNumber, @FullName, @Email, @PasswordHash, @Role)
            `);

        res.status(201).json({ data: result.recordset[0], traceId });
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
 *                 example: "kabo@lewisretail.co.za"
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
            { userId: user.UserID, email: user.Email, role: user.Role, employeeNumber: user.EmployeeNumber },
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
                SELECT u.UserID, u.EmployeeNumber, u.FullName, u.Email, u.Role, u.AccountTier,
                       u.ServiceStatus, u.CreatedAt
                FROM Users u
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
 *     security: []
 *     responses:
 *       200:
 *         description: Array of user records
 */
app.get('/api/v1/users', async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(
            'SELECT UserID, EmployeeNumber, FullName, Email, Role, AccountTier, ServiceStatus, CreatedAt FROM Users'
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
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User record
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
                SELECT u.UserID, u.EmployeeNumber, u.FullName, u.Email, u.Role, u.AccountTier,
                       u.ServiceStatus, u.CreatedAt
                FROM Users u
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
//  CUSTOMERS
// =====================================================================

/**
 * @swagger
 * /api/v1/customers/register:
 *   post:
 *     summary: Register a new customer
 *     tags: [Customers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, phone]
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "Lerato Molefe"
 *               email:
 *                 type: string
 *                 example: "lerato@example.co.za"
 *               phone:
 *                 type: string
 *                 example: "0821234567"
 *               customerTier:
 *                 type: string
 *                 enum: [Standard, Premium, VIP]
 *                 example: "Standard"
 *     responses:
 *       201:
 *         description: Customer registered
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate email
 */
app.post('/api/v1/customers/register', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const { fullName, email, phone, customerTier } = req.body;

        if (!fullName || !email || !phone) {
            return res.status(400).json({ error: 'Bad Request', message: 'fullName, email, and phone are required.', traceId });
        }

        const allowedTiers = ['Standard', 'Premium', 'VIP'];
        const tier = allowedTiers.includes(customerTier) ? customerTier : 'Standard';

        const db = await getPool();

        // Check duplicate email
        const dup = await db.request().input('Email', sql.NVarChar, email).query('SELECT CustomerID FROM Customers WHERE Email = @Email');
        if (dup.recordset.length > 0) {
            return res.status(409).json({ error: 'Conflict', message: 'Email already registered.', traceId });
        }

        const result = await db.request()
            .input('FullName', sql.NVarChar, fullName)
            .input('Email', sql.NVarChar, email)
            .input('Phone', sql.NVarChar, phone)
            .input('CustomerTier', sql.NVarChar, tier)
            .query(`
                INSERT INTO Customers (FullName, Email, Phone, CustomerTier)
                OUTPUT INSERTED.*
                VALUES (@FullName, @Email, @Phone, @CustomerTier)
            `);

        res.status(201).json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Customer register error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

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
app.get('/api/v1/customers', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT c.*
            FROM Customers c
            ORDER BY c.CustomerID
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /customers error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/customers/{id}:
 *   get:
 *     summary: Get customer by ID with credit info
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Customer record with credit account info
 *       404:
 *         description: Customer not found
 */
app.get('/api/v1/customers/:id', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('CustomerID', sql.Int, req.params.id)
            .query(`
                SELECT c.*, ca.CreditAccountID, ca.CreditLimit, ca.CurrentBalance,
                       ca.CreditStatus, ca.ExpiryDate, ca.LastPaymentDate
                FROM Customers c
                LEFT JOIN CreditAccounts ca ON c.CustomerID = ca.CustomerID
                WHERE c.CustomerID = @CustomerID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Customer does not exist.', traceId });
        }

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /customers/:id error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/customers/{id}/activate:
 *   put:
 *     summary: Activate a customer (Admin only)
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Customer activated
 *       403:
 *         description: Admin only
 *       404:
 *         description: Customer not found
 */
app.put('/api/v1/customers/:id/activate', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('CustomerID', sql.Int, req.params.id)
            .query(`
                UPDATE Customers SET AccountStatus = 'Active'
                OUTPUT INSERTED.*
                WHERE CustomerID = @CustomerID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Customer does not exist.', traceId });
        }

        // Audit log
        await db.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('RecordID', sql.NVarChar, String(req.params.id))
            .query("INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID, NewValue) VALUES (@UserID, 'ACTIVATE', 'Customers', @RecordID, 'Active')");

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Activate customer error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/customers/{id}/suspend:
 *   put:
 *     summary: Suspend a customer (Admin only)
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Customer suspended
 */
app.put('/api/v1/customers/:id/suspend', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('CustomerID', sql.Int, req.params.id)
            .query(`
                UPDATE Customers SET AccountStatus = 'Suspended'
                OUTPUT INSERTED.*
                WHERE CustomerID = @CustomerID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Customer does not exist.', traceId });
        }

        await db.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('RecordID', sql.NVarChar, String(req.params.id))
            .query("INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID, NewValue) VALUES (@UserID, 'SUSPEND', 'Customers', @RecordID, 'Suspended')");

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Suspend customer error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/customers/{id}/disable:
 *   put:
 *     summary: Disable a customer (Admin only)
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Customer disabled
 */
app.put('/api/v1/customers/:id/disable', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('CustomerID', sql.Int, req.params.id)
            .query(`
                UPDATE Customers SET AccountStatus = 'Disabled'
                OUTPUT INSERTED.*
                WHERE CustomerID = @CustomerID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Customer does not exist.', traceId });
        }

        await db.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('RecordID', sql.NVarChar, String(req.params.id))
            .query("INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID, NewValue) VALUES (@UserID, 'DISABLE', 'Customers', @RecordID, 'Disabled')");

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Disable customer error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/customers/{id}/orders:
 *   get:
 *     summary: Get orders for a customer
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Customer order list
 */
app.get('/api/v1/customers/:id/orders', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();

        // ❌ INTENTIONAL DEFECT: No ownership check — any authenticated user can
        //    view any customer's orders by changing the :id parameter.
        //    Students should discover this as a "Least Privilege" violation.

        const result = await db.request()
            .input('CustomerID', sql.Int, req.params.id)
            .query(`
                SELECT o.*
                FROM Orders o
                WHERE o.CustomerID = @CustomerID
                ORDER BY o.CreatedTimestamp DESC
            `);

        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] Customer orders error:`, err.message);
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
 *     summary: List all products with department info
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
            SELECT p.*, d.DepartmentName, d.Category
            FROM Products p
            JOIN Departments d ON p.DepartmentID = d.DepartmentID
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
                SELECT p.*, d.DepartmentName, d.Category
                FROM Products p
                JOIN Departments d ON p.DepartmentID = d.DepartmentID
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
 *             required: [departmentId, sku, description, unitPrice, costPrice]
 *             properties:
 *               departmentId:
 *                 type: integer
 *                 example: 1
 *               sku:
 *                 type: string
 *                 example: "FURN-SOFA-001"
 *               description:
 *                 type: string
 *                 example: "3-Seater Leather Sofa"
 *               unitPrice:
 *                 type: number
 *                 example: 12999.99
 *               costPrice:
 *                 type: number
 *                 example: 8500.00
 *     responses:
 *       201:
 *         description: Product created
 *       403:
 *         description: Admin only
 */
app.post('/api/v1/products', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { departmentId, sku, description, unitPrice, costPrice } = req.body;

        if (!departmentId || !sku || !description || unitPrice == null || costPrice == null) {
            return res.status(400).json({ error: 'Bad Request', message: 'departmentId, sku, description, unitPrice, and costPrice are required.', traceId });
        }

        const db = await getPool();
        const result = await db.request()
            .input('DepartmentID', sql.Int, departmentId)
            .input('SKU', sql.NVarChar, sku)
            .input('Description', sql.NVarChar, description)
            .input('UnitPrice', sql.Float, unitPrice)
            .input('CostPrice', sql.Float, costPrice)
            .query(`
                INSERT INTO Products (DepartmentID, SKU, Description, UnitPrice, CostPrice)
                OUTPUT INSERTED.*
                VALUES (@DepartmentID, @SKU, @Description, @UnitPrice, @CostPrice)
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
 *               unitPrice:
 *                 type: number
 *               costPrice:
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
        const { description, unitPrice, costPrice, isActive } = req.body;
        const db = await getPool();

        const request = db.request().input('ProductID', sql.Int, req.params.id);
        const sets = [];

        if (description !== undefined) { sets.push('Description = @Description'); request.input('Description', sql.NVarChar, description); }
        if (unitPrice !== undefined)   { sets.push('UnitPrice = @UnitPrice');     request.input('UnitPrice', sql.Float, unitPrice); }
        if (costPrice !== undefined)   { sets.push('CostPrice = @CostPrice');     request.input('CostPrice', sql.Float, costPrice); }
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
//  INVENTORY / STOCK
// =====================================================================

/**
 * @swagger
 * /api/v1/inventory:
 *   get:
 *     summary: List all inventory with product details
 *     tags: [Inventory]
 *     security: []
 *     responses:
 *       200:
 *         description: Array of inventory records
 */
app.get('/api/v1/inventory', async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT i.*, p.SKU, p.Description AS ProductDescription, p.UnitPrice,
                   s.StoreName, s.StoreCode
            FROM Inventory i
            JOIN Products p ON i.ProductID = p.ProductID
            JOIN Stores s ON i.StoreID = s.StoreID
            ORDER BY i.InventoryID
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /inventory error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/inventory/{id}:
 *   get:
 *     summary: Get inventory record by ID
 *     tags: [Inventory]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Inventory record
 *       404:
 *         description: Inventory record not found
 */
app.get('/api/v1/inventory/:id', async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('InventoryID', sql.Int, req.params.id)
            .query(`
                SELECT i.*, p.SKU, p.Description AS ProductDescription, p.UnitPrice,
                       s.StoreName, s.StoreCode
                FROM Inventory i
                JOIN Products p ON i.ProductID = p.ProductID
                JOIN Stores s ON i.StoreID = s.StoreID
                WHERE i.InventoryID = @InventoryID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Inventory record does not exist.', traceId });
        }

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /inventory/:id error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/stock/update:
 *   post:
 *     summary: Update stock quantity for a product at a store (Admin only)
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, storeId, quantityChange, reason]
 *             properties:
 *               productId:
 *                 type: integer
 *                 example: 1
 *               storeId:
 *                 type: integer
 *                 example: 1
 *               quantityChange:
 *                 type: integer
 *                 example: 50
 *               reason:
 *                 type: string
 *                 example: "Restock from warehouse"
 *     responses:
 *       200:
 *         description: Stock updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Inventory record not found
 */
app.post('/api/v1/stock/update', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { productId, storeId, quantityChange, reason } = req.body;

        if (!productId || !storeId || quantityChange == null || !reason) {
            return res.status(400).json({ error: 'Bad Request', message: 'productId, storeId, quantityChange, and reason are required.', traceId });
        }

        const db = await getPool();

        // Get current quantity for audit
        const current = await db.request()
            .input('ProductID', sql.Int, productId)
            .input('StoreID', sql.Int, storeId)
            .query('SELECT InventoryID, QuantityOnHand FROM Inventory WHERE ProductID = @ProductID AND StoreID = @StoreID');

        if (current.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Inventory record does not exist for this product/store combination.', traceId });
        }

        const oldQty = current.recordset[0].QuantityOnHand;

        const result = await db.request()
            .input('ProductID', sql.Int, productId)
            .input('StoreID', sql.Int, storeId)
            .input('QtyChange', sql.Int, quantityChange)
            .query(`
                UPDATE Inventory SET QuantityOnHand = QuantityOnHand + @QtyChange, LastStockUpdate = GETDATE()
                OUTPUT INSERTED.*
                WHERE ProductID = @ProductID AND StoreID = @StoreID
            `);

        await db.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('RecordID', sql.NVarChar, String(current.recordset[0].InventoryID))
            .input('OldValue', sql.NVarChar, String(oldQty))
            .input('NewValue', sql.NVarChar, String(result.recordset[0].QuantityOnHand))
            .query("INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID, OldValue, NewValue) VALUES (@UserID, 'STOCK_UPDATE', 'Inventory', @RecordID, @OldValue, @NewValue)");

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Stock update error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/inventory/low-stock:
 *   get:
 *     summary: Get items below reorder level
 *     tags: [Inventory]
 *     responses:
 *       200:
 *         description: Array of low-stock inventory records
 */
app.get('/api/v1/inventory/low-stock', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT i.*, p.SKU, p.Description AS ProductDescription,
                   s.StoreName, s.StoreCode
            FROM Inventory i
            JOIN Products p ON i.ProductID = p.ProductID
            JOIN Stores s ON i.StoreID = s.StoreID
            WHERE i.QuantityOnHand < i.ReorderLevel
            ORDER BY (i.QuantityOnHand - i.ReorderLevel) ASC
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] Low-stock error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  PRICING
// =====================================================================

/**
 * @swagger
 * /api/v1/pricing/calculate:
 *   get:
 *     summary: Calculate price for product + customer + quantity
 *     tags: [Pricing]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: customerId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: quantity
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Calculated price breakdown (unitPrice, discount, vat, total)
 *       400:
 *         description: Missing parameters
 *       404:
 *         description: Product or customer not found
 */
app.get('/api/v1/pricing/calculate', async (req, res) => {
    const traceId = uuidv4();
    try {
        const { productId, customerId, quantity } = req.query;

        if (!productId || !customerId || !quantity) {
            return res.status(400).json({ error: 'Bad Request', message: 'productId, customerId, and quantity are required.', traceId });
        }

        const db = await getPool();

        // Get product
        const prodResult = await db.request()
            .input('ProductID', sql.Int, productId)
            .query('SELECT ProductID, UnitPrice, DepartmentID FROM Products WHERE ProductID = @ProductID AND IsActive = 1');

        if (prodResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Product not found or inactive.', traceId });
        }

        const product = prodResult.recordset[0];

        // Get customer tier
        const custResult = await db.request()
            .input('CustomerID', sql.Int, customerId)
            .query('SELECT CustomerID, CustomerTier FROM Customers WHERE CustomerID = @CustomerID');

        if (custResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Customer not found.', traceId });
        }

        const customer = custResult.recordset[0];
        const qty = parseInt(quantity);

        // Get pricing rule for this product + customer tier
        const ruleResult = await db.request()
            .input('ProductID', sql.Int, productId)
            .input('CustomerTier', sql.NVarChar, customer.CustomerTier)
            .query(`
                SELECT DiscountPercentage, BulkQuantityThreshold, BulkDiscountPercentage
                FROM PricingRules
                WHERE ProductID = @ProductID AND CustomerTier = @CustomerTier AND IsActive = 1
            `);

        // Get VAT rate for the product's department category
        const deptResult = await db.request()
            .input('DepartmentID', sql.Int, product.DepartmentID)
            .query('SELECT Category FROM Departments WHERE DepartmentID = @DepartmentID');

        let vatPercentage = 15.0; // default VAT
        if (deptResult.recordset.length > 0) {
            const vatResult = await db.request()
                .input('Category', sql.NVarChar, deptResult.recordset[0].Category)
                .query('SELECT Percentage FROM VAT_Rates WHERE Category = @Category AND IsActive = 1');
            if (vatResult.recordset.length > 0) {
                vatPercentage = vatResult.recordset[0].Percentage;
            }
        }

        // ❌ INTENTIONAL DEFECT: Uses FLOAT arithmetic instead of DECIMAL.
        //    This can produce rounding errors and allows R0.00 total through
        //    for certain edge cases (e.g. 100% discount + 0% VAT).
        let unitPrice = product.UnitPrice;
        let discountPct = 0.0;

        if (ruleResult.recordset.length > 0) {
            const rule = ruleResult.recordset[0];
            discountPct = rule.DiscountPercentage;

            // Apply bulk discount if quantity meets threshold
            if (rule.BulkQuantityThreshold && qty >= rule.BulkQuantityThreshold) {
                discountPct = discountPct + rule.BulkDiscountPercentage;
            }
        }

        const lineTotal = unitPrice * qty;
        const discountAmount = lineTotal * (discountPct / 100.0);
        const afterDiscount = lineTotal - discountAmount;
        const vatAmount = afterDiscount * (vatPercentage / 100.0);
        const total = afterDiscount + vatAmount;

        res.json({
            data: {
                productId: product.ProductID,
                customerId: customer.CustomerID,
                customerTier: customer.CustomerTier,
                quantity: qty,
                unitPrice,
                lineTotal,
                discountPercentage: discountPct,
                discountAmount,
                vatPercentage,
                vatAmount,
                total
            },
            traceId
        });
    } catch (err) {
        console.error(`[${traceId}] Pricing calculate error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/pricing/vat-rates:
 *   get:
 *     summary: List all VAT rates
 *     tags: [Pricing]
 *     security: []
 *     responses:
 *       200:
 *         description: Array of VAT rate records
 */
app.get('/api/v1/pricing/vat-rates', async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query('SELECT * FROM VAT_Rates ORDER BY Category');
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /pricing/vat-rates error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/pricing/discounts:
 *   get:
 *     summary: List all pricing/discount rules
 *     tags: [Pricing]
 *     responses:
 *       200:
 *         description: Array of pricing rule records
 */
app.get('/api/v1/pricing/discounts', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT pr.*, p.SKU, p.Description AS ProductDescription
            FROM PricingRules pr
            JOIN Products p ON pr.ProductID = p.ProductID
            ORDER BY pr.ProductID, pr.CustomerTier
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /pricing/discounts error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/pricing/discounts:
 *   post:
 *     summary: Create a pricing rule (Admin only)
 *     tags: [Pricing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, customerTier, discountPercentage]
 *             properties:
 *               productId:
 *                 type: integer
 *                 example: 1
 *               customerTier:
 *                 type: string
 *                 enum: [Standard, Premium, VIP]
 *                 example: "Premium"
 *               discountPercentage:
 *                 type: number
 *                 example: 5.0
 *               bulkQuantityThreshold:
 *                 type: integer
 *                 example: 10
 *               bulkDiscountPercentage:
 *                 type: number
 *                 example: 2.5
 *     responses:
 *       201:
 *         description: Pricing rule created
 */
app.post('/api/v1/pricing/discounts', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { productId, customerTier, discountPercentage, bulkQuantityThreshold, bulkDiscountPercentage } = req.body;

        if (!productId || !customerTier || discountPercentage == null) {
            return res.status(400).json({ error: 'Bad Request', message: 'productId, customerTier, and discountPercentage are required.', traceId });
        }

        const db = await getPool();
        const result = await db.request()
            .input('ProductID', sql.Int, productId)
            .input('CustomerTier', sql.NVarChar, customerTier)
            .input('DiscountPercentage', sql.Float, discountPercentage)
            .input('BulkQuantityThreshold', sql.Int, bulkQuantityThreshold || null)
            .input('BulkDiscountPercentage', sql.Float, bulkDiscountPercentage || null)
            .query(`
                INSERT INTO PricingRules (ProductID, CustomerTier, DiscountPercentage, BulkQuantityThreshold, BulkDiscountPercentage)
                OUTPUT INSERTED.*
                VALUES (@ProductID, @CustomerTier, @DiscountPercentage, @BulkQuantityThreshold, @BulkDiscountPercentage)
            `);

        res.status(201).json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Create pricing rule error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/pricing/discounts/{id}:
 *   put:
 *     summary: Update a pricing rule (Admin only)
 *     tags: [Pricing]
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
 *               bulkQuantityThreshold:
 *                 type: integer
 *               bulkDiscountPercentage:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Pricing rule updated
 */
app.put('/api/v1/pricing/discounts/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { discountPercentage, bulkQuantityThreshold, bulkDiscountPercentage, isActive } = req.body;
        const db = await getPool();

        const request = db.request().input('PricingRuleID', sql.Int, req.params.id);
        const sets = [];

        if (discountPercentage !== undefined)     { sets.push('DiscountPercentage = @DiscPct');       request.input('DiscPct', sql.Float, discountPercentage); }
        if (bulkQuantityThreshold !== undefined)   { sets.push('BulkQuantityThreshold = @BulkQty');   request.input('BulkQty', sql.Int, bulkQuantityThreshold); }
        if (bulkDiscountPercentage !== undefined)  { sets.push('BulkDiscountPercentage = @BulkPct');  request.input('BulkPct', sql.Float, bulkDiscountPercentage); }
        if (isActive !== undefined)                { sets.push('IsActive = @IsActive');               request.input('IsActive', sql.Bit, isActive ? 1 : 0); }

        if (sets.length === 0) {
            return res.status(400).json({ error: 'Bad Request', message: 'Nothing to update.', traceId });
        }

        const old = await db.request().input('PID', sql.Int, req.params.id).query('SELECT DiscountPercentage FROM PricingRules WHERE PricingRuleID = @PID');

        const result = await request.query(`UPDATE PricingRules SET ${sets.join(', ')} OUTPUT INSERTED.* WHERE PricingRuleID = @PricingRuleID`);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Pricing rule not found.', traceId });
        }

        // Audit log
        await db.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('RecordID', sql.NVarChar, String(req.params.id))
            .input('OldValue', sql.NVarChar, old.recordset.length > 0 ? String(old.recordset[0].DiscountPercentage) : null)
            .input('NewValue', sql.NVarChar, String(result.recordset[0].DiscountPercentage))
            .query("INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID, OldValue, NewValue) VALUES (@UserID, 'UPDATE_PRICING_RULE', 'PricingRules', @RecordID, @OldValue, @NewValue)");

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Update pricing rule error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/pricing/discounts/{id}:
 *   delete:
 *     summary: Delete a pricing rule (Admin only)
 *     tags: [Pricing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Pricing rule deleted
 */
app.delete('/api/v1/pricing/discounts/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('PricingRuleID', sql.Int, req.params.id)
            .query('DELETE FROM PricingRules OUTPUT DELETED.* WHERE PricingRuleID = @PricingRuleID');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Pricing rule not found.', traceId });
        }

        res.json({ data: result.recordset[0], message: 'Deleted.', traceId });
    } catch (err) {
        console.error(`[${traceId}] Delete pricing rule error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  CREDIT
// =====================================================================

/**
 * @swagger
 * /api/v1/credit:
 *   get:
 *     summary: List all credit accounts
 *     tags: [Credit]
 *     responses:
 *       200:
 *         description: Array of credit account records
 */
app.get('/api/v1/credit', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT ca.*, c.FullName, c.Email, c.CustomerTier
            FROM CreditAccounts ca
            JOIN Customers c ON ca.CustomerID = c.CustomerID
            ORDER BY ca.CreditAccountID
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /credit error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/credit/{id}:
 *   get:
 *     summary: Get credit account by ID
 *     tags: [Credit]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Credit account record
 *       404:
 *         description: Credit account not found
 */
app.get('/api/v1/credit/:id', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('CreditAccountID', sql.Int, req.params.id)
            .query(`
                SELECT ca.*, c.FullName, c.Email, c.CustomerTier
                FROM CreditAccounts ca
                JOIN Customers c ON ca.CustomerID = c.CustomerID
                WHERE ca.CreditAccountID = @CreditAccountID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Credit account does not exist.', traceId });
        }

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /credit/:id error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/credit/apply:
 *   post:
 *     summary: Apply for a credit account
 *     tags: [Credit]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerId, requestedLimit]
 *             properties:
 *               customerId:
 *                 type: integer
 *                 example: 1
 *               requestedLimit:
 *                 type: number
 *                 example: 50000.00
 *     responses:
 *       201:
 *         description: Credit application submitted
 *       400:
 *         description: Validation error
 *       409:
 *         description: Customer already has a credit account
 */
app.post('/api/v1/credit/apply', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const { customerId, requestedLimit } = req.body;

        if (!customerId || !requestedLimit || requestedLimit <= 0) {
            return res.status(400).json({ error: 'Bad Request', message: 'customerId and a positive requestedLimit are required.', traceId });
        }

        const db = await getPool();

        // Check existing credit account
        const existing = await db.request()
            .input('CustomerID', sql.Int, customerId)
            .query('SELECT CreditAccountID FROM CreditAccounts WHERE CustomerID = @CustomerID');
        if (existing.recordset.length > 0) {
            return res.status(409).json({ error: 'Conflict', message: 'Customer already has a credit account.', traceId });
        }

        const result = await db.request()
            .input('CustomerID', sql.Int, customerId)
            .input('CreditLimit', sql.Float, requestedLimit)
            .query(`
                INSERT INTO CreditAccounts (CustomerID, CreditLimit, CurrentBalance, CreditStatus)
                OUTPUT INSERTED.*
                VALUES (@CustomerID, @CreditLimit, 0, 'Pending')
            `);

        res.status(201).json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Credit apply error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/credit/{id}/status:
 *   put:
 *     summary: Update credit account status (Admin only)
 *     tags: [Credit]
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Active, Suspended, Closed, Pending]
 *                 example: "Active"
 *     responses:
 *       200:
 *         description: Credit status updated
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Credit account not found
 */
app.put('/api/v1/credit/:id/status', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { status } = req.body;

        const allowedStatuses = ['Active', 'Suspended', 'Closed', 'Pending'];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({ error: 'Bad Request', message: `status must be one of: ${allowedStatuses.join(', ')}.`, traceId });
        }

        const db = await getPool();

        const old = await db.request().input('CAID', sql.Int, req.params.id).query('SELECT CreditStatus FROM CreditAccounts WHERE CreditAccountID = @CAID');

        const result = await db.request()
            .input('CreditAccountID', sql.Int, req.params.id)
            .input('CreditStatus', sql.NVarChar, status)
            .query(`
                UPDATE CreditAccounts SET CreditStatus = @CreditStatus
                OUTPUT INSERTED.*
                WHERE CreditAccountID = @CreditAccountID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Credit account does not exist.', traceId });
        }

        await db.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('RecordID', sql.NVarChar, String(req.params.id))
            .input('OldValue', sql.NVarChar, old.recordset.length > 0 ? old.recordset[0].CreditStatus : null)
            .input('NewValue', sql.NVarChar, status)
            .query("INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID, OldValue, NewValue) VALUES (@UserID, 'UPDATE_CREDIT_STATUS', 'CreditAccounts', @RecordID, @OldValue, @NewValue)");

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] Update credit status error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  ORDERS / SALES
// =====================================================================

/**
 * @swagger
 * /api/v1/orders:
 *   get:
 *     summary: List orders (optional customerId, status, storeId filters)
 *     tags: [Orders]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Completed, Pending, Failed, Cancelled]
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Array of order records
 */
app.get('/api/v1/orders', async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const request = db.request();
        let query = 'SELECT * FROM Orders WHERE 1=1';

        if (req.query.customerId) {
            query += ' AND CustomerID = @CustomerID';
            request.input('CustomerID', sql.Int, req.query.customerId);
        }
        if (req.query.status) {
            query += ' AND OrderStatus = @Status';
            request.input('Status', sql.NVarChar, req.query.status);
        }
        if (req.query.storeId) {
            query += ' AND StoreID = @StoreID';
            request.input('StoreID', sql.Int, req.query.storeId);
        }

        query += ' ORDER BY CreatedTimestamp DESC';
        const result = await request.query(query);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /orders error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/orders/{id}:
 *   get:
 *     summary: Get order by OrderID (UUID)
 *     tags: [Orders]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Order record
 *       404:
 *         description: Order not found
 */
app.get('/api/v1/orders/:id', async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('OrderID', sql.UniqueIdentifier, req.params.id)
            .query('SELECT * FROM Orders WHERE OrderID = @OrderID');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Order not found.', traceId });
        }

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /orders/:id error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/orders:
 *   post:
 *     summary: Create a new sale/order (calls usp_ProcessSale)
 *     tags: [Orders]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerId, productId, storeId, quantity, reference]
 *             properties:
 *               customerId:
 *                 type: integer
 *                 example: 1
 *               productId:
 *                 type: integer
 *                 example: 1
 *               storeId:
 *                 type: integer
 *                 example: 1
 *               quantity:
 *                 type: integer
 *                 example: 2
 *               reference:
 *                 type: string
 *                 example: "ORD-001"
 *     responses:
 *       201:
 *         description: Order created
 *       400:
 *         description: Missing fields
 */
app.post('/api/v1/orders', async (req, res) => {
    const traceId = uuidv4();
    try {
        const { customerId, productId, storeId, quantity, reference } = req.body;

        if (!customerId || !productId || !storeId || !quantity || !reference) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'customerId, productId, storeId, quantity, and reference are required.',
                traceId
            });
        }

        const db = await getPool();
        const result = await db.request()
            .input('CustomerID', sql.Int, customerId)
            .input('ProductID', sql.Int, productId)
            .input('StoreID', sql.Int, storeId)
            .input('Quantity', sql.Int, quantity)
            .input('Reference', sql.NVarChar, reference)
            .execute('usp_ProcessSale');

        if (!result.recordset || result.recordset.length === 0) {
            return res.status(500).json({
                error: 'Processing Error',
                message: 'Order processing returned no data.',
                traceId
            });
        }

        res.status(201).json({
            status: 'SUCCESS',
            data: result.recordset[0],
            traceId
        });
    } catch (err) {
        console.error(`[${traceId}] Create order error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/orders/bulk:
 *   post:
 *     summary: Bulk create orders
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerId, productId, storeId, quantity]
 *             properties:
 *               customerId:
 *                 type: integer
 *                 example: 1
 *               productId:
 *                 type: integer
 *                 example: 1
 *               storeId:
 *                 type: integer
 *                 example: 1
 *               quantity:
 *                 type: integer
 *                 example: 5
 *     responses:
 *       201:
 *         description: Bulk orders created
 *       400:
 *         description: Validation error
 */
app.post('/api/v1/orders/bulk', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const { customerId, productId, storeId, quantity } = req.body;

        if (!customerId || !productId || !storeId || !quantity || quantity < 1 || quantity > 20) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'customerId, productId, storeId, and quantity (1-20) are required.',
                traceId
            });
        }

        const db = await getPool();
        const orders = [];

        // ❌ INTENTIONAL DEFECT: No total stock check before loop.
        //    Individual stored procedure calls may each succeed even if
        //    the store does not have enough stock for all of them.

        for (let i = 0; i < quantity; i++) {
            const ref = `BULK-${traceId.slice(0, 8)}-${i + 1}`;
            const result = await db.request()
                .input('CustomerID', sql.Int, customerId)
                .input('ProductID', sql.Int, productId)
                .input('StoreID', sql.Int, storeId)
                .input('Quantity', sql.Int, 1)
                .input('Reference', sql.NVarChar, ref)
                .execute('usp_ProcessSale');

            if (result.recordset && result.recordset.length > 0) {
                orders.push({ data: result.recordset[0], reference: ref });
            }
        }

        res.status(201).json({ status: 'SUCCESS', count: orders.length, orders, traceId });
    } catch (err) {
        console.error(`[${traceId}] Bulk order error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// =====================================================================
//  ADMIN — Sensitive endpoints for RBAC testing
// =====================================================================

/**
 * @swagger
 * /api/v1/admin/sales-ledger:
 *   get:
 *     summary: Full sales ledger (Admin only)
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
//    that a valid token exists.  A Cashier token will succeed here.
//    Students should discover this privilege-escalation vulnerability.
app.get('/api/v1/admin/sales-ledger', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT o.*, c.FullName AS CustomerName, c.CustomerTier,
                   p.SKU, p.Description AS ProductDescription,
                   s.StoreName, s.StoreCode
            FROM Orders o
            JOIN Customers c ON o.CustomerID = c.CustomerID
            JOIN Products p ON o.ProductID = p.ProductID
            JOIN Stores s ON o.StoreID = s.StoreID
            ORDER BY o.CreatedTimestamp DESC
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] Admin sales-ledger error:`, err.message);
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
 *         description: Full user list including roles and account tiers
 *       403:
 *         description: Admin only
 */
app.get('/api/v1/admin/users', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT u.*
            FROM Users u
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
        const db = await getPool();
        const result = await db.request().query(`
            SELECT s.*, u.FullName AS ManagerName, u.Email AS ManagerEmail,
                   (SELECT COUNT(*) FROM Orders o WHERE o.StoreID = s.StoreID) AS OrderCount,
                   (SELECT ISNULL(SUM(o.TotalAmount), 0) FROM Orders o
                    WHERE o.StoreID = s.StoreID AND o.OrderStatus = 'Completed') AS TotalRevenue
            FROM Stores s
            JOIN Users u ON s.UserID = u.UserID
            ORDER BY TotalRevenue DESC
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] Admin stores error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/admin/reports/revenue:
 *   get:
 *     summary: Revenue report grouped by department (Admin only)
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
            SELECT d.DepartmentName, p.SKU, p.Description,
                   COUNT(*) AS TotalOrders,
                   SUM(o.TotalAmount) AS TotalRevenue,
                   SUM(o.DiscountAmount) AS TotalDiscount,
                   SUM(o.VATAmount) AS TotalVAT
            FROM Orders o
            JOIN Products p ON o.ProductID = p.ProductID
            JOIN Departments d ON p.DepartmentID = d.DepartmentID
            WHERE o.OrderStatus = 'Completed'
            GROUP BY d.DepartmentName, p.SKU, p.Description
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
 * /api/v1/admin/reports/top-stores:
 *   get:
 *     summary: Top 10 stores by revenue (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Top stores
 */
app.get('/api/v1/admin/reports/top-stores', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT TOP 10
                   s.StoreID, s.StoreName, s.StoreCode, s.Region,
                   COUNT(*) AS OrderCount,
                   SUM(o.TotalAmount) AS TotalRevenue,
                   SUM(o.DiscountAmount) AS TotalDiscount
            FROM Stores s
            JOIN Orders o ON s.StoreID = o.StoreID
            WHERE o.OrderStatus = 'Completed'
            GROUP BY s.StoreID, s.StoreName, s.StoreCode, s.Region
            ORDER BY TotalRevenue DESC
        `);
        res.json({ data: result.recordset, traceId });
    } catch (err) {
        console.error(`[${traceId}] Top stores error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

/**
 * @swagger
 * /api/v1/admin/pricing/bulk-update:
 *   put:
 *     summary: Bulk-update discount rates for a customer tier (Admin only)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerTier, adjustmentPercent]
 *             properties:
 *               customerTier:
 *                 type: string
 *                 example: "Premium"
 *               adjustmentPercent:
 *                 type: number
 *                 example: 1.5
 *     responses:
 *       200:
 *         description: Discount rates updated
 */
app.put('/api/v1/admin/pricing/bulk-update', authenticateToken, requireRole('Admin'), async (req, res) => {
    const traceId = uuidv4();
    try {
        const { customerTier, adjustmentPercent } = req.body;

        if (!customerTier || adjustmentPercent == null) {
            return res.status(400).json({ error: 'Bad Request', message: 'customerTier and adjustmentPercent are required.', traceId });
        }

        const db = await getPool();
        const result = await db.request()
            .input('CustomerTier', sql.NVarChar, customerTier)
            .input('Adj', sql.Float, adjustmentPercent)
            .query(`
                UPDATE PricingRules
                SET DiscountPercentage = DiscountPercentage + @Adj
                OUTPUT INSERTED.*
                WHERE CustomerTier = @CustomerTier AND IsActive = 1
            `);

        await db.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('NewValue', sql.NVarChar, `Tier ${customerTier} adjusted by ${adjustmentPercent}%`)
            .query("INSERT INTO AuditLog (UserID, Action, TableAffected, RecordID, NewValue) VALUES (@UserID, 'BULK_RATE_UPDATE', 'PricingRules', 'ALL', @NewValue)");

        res.json({ data: result.recordset, updated: result.recordset.length, traceId });
    } catch (err) {
        console.error(`[${traceId}] Bulk pricing update error:`, err.message);
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

// =====================================================================
//  STORES
// =====================================================================

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
        const db = await getPool();
        const result = await db.request().query(`
            SELECT s.*, u.FullName AS ManagerName, u.Email AS ManagerEmail
            FROM Stores s
            JOIN Users u ON s.UserID = u.UserID
            ORDER BY s.StoreID
        `);
        res.json({ data: result.recordset, traceId });
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
 *         description: Store record
 *       404:
 *         description: Store not found
 */
app.get('/api/v1/stores/:id', authenticateToken, async (req, res) => {
    const traceId = uuidv4();
    try {
        const db = await getPool();
        const result = await db.request()
            .input('StoreID', sql.Int, req.params.id)
            .query(`
                SELECT s.*, u.FullName AS ManagerName, u.Email AS ManagerEmail
                FROM Stores s
                JOIN Users u ON s.UserID = u.UserID
                WHERE s.StoreID = @StoreID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Store does not exist.', traceId });
        }

        res.json({ data: result.recordset[0], traceId });
    } catch (err) {
        console.error(`[${traceId}] GET /stores/:id error:`, err.message);
        res.status(500).json({ error: 'Service Error', message: err.message, traceId });
    }
});

// ─── Start Server ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Lewis Retail Engine: Port ${PORT} | Docs: http://localhost:${PORT}/api-docs`));
