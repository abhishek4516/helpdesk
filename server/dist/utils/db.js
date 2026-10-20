"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = query;
exports.execute = execute;
const database_js_1 = require("../config/database.js");
async function query(sql, values = []) {
    const [rows] = await database_js_1.pool.query(sql, values);
    return rows;
}
async function execute(sql, values = []) {
    const [result] = await database_js_1.pool.execute({
        sql,
        values: values,
    });
    return result;
}
