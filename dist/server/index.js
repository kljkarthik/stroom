"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const env_1 = require("./config/env");
const database_1 = require("./db/database");
const adapter_1 = require("./db/adapter");
const security_1 = require("./middleware/security");
const originProxyAuth_1 = require("./middleware/originProxyAuth");
const auth_1 = __importDefault(require("./routes/auth"));
const onboarding_1 = __importDefault(require("./routes/onboarding"));
const discovery_1 = __importDefault(require("./routes/discovery"));
const preferences_1 = __importDefault(require("./routes/preferences"));
const admin_1 = __importDefault(require("./routes/admin"));
const events_1 = __importDefault(require("./routes/events"));
const auction_1 = __importDefault(require("./routes/auction"));
const passes_1 = __importDefault(require("./routes/passes"));
const partners_1 = __importDefault(require("./routes/partners"));
const communities_1 = __importDefault(require("./routes/communities"));
const contact_1 = __importDefault(require("./routes/contact"));
const upload_1 = __importDefault(require("./routes/upload"));
(0, env_1.validateEnvironment)();
const app = (0, express_1.default)();
const PORT = env_1.config.port;
// Security hardening headers & Express fingerprinting removal
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(security_1.securityHeaders);
// Origin-aware CORS policy
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true); // Server-to-server, curl, native webviews
        if (!env_1.config.isProduction)
            return callback(null, true);
        if (env_1.config.allowedOrigins.length > 0 && env_1.config.allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS policy'));
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: '2mb' }));
// Initialize SQLite database and seed initial data (SQLite driver only)
if ((0, adapter_1.getActiveDriver)() === 'sqlite') {
    (0, database_1.initDatabase)();
}
// Health Check (verifies live database connectivity & operational status)
app.get('/api/health', async (req, res) => {
    try {
        const adapter = (0, adapter_1.getDatabaseAdapter)();
        const ok = await adapter.ping();
        if (!ok) {
            return res.status(503).json({ status: 'degraded', database: 'unreachable', timestamp: new Date().toISOString() });
        }
        return res.json({
            status: 'ok',
            app: 'STROOM Auction Hub & Social Discovery API',
            version: '2.0.0',
            environment: env_1.config.nodeEnv,
            database: 'connected',
            integrations: {
                paymentGatewayConfigured: Boolean(process.env.RAZORPAY_KEY_ID || process.env.STRIPE_SECRET_KEY),
                emailProviderConfigured: Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY),
                cloudinaryConfigured: env_1.config.isCloudinaryConfigured,
                mediaStorage: env_1.config.isCloudinaryConfigured ? 'cloudinary' : 'external_url_references',
            },
            uptimeSeconds: Math.round(process.uptime()),
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
        return res.status(503).json({
            status: 'error',
            database: 'failed',
            timestamp: new Date().toISOString(),
        });
    }
});
// API Routes
app.use('/api/auth', originProxyAuth_1.originProxyAuthMiddleware, auth_1.default);
app.use('/api/onboarding', onboarding_1.default);
app.use('/api/discovery', discovery_1.default);
app.use('/api/users', preferences_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/events', events_1.default);
app.use('/api/auctions', auction_1.default);
app.use('/api/passes', passes_1.default);
app.use('/api/partners', partners_1.default);
app.use('/api/communities', communities_1.default);
app.use('/api/contact', contact_1.default);
app.use('/api/upload', upload_1.default);
// Serve static frontend in production
const clientDistPath = path_1.default.resolve(process.cwd(), 'dist');
app.use(express_1.default.static(clientDistPath));
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    const indexPath = path_1.default.join(clientDistPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.status(404).send('Not Found');
        }
    });
});
app.use(security_1.globalErrorHandler);
if (process.env.NODE_ENV !== 'test') {
    app.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`[STROOM Server] Running on http://localhost:${PORT}`);
    });
}
exports.default = app;
