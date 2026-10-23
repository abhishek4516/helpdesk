"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_js_1 = require("../utils/db.js");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    try {
        const departments = await (0, db_js_1.query)(`SELECT id, name, department_code, is_active, head_user_id
       FROM departments
       ORDER BY name ASC`);
        res.json({
            success: true,
            departments,
        });
    }
    catch (error) {
        console.error('Failed to fetch departments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch departments',
        });
    }
});
exports.default = router;
