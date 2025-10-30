import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProductsController } from './controllers/products.controller';
import { OrdersController } from './controllers/orders.controller';
import { OrdersService } from './services/orders.service';
import { ProductsService } from './services/products.service';

@Module({
  imports: [HttpModule],
  controllers: [ProductsController, OrdersController],
  providers: [OrdersService, ProductsService],
})
export class AppModule {}
