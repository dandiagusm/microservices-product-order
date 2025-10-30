import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class ErrorHandler implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resBody = exception.getResponse();
      if (typeof resBody === 'string') {
        message = resBody;
      } else if (typeof resBody === 'object' && (resBody as any).message) {
        message = (resBody as any).message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    res.status(status).json({
      statusCode: status,
      data: null,
      message,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
  }
}
