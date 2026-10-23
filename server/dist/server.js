"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_js_1 = require("./config/database.js");
const auth_routes_js_1 = __importDefault(require("./routes/auth.routes.js"));
const ticket_routes_js_1 = __importDefault(require("./routes/ticket.routes.js"));
const departments_routes_js_1 = __importDefault(require("./routes/departments.routes.js"));
const employees_routes_js_1 = __importDefault(require("./routes/employees.routes.js"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 5000;
// Security and middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: 'http://localhost:5173',
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// API routes
app.use('/api/auth', auth_routes_js_1.default);
app.use('/api/tickets', ticket_routes_js_1.default);
app.use('/api/departments', departments_routes_js_1.default);
app.use('/api/employees', employees_routes_js_1.default);
// Health check
app.get('/api/health', (_req, res) => {
    res.json({
        success: true,
        message: 'Employee Helpdesk API is running',
    });
});
// Start server after connecting to MySQL
async function startServer() {
    try {
        await (0, database_js_1.testDatabaseConnection)();
        app.listen(PORT, () => {
            console.log(`Helpdesk API running at http://localhost:${PORT}`);
        });
    }
    catch (error) {
        console.error('Failed to connect to MySQL:', error);
        process.exit(1);
    }
}
startServer();
