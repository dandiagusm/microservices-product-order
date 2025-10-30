// src/middlewares/logging.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private logger = new Logger('ProductService');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, body, query, params } = req;
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const truncatedBody = JSON.stringify(body).slice(0, 500);

      this.logger.log(
        `${method} ${originalUrl} ${res.statusCode} - ${duration}ms\n` +
        `Params: ${JSON.stringify(params)}, Query: ${JSON.stringify(query)}, Body: ${truncatedBody}`
      );
    });

    next();
  }
}
