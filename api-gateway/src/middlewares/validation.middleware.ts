import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ValidationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'POST') {
      const body = req.body;
      if (!body || Object.keys(body).length === 0) {
        throw new BadRequestException('Request body cannot be empty');
      }
    }
    next();
  }
}
