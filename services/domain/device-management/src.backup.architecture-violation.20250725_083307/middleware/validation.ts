// src/middleware/validation.ts
// 간단한 검증 미들웨어

import { Request, Response, NextFunction } from 'express';

export const validationMiddleware = {
  validateDeviceCreate: (req: Request, res: Response, next: NextFunction) => {
    const { name, type } = req.body;
    
    if (!name || !type) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Name and type are required',
        timestamp: new Date(),
      });
      return;
    }
    
    next();
  },

  validateDeviceUpdate: (req: Request, res: Response, next: NextFunction) => {
    // 간단한 검증
    next();
  },

  validateHeartbeat: (req: Request, res: Response, next: NextFunction) => {
    const { timestamp, status } = req.body;
    
    if (!timestamp || !status) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Timestamp and status are required',
        timestamp: new Date(),
      });
      return;
    }
    
    next();
  },
};
