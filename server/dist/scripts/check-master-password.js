"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_js_1 = require("../utils/db.js");
const password_js_1 = require("../utils/password.js");
require("dotenv/config");
const database_js_1 = require("../config/database.js");
async function main() {
    try {
        const rows = await (0, db_js_1.query)(`SELECT password_hash
       FROM users
       WHERE employee_id = ?
       LIMIT 1`, ['100001']);
        if (!rows[0]) {
            console.log('Master account not found.');
            return;
        }
        const password = process.env.MASTER_TEMP_PASSWORD;
        if (!password) {
            console.log('MASTER_TEMP_PASSWORD is missing from .env');
            return;
        }
        const matches = await (0, password_js_1.verifyPassword)(rows[0].password_hash, password);
        console.log('Temporary password matches database:', matches);
    }
    finally {
        await database_js_1.pool.end();
    }
}
main().catch((error) => {
    console.error('Password check failed:', error.message);
    process.exitCode = 1;
});
