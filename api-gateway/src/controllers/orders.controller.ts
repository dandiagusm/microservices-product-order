import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { MicroservicesService } from '../services/microservices.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly micro: MicroservicesService) {}

  @Post()
  async createOrder(@Body() body: { productId: number; quantity: number }) {
    const { productId, quantity } = body;
    if (!productId || !quantity) {
      throw new Error('productId and quantity are required');
    }
    return this.micro.createOrder(productId, quantity);
  }

  @Get('product/:productId')
  async getOrdersByProduct(@Param('productId') productId: string) {
    return this.micro.getOrdersByProduct(+productId);
  }
}
