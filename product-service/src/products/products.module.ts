import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { RedisCacheService } from '../common/utils/redis.util';
import { RabbitmqPublisher } from '../common/utils/rabbitmq.publisher';
import { ProductsController } from './products.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  providers: [ProductsService, RedisCacheService, RabbitmqPublisher],
  controllers: [ProductsController],
  exports: [ProductsService],
})
export class ProductsModule {}
