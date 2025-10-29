import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ResponseStandardizationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const oldJson = res.json;

    res.json = function (data: any) {
      if (data && data.hasOwnProperty('statusCode') && data.hasOwnProperty('data')) {
        return oldJson.call(this, data);
      }

      const wrapped = {
        statusCode: res.statusCode,
        data: data,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      };

      return oldJson.call(this, wrapped);
    };

    next();
  }
}
