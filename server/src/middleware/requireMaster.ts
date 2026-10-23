
import type { Request, Response, NextFunction } from 'express'

export function requireMaster(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Please log in to continue.',
    })
  }

  if (req.user.role !== 'master') {
    return res.status(403).json({
      success: false,
      message: 'Only the master user can manage employees.',
    })
  }

  return next()
}
