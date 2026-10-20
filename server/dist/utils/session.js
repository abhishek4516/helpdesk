"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_DURATION_MS = void 0;
exports.createSessionToken = createSessionToken;
exports.hashSessionToken = hashSessionToken;
const node_crypto_1 = require("node:crypto");
function createSessionToken() {
    return (0, node_crypto_1.randomBytes)(32).toString('hex');
}
function hashSessionToken(token) {
    return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
}
exports.SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
