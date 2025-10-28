import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProductsController } from './controllers/products.controller';
import { OrdersController } from './controllers/orders.controller';
import { MicroservicesService } from './services/microservices.service';

@Module({
  imports: [HttpModule],
  controllers: [ProductsController, OrdersController],
  providers: [MicroservicesService],
})
export class AppModule {}
