"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = query;
exports.execute = execute;
exports.withTransaction = withTransaction;
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
// Run multiple database operations as one transaction.
async function withTransaction(callback) {
    const connection = await database_js_1.pool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await callback(connection);
        await connection.commit();
        return result;
    }
    catch (error) {
        await connection.rollback();
        throw error;
    }
    finally {
        connection.release();
    }
}
