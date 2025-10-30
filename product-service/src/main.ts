import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingMiddleware } from './middlewares/logging.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(new LoggingMiddleware().use);

  const port: number = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port);

  console.log(`Product Service listening on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('Error starting Product Service:', err);
  process.exit(1);
});
