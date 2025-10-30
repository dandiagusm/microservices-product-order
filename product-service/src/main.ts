import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestIdMiddleware } from './middlewares/request-id.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error', 'debug'] });

  // Request ID middleware
  app.use(new RequestIdMiddleware().use.bind(new RequestIdMiddleware()));

  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port);

  console.log(`Product Service listening on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('Error starting Product Service:', err);
  process.exit(1);
});
