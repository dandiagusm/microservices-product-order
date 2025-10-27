import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from './products/products.module';
import { Product } from './products/entities/product.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST') || 'db',
        port: Number(config.get<number>('DB_PORT')) || 5432,
        username: config.get<string>('DB_USER') || 'user',
        password: config.get<string>('DB_PASSWORD') || 'password',
        database: config.get<string>('DB_NAME') || 'microservices_db',
        entities: [Product],
        synchronize: true, // optional, for dev only
      }),
    }),
    ProductsModule,
  ],
})
export class AppModule {}
