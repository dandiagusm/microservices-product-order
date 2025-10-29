import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { OrdersService } from '../services/orders.service';
import { CreateOrderDto } from '../common/dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly micro: OrdersService) {}

  @Post()
  async createOrder(@Body() body: CreateOrderDto) {
    return this.micro.createOrder(body.productId, body.quantity);
  }

  @Get('product/:productId')
  async getOrdersByProduct(@Param('productId') productId: string) {
    return this.micro.getOrdersByProduct(+productId);
  }
}
