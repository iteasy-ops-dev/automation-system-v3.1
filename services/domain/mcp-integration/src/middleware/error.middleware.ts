/**
 * Error Handling Middleware
 * 에러 응답 형식 통일
 */

import { Request, Response, NextFunction } from 'express';
import { MCPError } from '../types';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', error);

  let statusCode = 500;
  let errorResponse: ErrorResponse;

  if (error instanceof MCPError) {
    statusCode = error.statusCode;
    errorResponse = {
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    };
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    errorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.errors
      }
    };
  } else {
    errorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Internal server error'
      }
    };
  }

  res.status(statusCode).json(errorResponse);
}
