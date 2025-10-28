import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { MicroservicesService } from '../services/microservices.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly micro: MicroservicesService) {}

  @Post()
  async createOrder(@Body() body: { productId: number; quantity: number }) {
    return this.micro.createOrder(body.productId, body.quantity);
  }

  @Get('product/:productId')
  async getOrdersByProduct(@Param('productId') productId: string) {
    return this.micro.getOrdersByProduct(+productId);
  }
}
