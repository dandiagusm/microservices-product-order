import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') || 3001;
  await app.listen(port);
  console.log(`Product service listening on ${port}`);
}
bootstrap();
