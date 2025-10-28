import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3001); // safe fallback
  await app.listen(port);
  console.log(`Product service listening on port ${port}`);
}
bootstrap();
