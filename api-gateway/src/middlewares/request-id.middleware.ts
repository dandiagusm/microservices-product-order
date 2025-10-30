import { Injectable, NestMiddleware } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Check if a request ID already exists from client or upstream
    const existingId = req.headers['x-request-id'];

    // Generate new UUID if not provided
    const requestId = typeof existingId === 'string' && existingId.trim() !== ''
      ? existingId
      : uuidv4();

    // Attach to request & response
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    console.log(`[RequestID: ${requestId}] ${req.method} ${req.originalUrl}`);

    next();
  }
}
