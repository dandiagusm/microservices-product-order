import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { MicroservicesService } from '../services/microservices.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly micro: MicroservicesService) {}

  @Post()
  async createProduct(@Body() body: { name: string; price: number; qty: number }) {
    return this.micro.createProduct(body);
  }

  @Get(':id')
  async getProduct(@Param('id') id: string) {
    return this.micro.getProduct(+id);
  }
}
