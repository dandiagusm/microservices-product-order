import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProductsController } from './controllers/products.controller';
import { OrdersController } from './controllers/orders.controller';
import { MicroservicesService } from './services/microservices.service';
import { RabbitmqService } from './common/rabbitmq/rabbitmq.service';

@Module({
  imports: [HttpModule],
  controllers: [ProductsController, OrdersController],
  providers: [MicroservicesService, RabbitmqService],
})
export class AppModule {}
