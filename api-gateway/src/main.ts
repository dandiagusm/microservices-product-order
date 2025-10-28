import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Read port from environment variable, default to 3000
  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port);

  console.log(`API Gateway listening on port ${port}`);
}
bootstrap();
