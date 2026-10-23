"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireMaster = requireMaster;
function requireMaster(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Please log in to continue.',
        });
    }
    if (req.user.role !== 'master') {
        return res.status(403).json({
            success: false,
            message: 'Only the master user can manage employees.',
        });
    }
    return next();
}
