import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { MicroservicesService } from '../services/microservices.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly micro: MicroservicesService) {}

  // POST /products → create new product
  @Post()
  async createProduct(
    @Body() body: { name: string; price: number; qty: number },
  ) {
    return this.micro.createProduct(body);
  }

  // GET /products/:id → fetch product by id (with Redis cache)
  @Get(':id')
  async getProduct(@Param('id') id: string) {
    return this.micro.getProduct(+id);
  }
}
