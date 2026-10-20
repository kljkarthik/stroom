"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const database_1 = require("./db/database");
const auth_1 = __importDefault(require("./routes/auth"));
const onboarding_1 = __importDefault(require("./routes/onboarding"));
const discovery_1 = __importDefault(require("./routes/discovery"));
const preferences_1 = __importDefault(require("./routes/preferences"));
const admin_1 = __importDefault(require("./routes/admin"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Initialize SQLite database and seed initial data
(0, database_1.initDatabase)();
// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        app: 'Stroom Social Discovery API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
// API Routes
app.use('/api/auth', auth_1.default);
app.use('/api/onboarding', onboarding_1.default);
app.use('/api/discovery', discovery_1.default);
app.use('/api/users', preferences_1.default);
app.use('/api/admin', admin_1.default);
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
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`[Stroom Server] Running on http://localhost:${PORT}`);
    });
}
exports.default = app;
