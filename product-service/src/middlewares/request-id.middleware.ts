import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestIdMiddleware.name);

  use(req: Request & { requestId?: string }, res: Response, next: NextFunction) {
    const requestId = req.header('x-request-id') || randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    this.logger.log(`[RequestID: ${requestId}] ${req.method} ${req.originalUrl}`);
    next();
  }
}
