import { Controller, Get, Param } from '@nestjs/common';
import { MicroservicesService } from '../services/microservices.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly micro: MicroservicesService) {}

  @Get(':id')
  async getProduct(@Param('id') id: string) {
    return this.micro.getProduct(+id);
  }

  @Get(':id/orders')
  async getProductWithOrders(@Param('id') id: string) {
    return this.micro.getProductWithOrders(+id);
  }
}
