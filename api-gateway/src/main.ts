import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ErrorHandler } from './middlewares/error-handler.middleware';
import { ResponseStandardizationMiddleware } from './middlewares/response-standardization.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.useGlobalFilters(new ErrorHandler());

  app.use(new ResponseStandardizationMiddleware().use);

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port);

  console.log(`API Gateway listening on port ${port}`);
}
bootstrap();
